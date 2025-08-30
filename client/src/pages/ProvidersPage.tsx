import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const BASE_URL = "http://localhost:8000";

// #Problem 2
// # The company has providers with different specialties, availability patterns, and preferences. 
// class Provider(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     name: str
//     home_zip: str
//     max_hours: int = 40
//     skills: str #doulas, nurses, lactation specialists - comma seperated
//     active: bool = True

// class ProviderAvailability(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     provider_id: int = Field(foreign_key="provider.id")
//     weekday: int #0-6 Monday - Sunday
//     start: time
//     end: time

type Provider = {
  id?: number;
  name: string;
  home_zip: string;
  max_hours: number;
  active: boolean;
  skills: string; 
};

export default function ProvidersPage() {
  const qc = useQueryClient();

  

  const [form, setForm] = useState<Provider>({
    name: "",
    home_zip: "",
    max_hours: 40,
    active: true,
    skills: "",
  });



  return (
    <div style={{ padding: 1 }}>
      
    </div>
  );
}
