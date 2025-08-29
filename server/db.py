from sqlmodel import SQLModel, create_engine, Session

DBURL = "sqlite:///main.db" #TO-DO: Local -> Production

engine = create_engine(DBURL, echo=False)

def init_db(): #TO-DO: Run command 'uvicorn server.app:app --reload' to generate local db file
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session