from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from server.db import get_session
from server.models import Shift

router = APIRouter()

@router.get("/")
def list_shifts(session: Session = Depends(get_session)):
    return session.exec(select(Shift)).all()

@router.post("/")
def create_shift(shift: Shift, session: Session = Depends(get_session)):
    session.add(shift)
    session.commit()
    session.refresh(shift)
    return shift