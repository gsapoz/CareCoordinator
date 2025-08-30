from fastapi import APIRouter

router = APIRouter()

@router.post("/run")
def run_scheduler(start: str, end: str):
    # TO-DO: Incorporate LLM and OR tools to create shifts and assign providers
    return {"status": "ok", "message": f"Scheduler ran from {start} to {end}"}