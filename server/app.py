from fastapi import FastAPI
from contextlib import asynccontextmanager
from server.db import init_db
from fastapi.middleware.cors import CORSMiddleware

from server.db import init_db
from server.routers import providers, shifts, assignments, schedule


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

app.include_router(providers.router)
app.include_router(shifts.router)
app.include_router(assignments.router)
app.include_router(schedule.router)