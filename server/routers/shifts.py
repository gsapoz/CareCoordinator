# server/routers/shifts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator

from server.db import get_session
from server.models import Shift

router = APIRouter()

class ShiftCreate(BaseModel):
    family_id: int
    starts: datetime
    ends: datetime
    zip: str
    required_skills: str

    @field_validator("starts", "ends", mode="before")
    @classmethod
    def _parse_iso(cls, v):
        if isinstance(v, datetime):
            dt = v
        else:
            s = str(v).strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            try:
                dt = datetime.fromisoformat(s)
            except Exception:
                raise ValueError("Invalid datetime format")
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

def _ensure_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

@router.get("/", response_model=list[Shift])
def list_shifts(session: Session = Depends(get_session)):
    return session.exec(select(Shift).order_by(Shift.starts)).all()

@router.post("/", response_model=Shift, status_code=201)
def create_shift(payload: ShiftCreate, session: Session = Depends(get_session)):
    starts = _ensure_naive_utc(payload.starts)
    ends = _ensure_naive_utc(payload.ends)

    if starts >= ends:
        raise HTTPException(status_code=400, detail="ends must be after starts")

    row = Shift(
        family_id=payload.family_id,
        starts=starts,
        ends=ends,
        zip=payload.zip,
        required_skills=payload.required_skills,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row

@router.delete("/{shift_id:int}", status_code=204)
def delete_shift(shift_id: int, session: Session = Depends(get_session)):
    row = session.get(Shift, shift_id)
    if not row:
        raise HTTPException(status_code=404, detail="Shift not found")
    session.delete(row)
    session.commit()
    return None
