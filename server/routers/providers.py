from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from server.db import get_session
from server.models import Provider

router = APIRouter()

@router.get("/")
def list_providers(session: Session = Depends(get_session)):
    return session.exec(select(Provider)).all()

@router.post("/")
def create_provider(provider: Provider, session: Session = Depends(get_session)):
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return provider