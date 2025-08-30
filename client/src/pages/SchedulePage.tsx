import axios from "axios";
import { useQuery, useMutation } from "@tanstack/react-query";

const BASE_URL = "http://localhost:8000";

type Shift = { id: number; case_id: number; starts: string; ends: string; zip: string; required_skills: string };
type Assignment = { id?: number; shift_id?: number; provider_id?: number | null; status: string; message?: string };

// #Problem 3
// #A family urgently needed overnight newborn care support, but the coordinator spent 3 hours calling providers to find someone available and qualified. 
// # Two providers showed up because of a miscommunication. Another family complained that they've had 5 different providers in one week when they specifically requested consistency.
// class Case(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     family_id: int = Field(foreign_key="family.id")
//     title: str #Title of request
//     required_skills: str #"doulas", "lactation consultants", "nurses" 
    
// class Shift(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     case_id: int = Field(foreign_key="case.id")
//     starts: datetime #start time
//     ends: datetime #end time
//     zip: str #location of shift 
//     required_skills: str #"doulas", "lactation consultants", "nurses"
    
// class Assignment(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     shift_id: int = Field(foreign_key="shift.id")
//     provider_id: int = Field(foreign_key="provider.id")
//     status: str = "requested" #"requested", "confirmed", "declined"
//     message: str = "" #description for assignment given by provider
 
//     #Unique Constraint to prevent provider being added to the same shift twice
//     __table_args__ = (UniqueConstraint("shift_id", "provider_id", name="uq_shift_provider")),


export default function SchedulePage() {

  return (
    <div/>
  );
}
