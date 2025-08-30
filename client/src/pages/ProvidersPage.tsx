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

    const { data: providers = [], isLoading, error } = useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<Provider[]> =>
      (await axios.get(`${BASE_URL}/providers`)).data,
  });

  const [form, setForm] = useState<Provider>({
    name: "",
    home_zip: "",
    max_hours: 40,
    active: true,
    skills: "",
  });

  const create = useMutation({
    mutationFn: async (p: Provider) =>
      (await axios.post(`${BASE_URL}/providers`, p)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      setForm({ name: "", home_zip: "", max_hours: 40, active: true, skills: "" });
    },
  });

  const canSubmit =
    form.name.trim().length > 0 &&
    form.home_zip.trim().length >= 5 &&
    Number.isFinite(form.max_hours) &&
    form.max_hours > 0;

  return (
    <>
      <style>{`
        .sheet { max-width: 900px; margin: 0 auto; padding: 16px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; color:#111; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .title { font-weight:600; }
        .muted { color:#666; font-size:12px; }
        .err { color:#b00020; font-size:12px; margin:6px 0; }

        .grid { display:grid; grid-template-columns: 1fr; gap:14px; }

        .tablewrap { border:1px solid #d0d7de; border-radius:4px; overflow:auto; }
        table { width:100%; border-collapse: collapse; font-size:13px; background:#fff; }
        thead th { position: sticky; top: 0; background:#f6f8fa; z-index: 1; }
        th, td { border:1px solid #d0d7de; padding:6px 8px; text-align:left; white-space:nowrap; }
        tbody tr:nth-child(even) td { background:#fcfcfd; }

        .form { border:1px solid #d0d7de; border-radius:4px; padding:10px; display:grid; grid-template-columns: repeat(6, 1fr); gap:8px; align-items:end; }
        .form label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#444; }
        .form input[type="text"], .form input[type="number"] { border:1px solid #c8cdd4; border-radius:4px; padding:6px 8px; font-size:13px; }
        .form .check { display:flex; align-items:center; gap:6px; }
        .btn { appearance:none; border:1px solid #c8cdd4; background:#f6f8fa; padding:6px 10px; border-radius:4px; font-size:12px; cursor:pointer; }
        .btn:hover { background:#eef1f4; }
        .btn[disabled]{ opacity:.6; cursor:not-allowed; }
        @media (max-width: 800px) {
          .form { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="sheet">
        <div className="toolbar">
          <div>
            <div className="title">Providers</div>
            <div className="muted">Add and View Providers</div>
          </div>
        </div>

        {/* Create form */}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate(form);
          }}
        >
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder=""
            />
          </label>

          <label>
            Home ZIP
            <input
              type="text"
              value={form.home_zip}
              onChange={(e) => setForm({ ...form, home_zip: e.target.value })}
              placeholder="98102, 98103, .."
            />
          </label>

          <label>
            Max hours
            <input
              type="number"
              value={form.max_hours}
              onChange={(e) =>
                setForm({ ...form, max_hours: Number(e.target.value) })
              }
              min={1}
            />
          </label>

          <label>
            Skills 
            <input
              type="text"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="Doula, Nurse, Lactation"
            />
          </label>

          <label className="check" title="Active">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <button className="btn" type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Saving…" : "Add Provider"}
          </button>
        </form>

        {/* Table */}
        <div style={{ marginTop: 12 }} className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>ZIP</th>
                <th>Max hrs</th>
                <th>Active</th>
                <th>Skills</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="muted">Loading…</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="err">Failed to load providers.</td>
                </tr>
              )}
              {!isLoading && !error && providers.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">No providers yet.</td>
                </tr>
              )}
              {providers.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.home_zip}</td>
                  <td style={{ textAlign: "right" }}>{p.max_hours}</td>
                  <td>{p.active ? "Yes" : "No"}</td>
                  <td>{p.skills || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </>
  );
}

