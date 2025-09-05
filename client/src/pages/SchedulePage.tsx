import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

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

type Shift = { 
  id: number; 
  //case_id: number; 
  starts: string; 
  ends: string; 
  zip: string; 
  required_skills: string 
};

type Provider = {
  id: number;
  name: string;
  home_zip: string;
  active: boolean;
  skills: string; // CSV
};

type Assignment = { 
  id?: number; 
  shift_id?: number; 
  provider_id?: number | null; 
  status: string; 
  message?: string 
};

export default function SchedulePage() {
  const qc = useQueryClient();

  const { data: shifts = [], isLoading: shiftsLoading, error: shiftsError } = useQuery({
    queryKey: ["shifts"],
    queryFn: async (): Promise<Shift[]> => (await axios.get(`${BASE_URL}/shifts`)).data,
  });

  const { data: providers = [], isLoading: provLoading, error: provError } = useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<Provider[]> => (await axios.get(`${BASE_URL}/providers`)).data,
  });

  const { data: assignments = [], isLoading: asgLoading, error: asgError } = useQuery({
    queryKey: ["assignments"],
    queryFn: async (): Promise<Assignment[]> => (await axios.get(`${BASE_URL}/assignments`)).data,
  });

  const run = useMutation({
    mutationFn: async () => (await axios.post(`${BASE_URL}/schedule/run?start=2025-08-25&end=2025-09-01`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
  });


  const generateData = useMutation({
    mutationFn: async () =>
      (await axios.post(`${BASE_URL}/ai/autogen`, {
        n_providers: 8,   
        n_shifts: 16,     
        zip_pool: ["98101","98103","98107","98109","98115","98052"]
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  const totals = useMemo(() => {
    const total = shifts.length;
    const filled = assignments.filter(a => a.provider_id != null).length;
    return { total, filled, unfilled: Math.max(total - filled, 0) };
  }, [shifts, assignments]);

  return (
    <> {/* To-DO: Tailwind for inline CSS or move everything to index.css */}
      <style>{`
        .sheet {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
          font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
          color: #111;
          background: #fff;
        }
        .toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .toolbar .title { font-weight: 600; }
        .toolbar .meta { color: #666; font-size: 12px; }
        .btn {
          appearance: none;
          border: 1px solid #c8cdd4;
          background: #f6f8fa;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn:hover { background: #eef1f4; }
        .btn[disabled] { opacity: .6; cursor: not-allowed; }

        .kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          margin: 8px 0 14px;
        }
        .kpis div {
          border: 1px solid #d0d7de;
          padding: 6px 8px;
          border-radius: 4px;
          background: #fff;
        }
        .kpis .label { color: #666; font-size: 12px; }
        .kpis .value { font-weight: 600; margin-top: 2px; }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 14px;
        }
        @media (min-width: 980px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }

        .tablewrap {
          border: 1px solid #d0d7de;
          border-radius: 4px;
          overflow: auto;
          max-height: 60vh; /* spreadsheet scroll */
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          background: #fff;
        }
        thead th {
          position: sticky;
          top: 0;
          background: #f6f8fa;
          z-index: 1;
        }
        th, td {
          border: 1px solid #d0d7de; /* gridlines */
          padding: 6px 8px;
          text-align: left;
          white-space: nowrap;
        }
        tbody tr:nth-child(even) td { background: #fcfcfd; } /* subtle zebra */
        .muted { color: #666; }
        .err { color: #b00020; font-size: 12px; margin: 6px 0; }
      `}</style>

      <div className="sheet">
        <div className="toolbar">
          <div>
            <div className="title">Provider Appointment Scheduler</div>
            <div className="meta">Click "Run Scheduler" to automatically assign Providers to Shifts</div>
            <div className="meta">Click "Generate Data" to automatically generate Providers and Shifts</div>
          </div>
          <button
            className="btn"
            onClick={() => generateData.mutate()}
            disabled={generateData.isPending}
          >
            {generateData.isPending ? "Generating…" : "Generate Data"}
          </button>
          <button className="btn" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Scheduling…" : "Run Scheduler"}
          </button>
        </div>

        <div className="kpis">
          <div><div className="label">Total Shifts</div><div className="value">{totals.total}</div></div>
          <div><div className="label">Filled Shifts </div><div className="value">{totals.filled}</div></div>
          <div><div className="label">Unfilled Shifts</div><div className="value">{totals.unfilled}</div></div>
        </div>

        <div className="grid2">

          {/* Providers */}
          <div>
            <div className="sectionTitle">Providers</div>
            <div className="meta">Click "Generate Data" in the header to automatically generate Providers</div>
            <div className="meta">To manually add and track your own proivders, <a href="providers">click here</a></div>
            {provLoading && <div className="muted">Loading…</div>}
            {provError && <div className="err">Failed to load providers.</div>}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>ZIP</th><th>Skills</th><th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.length > 0 ? providers.map((p) => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.home_zip}</td>
                      <td>{p.skills || "—"}</td>
                      <td>{p.active ? "Yes" : "No"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="muted">No providers.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <br />
          {/* Shifts */}
          <div>
            <div className="sectionTitle">Shifts</div>
            <div className="meta">Click "Generate Data" in the header to automatically generate Shifts</div>
            <div className="meta">To manually add and track your own shifts, <a href="shifts">click here</a></div>
            {shiftsLoading && <div className="muted">Loading…</div>}
            {shiftsError && <div className="err">Failed to load shifts.</div>}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Starts</th><th>Ends</th><th>Required Skill</th><th>ZIP</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length > 0 ? shifts.map((s) => (
                    <tr key={s.id}>
                      <td>#{s.id}</td>
                      <td>{new Date(s.starts).toLocaleString()}</td>
                      <td>{new Date(s.ends).toLocaleString()}</td>
                      <td>{s.required_skills}</td>
                      <td>{s.zip}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="muted">No shifts.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Provider Assignments  */}
        <div style={{ marginTop: 14 }}>
          <div className="sectionTitle">Provider Shift Assignments</div>
          
          {asgLoading && <div className="muted">Loading…</div>}
          {asgError && <div className="err">Failed to load assignments.</div>}
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Shift</th><th>Provider</th><th>Status</th><th>Message</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length > 0 ? assignments.map((a) => (
                  <tr key={a.id ?? a.shift_id}>
                    <td>#{a.shift_id}</td>
                    <td>{a.provider_id ?? <span className="muted">unfilled</span>}</td>
                    <td>{a.status ?? ""}</td>
                    <td className="muted">{a.message || ""}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="muted">No assignments.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}