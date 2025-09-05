from __future__ import annotations
from typing import Dict, Tuple, List, Optional, Set
from datetime import datetime, time
import math

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, select, col

from server.db import get_session
from server.models import Provider, ProviderAvailability, Shift, Assignment

router = APIRouter(prefix="/schedule", tags=["schedule"])

import subprocess 
from functools import lru_cache

@lru_cache(maxsize=2048)
def zip_distance(zip_a: str, zip_b: str) -> float:
    #uses Node to implement the zipcodes npm package, returns miles (float) if not null
    try:
        result = subprocess.run(
            ["node", "ziphelper.js", zip_a, zip_b],
            capture_output=True,
            text=True,
            cwd="client",  
            check=False,
        )
        val = result.stdout.strip()
        d = float(val)
        if d < 0:
            return float("inf")
        return d
    except Exception:
        return float("inf")


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """True if time windows overlap (inclusive)."""
    return not (a_end <= b_start or b_end <= a_start)


def provider_available_on_shift(session: Session, provider_id: int, shift: Shift) -> bool:
    """
    Very simple availability check:
    - Day-of-week matches any availability row for that provider
    - The shift’s time falls within the availability time window (same day)
    NOTE: Availability rows are weekday + start/end (time only).
    """
    weekday = shift.starts.weekday()  # Monday=0..Sunday=6

    avails = session.exec(
        select(ProviderAvailability).where(
            ProviderAvailability.provider_id == provider_id,
            ProviderAvailability.weekday == weekday,
        )
    ).all()

    if not avails:
        return False

    # Compare time-of-day only
    s_time = shift.starts.time()
    e_time = shift.ends.time()
    for a in avails:
        if (a.start <= s_time) and (e_time <= a.end):
            return True
    return False


def provider_has_conflict(session: Session, provider_id: int, shift: Shift) -> bool:
    #If provider already has an assignment or an overlap, return True
    existing = session.exec(
        select(Assignment).where(Assignment.provider_id == provider_id)
    ).all()
    if not existing:
        return False

    # Get all those shifts and check overlap
    shift_ids = [a.shift_id for a in existing if a.shift_id is not None]
    if not shift_ids:
        return False

    other_shifts = session.exec(
        select(Shift).where(Shift.id.in_(shift_ids))
    ).all()

    for s in other_shifts:
        if overlaps(shift.starts, shift.ends, s.starts, s.ends):
            return True
    return False

@router.post("/run")
def run_scheduler(session: Session = Depends(get_session)):
    providers = session.exec(select(Provider).where(Provider.active == True)).all()
    shifts = session.exec(select(Shift).order_by(Shift.starts)).all()

    assigned_shift_ids = {
        a.shift_id
        for a in session.exec(select(Assignment)).all()
        if a.shift_id is not None
    }

    # Cache families
    families = {f.id: f for f in session.exec(select(Family)).all()}

    created = 0
    for sh in shifts:
        if sh.id in assigned_shift_ids:
            continue

        fam = families.get(sh.family_id)
        fam_pref = (fam.continuity_preference or "").strip().lower() if fam else ""

        # Eligible providers by skill + availability + no conflicts
        def eligible(ps):
            for p in ps:
                if not p.skills:
                    continue
                # exact skill match
                if not any(s.strip().lower() == sh.required_skills.strip().lower()
                           for s in p.skills.split(",")):
                    continue
                if not provider_available_on_shift(session, p.id, sh):
                    continue
                if provider_has_conflict(session, p.id, sh):
                    continue
                yield p

        chosen = None

        # 1) CONTINUITY first (if preference suggests it)
        wants_continuity = fam_pref in {"consistent", "consistency", "high", "prefers_consistency"}
        if wants_continuity and fam:
            # find that family's past providers, ranked by frequency then newest
            past_asg = session.exec(
                select(Assignment)
                .join(Shift, Shift.id == Assignment.shift_id)
                .where(Shift.family_id == fam.id, Assignment.provider_id.is_not(None))
            ).all()
            if past_asg:
                # frequency map
                freq: dict[int, int] = {}
                last_seen: dict[int, datetime] = {}
                for a in past_asg:
                    pid = a.provider_id
                    if pid is None:
                        continue
                    freq[pid] = freq.get(pid, 0) + 1
                    # track recency using the shift start time
                    sh_rec = session.get(Shift, a.shift_id)
                    if sh_rec:
                        last_seen[pid] = max(last_seen.get(pid, datetime.min), sh_rec.starts)

                prev_providers = [p for p in providers if p.id in freq]
                # rank: higher frequency first, then most recent last_seen
                prev_providers.sort(key=lambda p: (-freq[p.id], -(last_seen[p.id].timestamp() if p.id in last_seen else 0)))

                for p in eligible(prev_providers):
                    chosen = p
                    break

        # 2) FALLBACK to nearest if none chosen
        if chosen is None:
            cands = []
            for p in eligible(providers):
                d = zip_distance(p.home_zip, sh.zip)
                cands.append((d, p))
            if cands:
                cands.sort(key=lambda t: t[0])
                chosen = cands[0][1]
                dist = cands[0][0]
                msg = f"Auto-scheduled (nearest, {dist:.1f} mi)"
            else:
                # leave unfilled if no fit
                continue
        else:
            # continuity path: compute distance for message
            dist = zip_distance(chosen.home_zip, sh.zip)
            msg = f"Auto-scheduled (continuity, {dist:.1f} mi)"

        session.add(
            Assignment(
                shift_id=sh.id,
                provider_id=chosen.id,
                status="confirmed",
                message=msg,
            )
        )
        assigned_shift_ids.add(sh.id)
        created += 1

    session.commit()
    return {"assigned": created, "total_considered": len(shifts)}