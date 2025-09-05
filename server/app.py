from fastapi import FastAPI
from contextlib import asynccontextmanager
from server.db import init_db
from fastapi.middleware.cors import CORSMiddleware

from server.db import init_db
from server.routers import providers, shifts, assignments, schedule, availabilities, ai, families

import os
from dotenv import load_dotenv
load_dotenv #to implement OpenAI LLM

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() #Init app backend on run
    yield #performs garbage collection on shutdown

app = FastAPI(lifespan=lifespan) #on_startup: init_db()

@app.get("/")
def root():
    return {"message": "Your API is now live"}

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    print("Warning: OPENAI_API_KEY not set in .env")

app.include_router(providers.router, prefix="/providers", tags=["providers"])
app.include_router(shifts.router, prefix="/shifts", tags=["shifts"])
app.include_router(assignments.router)
app.include_router(schedule.router)
app.include_router(availabilities.router, prefix="/availability", tags=["availability"])
app.include_router(ai.router)
app.include_router(families.router)