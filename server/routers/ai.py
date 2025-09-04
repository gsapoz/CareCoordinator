import os, json, random
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydField
from sqlmodel import Session

from server.db import get_session
from server.models import Provider, Shift, ProviderAvailability

# For this to work remember to create .env file then add OpenAI Key there 

router = APIRouter(prefix="/ai", tags=["ai"])

# Request/Response Models

class AutoGenRequest(BaseModel):
    n_providers: int = 8
    n_shifts: int = 16
    # Optional window to place shifts into (defaults = next 7 days)
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    zip_pool: List[str] = ["98101","98103","98107","98109","98115","98052"]

class AutoGenResult(BaseModel):
    created_providers: int
    created_shifts: int
    used_ai: bool

# ---------- Helpers ----------

def _parse_iso_to_naive(iso: str) -> datetime:
    """
    Accepts 'YYYY-MM-DDTHH:MM:SSZ' or with offset.
    Returns a naive datetime (no tzinfo) in local time for SQLite.
    """
    # Normalize 'Z' to +00:00
    iso = iso.replace("Z", "+00:00")
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo:
        # convert to local (or keep UTC if you prefer) then drop tzinfo
        dt = dt.astimezone().replace(tzinfo=None)
    return dt

def _fallback_fake_data(payload: AutoGenRequest):
    """
    Deterministic local generator if no AI key is set or call fails.
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
        # Assign 1–2 skills
        sk = random.sample(skills_pool, k=random.choice([1,2]))
        providers.append({
            "name": name,
            "home_zip": home_zip,
            "skills": ", ".join(sk),
            "active": True
        })

    # Shifts within the window, random durations 4–12h
    shifts = []
    for _ in range(payload.n_shifts):
        day_offset = random.randint(0, max((end - start).days, 1))
        shift_start = (start + timedelta(days=day_offset, hours=random.randint(6, 20))).replace(minute=0, second=0)
        hours = random.choice([4,6,8,10,12])
        shift_end = shift_start + timedelta(hours=hours)

        shifts.append({
            "starts": shift_start.isoformat(),
            "ends": shift_end.isoformat(),
            "zip": random.choice(payload.zip_pool),
            "required_skills": random.choice(skills_pool)
        })

    return {"providers": providers, "shifts": shifts}

def get_client():
    api_key = os.getenv("OPEN_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment")
    return OpenAI(api_key = api_key)

def _call_llm(payload: AutoGenRequest):
    """
    Ask the LLM to fabricate realistic providers/shifts as JSON.
    Returns a dict with 'providers' and 'shifts'.
    """
    try: 
        client = get_client()
    except RuntimeError:
        return None

    skills_list = ["Doula","Nurse","Lactation Consultant"]
    start = (payload.start or (datetime.now(timezone.utc) + timedelta(hours=1))).isoformat()
    end = (payload.end or (datetime.now(timezone.utc) + timedelta(days=7))).isoformat()

    sys = (
        "You are generating seed data for a small healthcare scheduling system. "
        "Output STRICT JSON with keys 'providers' (array) and 'shifts' (array). "
        "NO commentary. Only JSON."
    )
    usr = f"""
Return JSON like:
{{
  "providers": [
    {{
      "name": "First Last",
      "home_zip": "98107",
      "skills": "Doula, Nurse",  // CSV string
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
- Generate {payload.n_providers} providers, {payload.n_shifts} shifts.
- skills must be chosen from: {skills_list}.
- required_skills must be ONE of the skills above.
- Distribute shifts between {start} and {end}.
- Use ZIPs from this list only: {payload.zip_pool}.
- Keep names realistic and diverse.
- Keep output small/clean; no nulls, no extra keys.
"""

    try:
        # Enforce JSON format for requests
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": sys},
                {"role": "user", "content": usr},
            ],
            temperature=0.7,
        )
        content = resp.choices[0].message.content
        data = json.loads(content)
        return data
    except Exception:
        return None

# Route

@router.post("/autogen", response_model=AutoGenResult)
def autogen(payload: AutoGenRequest, session: Session = Depends(get_session)):
    """
    Create demo Providers and Shifts using the LLM (if available).
    Falls back to a deterministic local generator if no key or the call fails.
    """
    used_ai = False
    data = _call_llm(payload)
    if not data:
        data = _fallback_fake_data(payload)
    else:
        used_ai = True

    providers = data.get("providers", [])
    shifts = data.get("shifts", [])

    # Insert Providers
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
            # skip ill-formed
            continue

    session.commit()

    new_providers = session.exec(
        # get the most recent created providers using last N rows
        Provider.__table__.select().order_by(Provider.id.desc())
    ).all()[:created_p]
    for prov_row in new_providers:
        days = random.sample([0,1,2,3,4,5,6], k=random.choice([2,3,4]))
        for d in days:
            session.add(ProviderAvailability(
                provider_id=prov_row.id,
                weekday=d,
                start=datetime.strptime("08:00", "%H:%M").time(),
                end=datetime.strptime("18:00", "%H:%M").time(),
            ))
    session.commit()

    # Insert Shifts
    created_s = 0
    for s in shifts:
        try:
            starts = _parse_iso_to_naive(str(s["starts"]))
            ends   = _parse_iso_to_naive(str(s["ends"]))
            sh = Shift(
                # case_id 
                starts=starts,
                ends=ends,
                zip=str(s["zip"]).strip(),
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
        used_ai=used_ai
    )
