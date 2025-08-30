from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from server.db import get_session
from server.models import ProviderAvailability

router = APIRouter()