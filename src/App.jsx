import React, { useState, useMemo, useEffect } from "react";

/* ---------------- SIMPLE UI COMPONENTS ---------------- */

const Card = ({ children }) => (
  <div style={{
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    background: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,.05)"
  }}>
    {children}
  </div>
);

const Button = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 12px",
      borderRadius: 6,
      border: "1px solid #bbb",
      cursor: "pointer",
      background: "#f5f5f5"
    }}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      padding: 6,
      borderRadius: 6,
      border: "1px solid #bbb",
      width: "100%"
    }}
  />
);

const Select = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: 6,
      borderRadius: 6,
      border: "1px solid #bbb",
      width: "100%"
    }}
  >
    {children}
  </select>
);

/* ---------------- CONFIG ---------------- */

const frequencyDays = {
  Daily: 1,
  "Every 2 Days": 2,
  Weekly: 7,
  Biweekly: 14,
  Monthly: 30,
};

/* ---------------- AI Suggestions ---------------- */

function generateSuggestions(chores) {
  const names = chores.map((c) => c.name.toLowerCase());
  const suggestions = [];

  if (!names.includes("clean microwave"))
    suggestions.push({ name: "Clean Microwave", room: "Kitchen", frequency: "Monthly" });

  if (!names.includes("vacuum stairs"))
    suggestions.push({ name: "Vacuum Stairs", room: "Living Areas", frequency: "Weekly" });

  if (!names.includes("test smoke detectors"))
    suggestions.push({ name: "Test Smoke Detectors", room: "Whole House", frequency: "Monthly" });

  return suggestions;
}

function nextDueDate(chore) {
  if (!chore.lastCompleted) return new Date();

  const days = frequencyDays[chore.frequency] || 7;
  const next = new Date(chore.lastCompleted);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ---------------- Local Storage ---------------- */

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [value]);

  return [value, setValue];
}

/* ================================================== */

export default function EliteChoreManager() {

  const [chores, setChores] = useLocalStorage("elite-chores", []);
  const [members] = useLocalStorage("elite-members", ["Mother", "Father"]);

  const [tab, setTab] = useState("today");

  const [newChore, setNewChore] = useState({
    name: "",
    room: "Kitchen",
    frequency: "Weekly",
    owner: members[0],
  });

  const [editing, setEditing] = useState(null);

  /* -------- Scheduling -------- */

  const calendar = useMemo(() => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);

      const due = chores.filter((c) => isSameDay(nextDueDate(c), d));
      days.push({ date: d, chores: due });
    }

    return days;
  }, [chores]);

  const dueToday = useMemo(() => {
    const today = new Date();
    return chores.filter((c) => isSameDay(nextDueDate(c), today));
  }, [chores]);

  const suggestions = useMemo(() => generateSuggestions(chores), [chores]);

  /* -------- Actions -------- */

  function addChore(chore = newChore) {
    if (!chore.name) return;

    setChores([
      ...chores,
      { ...chore, id: Date.now(), lastCompleted: null }
    ]);

    setNewChore({
      name: "",
      room: "Kitchen",
      frequency: "Weekly",
      owner: members[0],
    });
  }

  function completeChore(id) {
    setChores((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, lastCompleted: new Date() } : c
      )
    );
  }

  function deleteChore(id) {
    setChores((prev) => prev.filter((c) => c.id !== id));
  }

  function saveEdit() {
    setChores((prev) =>
      prev.map((c) => (c.id === editing.id ? editing : c))
    );
    setEditing(null);
  }

  /* ================================================== */

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      <h1>Elite Household Manager</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["today", "calendar", "chores", "ai"].map((t) => (
          <Button key={t} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* TODAY */}
      {tab === "today" && (
        <Card>
          <h2>Focus Today</h2>

          {dueToday.length === 0 && <p>Nothing due 🎉</p>}

          {dueToday.map((chore) => (
            <div key={chore.id} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <b>{chore.name}</b>
                <div style={{fontSize:12}}>
                  {chore.room} • {chore.owner}
                </div>
              </div>

              <Button onClick={() => completeChore(chore.id)}>
                Done
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* CALENDAR */}
      {tab === "calendar" && (
        <div>
          {calendar.map((day, i) => (
            <Card key={i}>
              <b>
                {day.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </b>

              {day.chores.length === 0
                ? <div>No chores</div>
                : day.chores.map((c) => (
                    <div key={c.id}>{c.name}</div>
                  ))}
            </Card>
          ))}
        </div>
      )}

      {/* CHORES */}
      {tab === "chores" && (
        <Card>
          <h2>Add Chore</h2>

          <Input
            placeholder="Name"
            value={newChore.name}
            onChange={(e) =>
              setNewChore({ ...newChore, name: e.target.value })
            }
          />

          <Input
            placeholder="Room"
            value={newChore.room}
            onChange={(e) =>
              setNewChore({ ...newChore, room: e.target.value })
            }
          />

          <Select
            value={newChore.frequency}
            onChange={(v) =>
              setNewChore({ ...newChore, frequency: v })
            }
          >
            {Object.keys(frequencyDays).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>

          <Select
            value={newChore.owner}
            onChange={(v) =>
              setNewChore({ ...newChore, owner: v })
            }
          >
            {members.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>

          <br /><br />
          <Button onClick={() => addChore()}>Add</Button>

          <hr />

          {chores.map((c) => (
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
              <div>
                {c.name} — {c.frequency}
              </div>

              <div style={{display:"flex",gap:6}}>
                <Button onClick={() => setEditing(c)}>Edit</Button>
                <Button onClick={() => deleteChore(c.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* AI */}
      {tab === "ai" && (
        <Card>
          <h2>AI Suggestions</h2>

          {suggestions.map((s, i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between"}}>
              {s.name}
              <Button onClick={() => addChore({ ...s, owner: members[0] })}>
                Add
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* EDIT */}
      {editing && (
        <Card>
          <h2>Edit Chore</h2>

          <Input
            value={editing.name}
            onChange={(e) =>
              setEditing({ ...editing, name: e.target.value })
            }
          />

          <Button onClick={saveEdit}>Save</Button>
        </Card>
      )}
    </div>
  );
}
