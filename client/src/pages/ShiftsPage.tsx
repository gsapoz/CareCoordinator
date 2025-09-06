import { useState, useMemo } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "http://localhost:8000";

type Family = {
  id: number;
  name: string;
  zip: string;
  continuity_preference: string;
};

type Shift = {
  id?: number;
  family_id: number;
  starts: string;
  ends: string;
  zip: string;
  required_skills: string;
};

const SKILL_OPTIONS = ["Doula", "Nurse", "Lactation Consultant"] as const;

export default function ShiftsPage() {
  const qc = useQueryClient();

  // ---- Queries ----
  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["shifts"],
    queryFn: async (): Promise<Shift[]> => (await axios.get(`${BASE_URL}/shifts`)).data,
  });

  const { data: families = [], isLoading: famLoading, error: famError } = useQuery({
    queryKey: ["families"],
    queryFn: async (): Promise<Family[]> => (await axios.get(`${BASE_URL}/families`)).data,
  });

  const familyMap = useMemo(() => {
    const m = new Map<number, Family>();
    for (const f of families) m.set(f.id, f);
    return m;
  }, [families]);

  // ---- Form state ----
  const [form, setForm] = useState<{
    family_id: string;       // selected family id (string in form)
    startsLocal: string;     // "YYYY-MM-DDTHH:mm"
    endsLocal: string;       // "YYYY-MM-DDTHH:mm"
    zip: string;
    required_skills: string;
  }>({
    family_id: "",
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

  // ---- Helpers ----
  const canSubmit =
    form.family_id.trim().length > 0 &&
    form.startsLocal.trim().length > 0 &&
    form.endsLocal.trim().length > 0 &&
    form.zip.trim().length >= 5 &&
    form.required_skills.trim().length > 0;

  function toISO(localValue: string) {
    const d = new Date(localValue); // interpreted as local time
    return d.toISOString();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload: Shift = {
      family_id: Number(form.family_id),
      starts: toISO(form.startsLocal),
      ends: toISO(form.endsLocal),
      zip: form.zip.trim(),
      required_skills: form.required_skills.trim(),
    };

    await createShift.mutateAsync(payload);

    // reset
    setForm({
      family_id: "",
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
        .form input[type="text"], .form input[type="number"], .form input[type="datetime-local"], .form select { border:1px solid #c8cdd4; border-radius:4px; padding:6px 8px; font-size:13px; }
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
          <a href="../">
            <button>Back to Home Page</button>
          </a>
        </div>

        <form className="form" onSubmit={handleCreate}>
          <label>
            Family
            <select
              value={form.family_id}
              onChange={(e) => setForm({ ...form, family_id: e.target.value })}
              disabled={famLoading || !!famError}
            >
              <option value="">{famLoading ? "Loading families…" : "Select a family…"}</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} (#{f.id}) – {f.zip}
                </option>
              ))}
            </select>
          </label>

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
              placeholder="98101, 98102, 98103 ..."
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
          <button className="btn" type="submit" disabled={!canSubmit || createShift.isPending}>
            {createShift.isPending ? "Saving…" : "Add Shift"}
          </button>

          {famError && <div className="err" style={{ gridColumn: "1 / -1" }}>Failed to load families.</div>}
        </form>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Case ID (Family))</th>
                <th>Begins</th>
                <th>Ends</th>
                <th>ZIP</th>
                <th>Skills</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="muted">Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={7} className="err">Failed to load shifts.</td></tr>
              )}
              {!isLoading && !error && shifts.length === 0 && (
                <tr><td colSpan={7} className="muted">No shifts yet.</td></tr>
              )}

              {shifts.map((s) => {
                const fam = s.family_id ? familyMap.get(s.family_id) : undefined;
                return (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{fam ? `${fam.id} (${fam.name})` : s.family_id ?? "—"}</td>
                    <td>{fmt(s.starts)}</td>
                    <td>{fmt(s.ends)}</td>
                    <td>{s.zip}</td>
                    <td>{s.required_skills || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
