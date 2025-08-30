from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from server.db import get_session
from server.models import Assignment

router = APIRouter()

@router.get("/")
def list_assignments(session: Session = Depends(get_session)):
    return session.exec(select(Assignment)).all()