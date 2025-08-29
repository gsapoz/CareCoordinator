from typing import Optional, List
from datetime import datetime, time
from sqlmodel import SQLModel, Field, Relationship

#SPECS
# You've just been hired by a growing healthcare startup that's struggling with their care team scheduling. 
#   They have care providers 
#    - doulas 
#    - lactation consultants
#    - nurses serving families across the Greater Seattle Area, 
# Yesterday, they had a crisis: 
#    A family urgently needed overnight newborn care support, but the coordinator spent 3 hours calling providers to find someone available and qualified. 
#    Two providers showed up because of a miscommunication. Another family complained that they've had 5 different providers in one week when they specifically 
#     requested consistency.
# The company has providers with different specialties, availability patterns, and preferences. 
# Families need various types of care at different times. Some of them requested consistency, while others can work with multiple providers.

#Problem 1
# Families need various types of care at different times. Some of them requested consistency, while others can work with multiple providers.
class Family(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    zip: str
    continuity_preference : str

#Problem 2
# The company has providers with different specialties, availability patterns, and preferences. 
class Provider(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    home_zip: str
    max_hours: int = 40
    active: bool = True

class ProviderSkill(SQLModel, table=True):
    provider_id: int = Field(foreign_key="provider.id", primary_key=True)
    skill: str = Field(primary_key=True)

class ProviderAvailability(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="provider.id")
    weekday: int #0-6 Monday - Sunday
    start: time
    end: time

#Problem 3
#A family urgently needed overnight newborn care support, but the coordinator spent 3 hours calling providers to find someone available and qualified. 
# Two providers showed up because of a miscommunication. Another family complained that they've had 5 different providers in one week when they specifically requested consistency.
class Case(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    family_id: int = Field(foreign_key="family.id")
    title: str #Title of request
    required_skills: str #"doulas", "lactation consultants", "nurses"
    
class Shift(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: int = Field(foreign_key="case.id")
    starts: datetime #start time
    ends: datetime #end time
    zip: str #location of shift 
    required_skills: str #"doulas", "lactation consultants", "nurses"
    
class Assignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shift_id: int = Field(foreign_key="shift.id")
    provider_id: int = Field(foreign_key="provider.id")
    status: str = "requested" #"requested", "confirmed", "declined"
    message: str = "" #description for assignment given by provider

