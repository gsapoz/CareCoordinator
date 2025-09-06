import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "http://localhost:8000";

//TO-DO (URGENT):::: 
//******** */
//******** */
//Set Availability (Days of the week provider can work)
//******* */
//******** */

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
  active: boolean;
  skills: string; 
};

// class ProviderAvailability(SQLModel, table=True):
//     id: Optional[int] = Field(default=None, primary_key=True)
//     provider_id: int = Field(foreign_key="provider.id")
//     weekday: int #0-6 Monday - Sunday
//     start: time
//     end: time

type Availability = {
  id?: number;
  provider_id: number;
  weekday: number; // 0-6
  start: string; //HH:MM
  end: string; //HH:MM
}

const DAYS_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_TITLES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DEFAULT_START = "08:00";
const DEFAULT_END   = "18:00";

const SKILL_OPTIONS = [
  "Doula",
  "Nurse", 
  "Lactation Consultant"
] as const;

export default function ProvidersPage() {
  const qc = useQueryClient();

    const { data: providers = [], isLoading, error } = useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<Provider[]> =>
      (await axios.get(`${BASE_URL}/providers`)).data,
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["availability"],
    queryFn: async (): Promise<Availability[]> => (await axios.get(`${BASE_URL}/availability`)).data,
  });

   // Query/Map for ProviderAvailability to weekday selection
  const availMap = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const row of availability) {
      if (!m.has(row.provider_id)) m.set(row.provider_id, new Set());
      m.get(row.provider_id)!.add(row.weekday);
    }
    return m;
  }, [availability]);

  const [form, setForm] = useState<Provider>({
    name: "",
    home_zip: "",
    active: true,
    skills: "",
  });
  // Declare dependencies for availability selections dropdown and display
  const [daysDropdownOpen, setDaysDropdownOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set()); 
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDaysDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

   const toggleDayInForm = (idx: number) => {
    const next = new Set(selectedDays);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedDays(next);
  };

  const [skillsOpen, setSkillsOpen] = useState(false);
  const skillsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (skillsRef.current && !skillsRef.current.contains(e.target as Node)) {
        setSkillsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Helpers to manage CSV <-> Set
  const skillsSet = useMemo(() => {
    return new Set(
      form.skills
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
    );
  }, [form.skills]);

  const toggleSkillInForm = (skill: string) => {
    const next = new Set(skillsSet);
    if (next.has(skill)) next.delete(skill);
    else next.add(skill);
    // back to CSV
    setForm(f => ({ ...f, skills: Array.from(next).join(",") }));
  };

  // Mutations
  const createProvider = useMutation({
    mutationFn: async (p: Provider) =>
      (await axios.post(`${BASE_URL}/providers`, p)).data as Provider,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });

  const bulkCreateAvailability = useMutation({
    mutationFn: async (items: Availability[]) =>
      (await axios.post(`${BASE_URL}/availability/bulk`, { items })).data as Availability[],
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });

  // Toggle each day in provider row
  const toggleDayForProvider = useMutation({
    mutationFn: async (payload: { provider_id: number; weekday: number; isOn: boolean }) => {
      const { provider_id, weekday, isOn } = payload;
      if (isOn) {
        // Delete 
        await axios.delete(`${BASE_URL}/availability/by-key`, {
          data: { provider_id, weekday, start: DEFAULT_START, end: DEFAULT_END },
          headers: { "Content-Type": "application/json" }, //sometimes the API receives content instead of JSON so this prevents 422 error
        });
        return { toggled: "off", provider_id, weekday };
      } else {
        // Create 
        await axios.post(`${BASE_URL}/availability`, {
          provider_id,
          weekday,
          start: DEFAULT_START,
          end: DEFAULT_END,
        });
        return { toggled: "on", provider_id, weekday };
      }
    },
    onMutate: async ({ provider_id, weekday, isOn }) => {
      await qc.cancelQueries({ queryKey: ["availability"] });
      const prev = qc.getQueryData<Availability[]>(["availability"]) || [];
      let next: Availability[];
      if (isOn) {
        // remove
        next = prev.filter(
          a =>
            !(
              a.provider_id === provider_id &&
              a.weekday === weekday &&
              a.start === DEFAULT_START &&
              a.end === DEFAULT_END
            )
        );
      } else {
        // add
        next = prev.concat([{ provider_id, weekday, start: DEFAULT_START, end: DEFAULT_END }]);
      }
      qc.setQueryData(["availability"], next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["availability"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });

  const canSubmit =
    form.name.trim().length > 0 &&
    form.home_zip.trim().length >= 5 

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const created = await createProvider.mutateAsync(form);

    if (created?.id && selectedDays.size > 0) {
      const items: Availability[] = Array.from(selectedDays).map((weekday) => ({
        provider_id: created.id!,
        weekday,
        start: DEFAULT_START,
        end: DEFAULT_END,
      }));
      await bulkCreateAvailability.mutateAsync(items);
    }

    // reset form
    setForm({ name: "", home_zip: "", active: true, skills: "" });
    setSelectedDays(new Set());
    setDaysDropdownOpen(false);
  }

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
        @media (max-width: 800px) { .form { grid-template-columns: 1fr 1fr; } }

        /* NEW: Days dropdown + chips */
        .dropdown { position: relative; }
        .dropdownBtn { border:1px solid #c8cdd4; background:#fff; padding:6px 10px; border-radius:4px; font-size:12px; cursor:pointer; width:100%; text-align:left; }
        .dropdownMenu { position:absolute; top:100%; left:0; width: 220px; background:#fff; border:1px solid #d0d7de; border-radius:4px; padding:8px; z-index:10; box-shadow: 0 4px 10px rgba(0,0,0,.06); }
        .dayOption { display:flex; align-items:center; gap:8px; padding:4px 0; }
        .dayOption input { transform: translateY(1px); }

        .daygroup { display:flex; gap:4px; }
        .daybtn { border:1px solid #c8cdd4; background:#fff; padding:3px 7px; border-radius:4px; font-size:12px; cursor:pointer; }
        .daybtn.on { background:#e6f2ff; border-color:#7fb3ff; }
        .daybtn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>

      <div className="sheet">
        <div className="toolbar">
          <div>
            <div className="title">Providers</div>
            <div className="muted">Add and View Providers</div>
          </div>
          <a href="../">
            <button>Back to Home Page</button>
          </a>
        </div>

        <form className="form" onSubmit={handleCreate}>
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

          <div className="dropdown" ref={skillsRef}>
            <button type="button" className="dropdownBtn" onClick={() => setSkillsOpen(s => !s)}>
              {skillsSet.size === 0 ? "Skills ▾" : `${skillsSet.size} selected ▾`}
            </button>
            {skillsOpen && (
              <div className="dropdownMenu">
                {SKILL_OPTIONS.map((skill) => (
                  <label key={skill} className="optionRow">
                    <input
                      type="checkbox"
                      checked={skillsSet.has(skill)}
                      onChange={() => toggleSkillInForm(skill)}
                    />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="dropdown" ref={dropdownRef}>
            <button
              type="button"
              className="dropdownBtn"
              onClick={() => setDaysDropdownOpen((s) => !s)}
            >
              Days Available ▾
            </button>
            {daysDropdownOpen && (
              <div className="dropdownMenu">
                {DAYS_TITLES.map((label, idx) => (
                  <label key={idx} className="dayOption">
                    <input
                      type="checkbox"
                      checked={selectedDays.has(idx)}
                      onChange={() => toggleDayInForm(idx)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="check" title="Active">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <button className="btn" type="submit" disabled={!canSubmit || createProvider.isPending}>
            {createProvider.isPending ? "Saving…" : "Add Provider"}
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
                <th>Days Available</th>
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

              {providers.map((p) => {
                const set = availMap.get(p.id!) ?? new Set<number>();
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.home_zip}</td>
                    <td>
                      <div className="daygroup">
                        {DAYS_FULL.map((lbl, i) => {
                          const isOn = set.has(i);
                          return (
                            <button
                              key={i}
                              className={`daybtn ${isOn ? "on" : ""}`}
                              title={DAYS_TITLES[i]}
                              disabled={toggleDayForProvider.isPending}
                              onClick={(e) => {
                                e.preventDefault();
                                toggleDayForProvider.mutate({
                                  provider_id: p.id!,
                                  weekday: i,
                                  isOn,
                                });
                              }}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td>{p.active ? "Yes" : "No"}</td>
                    <td>{p.skills || "—"}</td>
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
