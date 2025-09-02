from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from server.db import get_session
from server.models import ProviderAvailability
from pydantic import BaseModel, field_validator
from datetime import datetime, time as dtime
from typing import List, Optional

router = APIRouter()

class AvailabilityCreate(BaseModel):
    provider_id: int
    weekday: int  # 0-6 (Mon-Sun)
    start: str    # "HH:MM"
    end: str      # "HH:MM"

    @field_validator("weekday")
    @classmethod
    def _wkday(cls, v: int):
        if v < 0 or v > 6:
            raise ValueError("weekday must be 0..6 (Mon..Sun)")
        return v

    @field_validator("start", "end")
    @classmethod
    def _hhmm(cls, v: str):
        try:
            datetime.strptime(v, "%H:%M")
        except Exception:
            raise ValueError("time must be 'HH:MM' (24h)")
        return v

class AvailabilityCreateBulk(BaseModel):
    items: List[AvailabilityCreate]

class AvailabilityKey(BaseModel):
    provider_id: int
    weekday: int
    start: str  # "HH:MM"
    end: str    # "HH:MM"

#Helpers
def _parse_hhmm(s: str) -> dtime:
    return datetime.strptime(s, "%H:%M").time()

def _exists_exact(session: Session, provider_id: int, weekday: int, start: dtime, end: dtime) -> Optional[ProviderAvailability]:
    return session.exec(
        select(ProviderAvailability).where(
            ProviderAvailability.provider_id == provider_id,
            ProviderAvailability.weekday == weekday,
            ProviderAvailability.start == start,
            ProviderAvailability.end == end,
        )
    ).first()

#routes
@router.get("/", response_model=List[ProviderAvailability])
def list_availability(
    session: Session = Depends(get_session),
    provider_id: Optional[int] = Query(None),
    weekday: Optional[int] = Query(None, ge=0, le=6),
):
    #List all availability rows, optionally filtered by provider_id and/or weekday.
    
    stmt = select(ProviderAvailability)
    if provider_id is not None:
        stmt = stmt.where(ProviderAvailability.provider_id == provider_id)
    if weekday is not None:
        stmt = stmt.where(ProviderAvailability.weekday == weekday)
    stmt = stmt.order_by(ProviderAvailability.provider_id, ProviderAvailability.weekday, ProviderAvailability.start)
    return session.exec(stmt).all()


@router.post("/", response_model=ProviderAvailability, status_code=201)
def create_availability(payload: AvailabilityCreate, session: Session = Depends(get_session)):
    """
    Create a single availability row.
    Rejects exact duplicates and invalid ranges (start >= end).
    """
    start_t = _parse_hhmm(payload.start)
    end_t = _parse_hhmm(payload.end)
    if not (start_t < end_t):
        raise HTTPException(status_code=400, detail="start must be before end")

    dup = _exists_exact(session, payload.provider_id, payload.weekday, start_t, end_t)
    if dup:
        raise HTTPException(status_code=409, detail="Exact availability already exists")

    row = ProviderAvailability(
        provider_id=payload.provider_id,
        weekday=payload.weekday,
        start=start_t,
        end=end_t,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.post("/bulk", response_model=List[ProviderAvailability], status_code=201)
def create_availability_bulk(payload: AvailabilityCreateBulk, session: Session = Depends(get_session)):
    """
    Bulk create availability rows.
    Skips exact duplicates; returns all created rows.
    """
    created: list[ProviderAvailability] = []
    for item in payload.items:
        start_t = _parse_hhmm(item.start)
        end_t = _parse_hhmm(item.end)
        if not (start_t < end_t):
            raise HTTPException(status_code=400, detail=f"Invalid range for weekday {item.weekday}: start >= end")

        if _exists_exact(session, item.provider_id, item.weekday, start_t, end_t):
            continue

        row = ProviderAvailability(
            provider_id=item.provider_id,
            weekday=item.weekday,
            start=start_t,
            end=end_t,
        )
        session.add(row)
        created.append(row)

    session.commit()
    for r in created:
        session.refresh(r)
    return created


@router.delete("/{availability_id:int}", status_code=204)
def delete_availability_by_id(availability_id: int, session: Session = Depends(get_session)): #I have no idea why, but expecting "Int" resolves a 422 error 
    """
    Delete a single availability row by its ID.
    """
    row = session.get(ProviderAvailability, availability_id)
    if not row:
        raise HTTPException(status_code=404, detail="Availability not found")
    session.delete(row)
    session.commit()
    return None


@router.delete("/by-key", status_code=204)
def delete_availability_by_key(payload: AvailabilityKey, session: Session = Depends(get_session)):
    """
    Delete a single availability row by composite key: provider_id + weekday + start + end.
    """
    start_t = _parse_hhmm(payload.start)
    end_t = _parse_hhmm(payload.end)
    row = _exists_exact(session, payload.provider_id, payload.weekday, start_t, end_t)
    if not row:
        raise HTTPException(status_code=404, detail="Availability not found")
    session.delete(row)
    session.commit()
    return None


@router.delete("/provider-day", status_code=204)
def delete_all_for_provider_day(
    provider_id: int = Query(...),
    weekday: int = Query(..., ge=0, le=6),
    session: Session = Depends(get_session),
):
    """
    Delete ALL availability rows for a given provider on a given weekday.
    Useful if you store multiple windows (e.g., 08:00–12:00 and 14:00–18:00) and want to clear that day.
    """
    rows = session.exec(
        select(ProviderAvailability).where(
            ProviderAvailability.provider_id == provider_id,
            ProviderAvailability.weekday == weekday
        )
    ).all()
    if not rows:
        return None
    for r in rows:
        session.delete(r)
    session.commit()
    return None