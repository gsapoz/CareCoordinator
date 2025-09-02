from sqlmodel import SQLModel, create_engine, Session

DBURL = "sqlite:///main.db" #TO-DO: Local -> Production

engine = create_engine(DBURL, echo=False)

def init_db(): #TO-DO: Run commands 'python3 -m venv .venv" then "source .venv/bin/activate" then 'uvicorn server.app:app --reload' from root to generate local db file
    from server import models 
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session