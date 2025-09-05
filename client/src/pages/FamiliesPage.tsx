import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "http://localhost:8000";

type Family = {
  id?: number;
  name: string;
  zip: string;
  continuity_preference: string; // "consistent" | "flexible"
};

const PREFS = ["consistent", "flexible"] as const;

export default function FamiliesPage() {
  const qc = useQueryClient();

  const { data: families = [], isLoading, error } = useQuery({
    queryKey: ["families"],
    queryFn: async (): Promise<Family[]> => (await axios.get(`${BASE_URL}/families`)).data,
  });

  const [form, setForm] = useState<Family>({
    name: "",
    zip: "",
    continuity_preference: "consistent",
  });

  const create = useMutation({
    mutationFn: async (f: Family) => (await axios.post(`${BASE_URL}/families`, f)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      setForm({ name: "", zip: "", continuity_preference: "consistent" });
    },
  });

  const canSubmit =
    form.name.trim().length > 0 &&
    form.zip.trim().length >= 5 &&
    PREFS.includes(form.continuity_preference as any);

  return (
    <>
      <style>{`
        .sheet { max-width: 900px; margin: 0 auto; padding: 16px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; color:#111; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .title { font-weight:600; }
        .muted { color:#666; font-size:12px; }
        .err { color:#b00020; font-size:12px; margin:6px 0; }

        .form { border:1px solid #d0d7de; border-radius:4px; padding:10px; display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; align-items:end; }
        .form label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#444; }
        .form input[type="text"], .form select { border:1px solid #c8cdd4; border-radius:4px; padding:6px 8px; font-size:13px; }
        .btn { appearance:none; border:1px solid #c8cdd4; background:#f6f8fa; padding:6px 10px; border-radius:4px; font-size:12px; cursor:pointer; }
        .btn:hover { background:#eef1f4; }
        .btn[disabled]{ opacity:.6; cursor:not-allowed; }

        .tablewrap { border:1px solid #d0d7de; border-radius:4px; overflow:auto; margin-top:12px; }
        table { width:100%; border-collapse: collapse; font-size:13px; background:#fff; }
        thead th { position: sticky; top: 0; background:#f6f8fa; z-index: 1; }
        th, td { border:1px solid #d0d7de; padding:6px 8px; text-align:left; white-space:nowrap; }
        tbody tr:nth-child(even) td { background:#fcfcfd; }
      `}</style>

      <div className="sheet">
        <div className="toolbar">
          <div>
            <div className="title">Families</div>
            <div className="muted">Create and view families; preference drives continuity scheduling.</div>
          </div>
        </div>

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
            Continuity preference
            <select
              value={form.continuity_preference}
              onChange={(e) => setForm({ ...form, continuity_preference: e.target.value })}
            >
              {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <button className="btn" type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Saving…" : "Add Family"}
          </button>
        </form>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>ZIP</th><th>Prefers continuity</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="muted">Loading…</td></tr>}
              {error && <tr><td colSpan={4} className="err">Failed to load families.</td></tr>}
              {!isLoading && !error && families.length === 0 && (
                <tr><td colSpan={4} className="muted">No families yet.</td></tr>
              )}
              {families.map((f) => (
                <tr key={f.id}>
                  <td>#{f.id}</td>
                  <td>{f.name}</td>
                  <td>{f.zip}</td>
                  <td>{(f.continuity_preference || "").toLowerCase() === "consistent" ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
