from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional

from server.db import get_session
from server.models import Assignment

router = APIRouter(prefix="/assignments", tags=["assignments"])

@router.get("/", response_model=List[Assignment])
def list_assignments(session: Session = Depends(get_session)):
    return session.exec(select(Assignment)).all()

@router.post("/", response_model=Assignment)
def create_assignment(assignment: Assignment, session: Session = Depends(get_session)):
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment

@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: int, session: Session = Depends(get_session)):
    row: Optional[Assignment] = session.get(Assignment, assignment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    session.delete(row)
    session.commit()
    return {"ok": True}
