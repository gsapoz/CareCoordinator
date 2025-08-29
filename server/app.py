from fastapi import FastAPI
from contextlib import asynccontextmanager
from server.db import init_db
from fastapi.middleware.cors import CORSMiddleware

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