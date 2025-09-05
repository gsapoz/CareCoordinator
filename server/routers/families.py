from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select
from server.db import get_session
from server.models import Family

router = APIRouter(prefix="/families", tags=["families"])

class FamilyCreate(BaseModel):
    name: str
    zip: str
    continuity_preference: str

@router.get("", response_model=list[Family])
def list_families(session: Session = Depends(get_session)):
    return session.exec(select(Family)).all()

@router.post("", response_model=Family)
def create_family(payload: FamilyCreate, session: Session = Depends(get_session)):
    fam = Family(
        name=payload.name,
        zip=payload.zip,
        continuity_preference=(payload.continuity_preference or "").strip().lower(),
    )
    session.add(fam)
    session.commit()
    session.refresh(fam)
    return fam