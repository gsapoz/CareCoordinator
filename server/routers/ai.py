# server/routers/ai.py
import os, json, random
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from server.db import get_session
from server.models import Provider, Shift, ProviderAvailability, Family

# Optional: uses OpenAI if OPENAI_API_KEY is set, otherwise falls back to local generator
from openai import OpenAI

router = APIRouter(prefix="/ai", tags=["ai"])

# -------------------- Request / Response Models --------------------

class AutoGenRequest(BaseModel):
    n_providers: int = 8
    n_shifts: int = 16
    n_families: Optional[int] = None  # auto if not provided
    # Optional window (defaults = next 7 days)
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    # NOTE: each ZIP must be a separate string
    zip_pool: List[str] = ["98101","98102","98103","98104","98105","98106","98107","98108","98109","98115","98052"]

class AutoGenResult(BaseModel):
    created_providers: int
    created_shifts: int
    used_ai: bool

# -------------------- Helpers --------------------

def _parse_iso_to_naive(iso: str) -> datetime:
    """
    Accepts 'YYYY-MM-DDTHH:MM:SS' with optional 'Z' or offset.
    Returns a naive datetime (no tzinfo) suitable for SQLite.
    """
    iso = iso.replace("Z", "+00:00")
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt

def _fallback_fake_data(payload: AutoGenRequest):
    """
    Local deterministic generator: returns dict with 'providers' and 'shifts'.
    """
    first_names = ["Ava","Maya","Elena","Noah","Lucas","Olivia","Leo","Zoe","Mila","Ethan"]
    last_names = ["Chen","Garcia","Johnson","Singh","Patel","Nguyen","Lee","Martinez","Brown","Wilson"]
    skills_pool = ["Doula","Nurse","Lactation Consultant"]

    start = payload.start or (datetime.now().replace(microsecond=0) + timedelta(hours=2))
    end   = payload.end or (start + timedelta(days=7))

    providers = []
    for _ in range(payload.n_providers):
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        home_zip = random.choice(payload.zip_pool)
        sk = random.sample(skills_pool, k=random.choice([1, 2]))  # 1–2 skills
        providers.append({
            "name": name,
            "home_zip": home_zip,
            "skills": ", ".join(sk),
            "active": True,
        })

    # Shifts within the window, durations 4–12h
    shifts = []
    total_days = max((end - start).days, 1)
    for _ in range(payload.n_shifts):
        day_offset = random.randint(0, total_days)
        shift_start = (start + timedelta(days=day_offset, hours=random.randint(6, 20))).replace(minute=0, second=0)
        hours = random.choice([4, 6, 8, 10, 12])
        shift_end = shift_start + timedelta(hours=hours)
        shifts.append({
            "starts": shift_start.isoformat(),
            "ends": shift_end.isoformat(),
            "zip": random.choice(payload.zip_pool),
            "required_skills": random.choice(skills_pool),
        })

    return {"providers": providers, "shifts": shifts}

def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment")
    return OpenAI(api_key=api_key)

def _call_llm(payload: AutoGenRequest):
    """
    Ask the LLM to fabricate providers/shifts as JSON.
    Returns a dict with 'providers' and 'shifts', or None on failure.
    """
    try:
        client = get_client()
    except RuntimeError:
        return None

    skills_list = ["Doula","Nurse","Lactation Consultant"]
    start = (payload.start or (datetime.now(timezone.utc) + timedelta(hours=1))).isoformat()
    end   = (payload.end or (datetime.now(timezone.utc) + timedelta(days=7))).isoformat()

    sys = (
        "You are generating seed data for a small healthcare scheduling system. "
        "Output STRICT JSON with keys 'providers' (array) and 'shifts' (array). "
        "No commentary, only JSON."
    )
    usr = f"""
{{
  "providers": [
    {{
      "name": "First Last",
      "home_zip": "98107",
      "skills": "Doula, Nurse",
      "active": true
    }}
  ],
  "shifts": [
    {{
      "starts": "2025-09-04T13:00:00Z",
      "ends": "2025-09-04T21:00:00Z",
      "zip": "98107",
      "required_skills": "Doula"
    }}
  ]
}}

Rules:
- Generate {payload.n_providers} providers and {payload.n_shifts} shifts.
- Provider skills must be from: {skills_list}.
- Shift required_skills must be ONE of the above.
- Distribute shifts between {start} and {end}.
- Use only these ZIPs: {payload.zip_pool}.
- Keep output compact: no extra keys, no nulls.
"""

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": sys},
                      {"role": "user", "content": usr}],
            temperature=0.7,
        )
        content = resp.choices[0].message.content
        return json.loads(content)
    except Exception:
        return None

