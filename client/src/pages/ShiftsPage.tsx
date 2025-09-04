import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "http://localhost:8000";
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


// type Shift = {
//   id?: number;
//   case_id: number;
//   starts: string; 
//   ends: string;   
//   zip: string;
//   required_skills: string; // 
// };

// export default function ShiftsPage() {
//   const qc = useQueryClient();


//   return (
//     <div/>
//   )
// }

type Shift = {
  id?: number;
  // case_id: number;
  starts: string;        
  ends: string;          
  zip: string;
  required_skills: string; 
};

const SKILL_OPTIONS = [
  "Doula",
  "Nurse", 
  "Lactation Consultant"
] as const;

export default function ShiftsPage() {
  const qc = useQueryClient();

  // ---- Query ----
  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["shifts"],
    queryFn: async (): Promise<Shift[]> => (await axios.get(`${BASE_URL}/shifts`)).data,
  });

  // ---- Form state ----
  const [form, setForm] = useState<{
    // case_id: string;
    startsLocal: string; // "YYYY-MM-DDTHH:mm"
    endsLocal: string;   // "YYYY-MM-DDTHH:mm"
    zip: string;
    required_skills: string;
  }>({
    // case_id: "",
    startsLocal: "",
    endsLocal: "",
    zip: "",
    required_skills: "",
  });

  // ---- Mutations ----
  const createShift = useMutation({
    mutationFn: async (payload: Shift) => (await axios.post(`${BASE_URL}/shifts`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: number) => (await axios.delete(`${BASE_URL}/shifts/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  // ---- Helpers ----
  const canSubmit =
    // form.case_id.trim().length > 0 &&
    form.startsLocal.trim().length > 0 &&
    form.endsLocal.trim().length > 0 &&
    form.zip.trim().length >= 5;

  function toISO(localValue: string) {
    // local datetime -> ISO string
    // new Date(localValue) interprets as local time
    const d = new Date(localValue);
    return d.toISOString();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: Shift = {
      // case_id: Number(form.case_id),
      starts: toISO(form.startsLocal),
      ends: toISO(form.endsLocal),
      zip: form.zip.trim(),
      required_skills: form.required_skills.trim(),
    };

    await createShift.mutateAsync(payload);

    // reset
    setForm({
      // case_id: "",
      startsLocal: "",
      endsLocal: "",
      zip: "",
      required_skills: "",
    });
  }

  function fmt(dt: string) {
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  return (
    <>
      <style>{`
        .sheet { max-width: 1000px; margin: 0 auto; padding: 16px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; color:#111; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .title { font-weight:600; }
        .muted { color:#666; font-size:12px; }
        .err { color:#b00020; font-size:12px; margin:6px 0; }

        .form { border:1px solid #d0d7de; border-radius:4px; padding:10px; display:grid; grid-template-columns: repeat(8, 1fr); gap:8px; align-items:end; }
        .form label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#444; }
        .form input[type="text"], .form input[type="number"], .form input[type="datetime-local"] { border:1px solid #c8cdd4; border-radius:4px; padding:6px 8px; font-size:13px; }
        .btn { appearance:none; border:1px solid #c8cdd4; background:#f6f8fa; padding:6px 10px; border-radius:4px; font-size:12px; cursor:pointer; }
        .btn:hover { background:#eef1f4; }
        .btn[disabled]{ opacity:.6; cursor:not-allowed; }
        @media (max-width: 980px) { .form { grid-template-columns: 1fr 1fr; } }

        .tablewrap { border:1px solid #d0d7de; border-radius:4px; overflow:auto; margin-top:12px; }
        table { width:100%; border-collapse: collapse; font-size:13px; background:#fff; }
        thead th { position: sticky; top: 0; background:#f6f8fa; z-index: 1; }
        th, td { border:1px solid #d0d7de; padding:6px 8px; text-align:left; white-space:nowrap; }
        tbody tr:nth-child(even) td { background:#fcfcfd; }

        .rowactions { display:flex; gap:6px; }
      `}</style>

      <div className="sheet">
        <div className="toolbar">
          <div>
            <div className="title">Shifts</div>
            <div className="muted">Create and manage available shifts for providers to fill for families</div>
          </div>
        </div>

        {/* To-DO: In production environment we need a more detailed form since families would be the ones to request these Provider shifts */}
        <form className="form" onSubmit={handleCreate}>
          {/* <label>
            Case ID
            <input
              type="number"
              value={form.case_id}
              onChange={(e) => setForm({ ...form, case_id: e.target.value })}
              placeholder="e.g. 1"
              min={1}
            />
          </label> */}

          <label>
            Starts
            <input
              type="datetime-local"
              value={form.startsLocal}
              onChange={(e) => setForm({ ...form, startsLocal: e.target.value })}
            />
          </label>

          <label>
            Ends
            <input
              type="datetime-local"
              value={form.endsLocal}
              onChange={(e) => setForm({ ...form, endsLocal: e.target.value })}
            />
          </label>

          <label>
            ZIP
            <input
              type="text"
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              placeholder="98107"
            />
          </label>

          <label>
            Required skill
            <select
              value={form.required_skills}
              onChange={(e) => setForm({ ...form, required_skills: e.target.value })}
            >
              <option value="">Select…</option>
              {SKILL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <div />
          <div />

          <button className="btn" type="submit" disabled={!canSubmit || createShift.isPending}>
            {createShift.isPending ? "Saving…" : "Add Shift"}
          </button>
        </form>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                {/* <th>Case</th> */}
                <th>Begins</th>
                <th>Ends</th>
                <th>ZIP</th>
                <th>Skills</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="muted">Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={6} className="err">Failed to load shifts.</td></tr>
              )}
              {!isLoading && !error && shifts.length === 0 && (
                <tr><td colSpan={6} className="muted">No shifts yet.</td></tr>
              )}

              {shifts.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  {/* <td>{s.case_id}</td> */}
                  <td>
                    <div>
                      <div>{fmt(s.starts)}</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div>{fmt(s.ends)}</div>
                    </div>
                  </td>
                  <td>{s.zip}</td>
                  <td>{s.required_skills || "—"}</td>
                  <td>
                    <div className="rowactions">
                      <button
                        className="btn"
                        onClick={(e) => {
                          e.preventDefault();
                          if (s.id) deleteShift.mutate(s.id);
                        }}
                        disabled={deleteShift.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