# -------------------- Route --------------------

@router.post("/autogen", response_model=AutoGenResult)
def autogen(payload: AutoGenRequest, session: Session = Depends(get_session)):
    """
    Create demo Providers, Families, and Shifts.
    - Uses OpenAI if OPENAI_API_KEY is set; otherwise uses a local fallback.
    - Ensures a reasonable number of Families exist.
    - Assigns every Shift a family_id (NOT NULL).
    """
    used_ai = False
    data = _call_llm(payload)
    if not data:
        data = _fallback_fake_data(payload)
    else:
        used_ai = True

    providers = data.get("providers", [])
    shifts    = data.get("shifts",    [])

    # ---- Insert Providers ----
    created_p = 0
    for p in providers:
        try:
            prov = Provider(
                name=str(p["name"]).strip(),
                home_zip=str(p["home_zip"]).strip(),
                skills=str(p.get("skills", "")).strip(),
                active=bool(p.get("active", True)),
            )
            session.add(prov)
            created_p += 1
        except Exception:
            continue
    session.commit()

    # Seed basic availability for the newly created providers
    if created_p > 0:
        new_providers = session.exec(
            Provider.__table__.select().order_by(Provider.id.desc())
        ).all()[:created_p]

        for row in new_providers:
            days = random.sample([0,1,2,3,4,5,6], k=random.choice([2,3,4]))
            for d in days:
                session.add(ProviderAvailability(
                    provider_id=row.id,
                    weekday=d,
                    start=datetime.strptime("08:00", "%H:%M").time(),
                    end=datetime.strptime("18:00", "%H:%M").time(),
                ))
        session.commit()

    # ---- Ensure Families exist ----
    target_families = payload.n_families or max(8, payload.n_shifts // 2)
    existing_ids = session.exec(select(Family.id)).all()
    to_create = max(target_families - len(existing_ids), 0)

    if to_create > 0:
        fn = ["River","Sky","Rowan","Harper","Kai","Ari","Sage","Phoenix","Taylor","Quinn"]
        ln = ["Nguyen","Johnson","Garcia","Patel","Lee","Brown","Martinez","Wilson","Chen","Singh"]
        prefs = ["consistent", "flexible"]
        for _ in range(to_create):
            fam = Family(
                name=f"{random.choice(fn)} {random.choice(ln)}",
                zip=random.choice(payload.zip_pool),
                continuity_preference=random.choice(prefs),
            )
            session.add(fam)
        session.commit()

    family_ids = session.exec(select(Family.id)).all()
    if not family_ids:
        # Safety fallback (should never happen)
        fam = Family(name="Demo Family", zip=random.choice(payload.zip_pool), continuity_preference="flexible")
        session.add(fam)
        session.commit()
        family_ids = [fam.id]

    # ---- Insert Shifts (with family_id) ----
    created_s = 0
    for s in shifts:
        try:
            starts = _parse_iso_to_naive(str(s["starts"]))
            ends   = _parse_iso_to_naive(str(s["ends"]))
            fid    = random.choice(family_ids)

            # 70%: use the family's ZIP so later continuity/proximity works nicely
            fam_zip = session.get(Family, fid).zip
            zip_code = fam_zip if random.random() < 0.7 else str(s.get("zip") or random.choice(payload.zip_pool)).strip()

            sh = Shift(
                family_id=fid,                        # REQUIRED (NOT NULL)
                starts=starts,
                ends=ends,
                zip=zip_code,
                required_skills=str(s["required_skills"]).strip(),
            )
            session.add(sh)
            created_s += 1
        except Exception:
            continue
    session.commit()

    return AutoGenResult(
        created_providers=created_p,
        created_shifts=created_s,
        used_ai=used_ai,
    )
