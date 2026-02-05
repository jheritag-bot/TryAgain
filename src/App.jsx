import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Trash2, Pencil, Sparkles } from "lucide-react";

// ---------- CONFIG ----------
// Replace with your Firebase config to enable real multi-user sync
const FIREBASE_CONFIG_PLACEHOLDER = true;

// ---------- Frequencies ----------
const frequencyDays = {
  Daily: 1,
  "Every 2 Days": 2,
  "Every 3 Days": 3,
  Weekly: 7,
  Biweekly: 14,
  Monthly: 30,
};

// ---------- AI Suggestions Engine ----------
function generateSuggestions(chores) {
  const names = chores.map((c) => c.name.toLowerCase());
  const suggestions = [];

  if (!names.includes("clean microwave")) {
    suggestions.push({
      name: "Clean Microwave",
      room: "Kitchen",
      frequency: "Monthly",
    });
  }

  if (!names.includes("vacuum stairs")) {
    suggestions.push({
      name: "Vacuum Stairs",
      room: "Living Areas",
      frequency: "Weekly",
    });
  }

  if (!names.includes("test smoke detectors")) {
    suggestions.push({
      name: "Test Smoke Detectors",
      room: "Whole House",
      frequency: "Monthly",
    });
  }

  if (!names.includes("clean dryer vent")) {
    suggestions.push({
      name: "Clean Dryer Vent",
      room: "Laundry",
      frequency: "Quarterly",
    });
  }

  return suggestions;
}

function nextDueDate(chore) {
  if (!chore.lastCompleted) return new Date();

  const days = frequencyDays[chore.frequency] || 7;
  const next = new Date(chore.lastCompleted);
  next.setDate(next.getDate() + days);
  return next;
}

function isDueToday(date) {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// ---------- Local Storage Fallback ----------
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export default function EliteChoreManager() {
  const [chores, setChores] = useLocalStorage("elite-chores", []);
  const [members, setMembers] = useLocalStorage("elite-members", ["Mother", "Father"]);

  const [newChore, setNewChore] = useState({
    name: "",
    room: "Kitchen",
    frequency: "Weekly",
    owner: members[0],
  });

  const [editing, setEditing] = useState(null);

  // ---------- Scheduling Engine ----------
  const calendar = useMemo(() => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);

      const due = chores.filter((c) => {
        const next = nextDueDate(c);
        return (
          next.getFullYear() === d.getFullYear() &&
          next.getMonth() === d.getMonth() &&
          next.getDate() === d.getDate()
        );
      });

      days.push({ date: d, chores: due });
    }

    return days;
  }, [chores]);

  const dueToday = useMemo(
    () => calendar.find((d) => isDueToday(d.date))?.chores || [],
    [calendar]
  );

  const suggestions = useMemo(() => generateSuggestions(chores), [chores]);

  // ---------- Actions ----------
  function completeChore(id) {
    setChores((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, lastCompleted: new Date().toISOString() } : c
      )
    );
  }

  function addChore(chore = newChore) {
    if (!chore.name) return;

    setChores([
      ...chores,
      {
        ...chore,
        id: Date.now(),
        lastCompleted: null,
      },
    ]);

    setNewChore({ name: "", room: "Kitchen", frequency: "Weekly", owner: members[0] });
  }

  function deleteChore(id) {
    setChores((prev) => prev.filter((c) => c.id !== id));
  }

  function saveEdit() {
    setChores((prev) => prev.map((c) => (c.id === editing.id ? editing : c)));
    setEditing(null);
  }

  function addMember(name) {
    if (!name || members.includes(name)) return;
    setMembers([...members, name]);
  }

  // ---------- UI ----------
  return (
    <div className="p-6 max-w-6xl mx-auto grid gap-6">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold">
        Elite Household Manager
      </motion.h1>

      {FIREBASE_CONFIG_PLACEHOLDER && (
        <Card className="border-2">
          <CardContent className="p-4">
            🔥 <strong>Enable Real Multi‑User Sync:</strong> Connect Firebase in this file to allow both parents to see live updates across devices.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="chores">All Chores</TabsTrigger>
          <TabsTrigger value="ai">AI Suggestions</TabsTrigger>
        </TabsList>

        {/* TODAY */}
        <TabsContent value="today">
          <Card>
            <CardContent className="p-4 grid gap-3">
              <h2 className="text-xl font-semibold">Focus Today</h2>

              {dueToday.length === 0 && <p>Nothing due today 🎉</p>}

              {dueToday.map((chore) => (
                <div key={chore.id} className="flex justify-between border p-3 rounded-xl">
                  <div>
                    <div className="font-medium">{chore.name}</div>
                    <div className="text-sm opacity-70">
                      {chore.room} • Owner: {chore.owner}
                    </div>
                  </div>

                  <Button onClick={() => completeChore(chore.id)}>Done</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar">
          <div className="grid md:grid-cols-2 gap-4">
            {calendar.map((day, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <strong>
                    {day.date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </strong>

                  {day.chores.length === 0 && (
                    <div className="text-sm opacity-60 mt-1">No chores</div>
                  )}

                  <div className="mt-2 grid gap-1">
                    {day.chores.map((c) => (
                      <div key={c.id} className="text-sm border rounded p-1">
                        {c.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ALL CHORES */}
        <TabsContent value="chores">
          <Card>
            <CardContent className="p-4 grid gap-3">
              <h2 className="text-xl font-semibold">Add Chore</h2>

              <Input
                placeholder="Chore name"
                value={newChore.name}
                onChange={(e) => setNewChore({ ...newChore, name: e.target.value })}
              />

              <Input
                placeholder="Room"
                value={newChore.room}
                onChange={(e) => setNewChore({ ...newChore, room: e.target.value })}
              />

              <Select onValueChange={(v) => setNewChore({ ...newChore, frequency: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(frequencyDays).map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {freq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={(v) => setNewChore({ ...newChore, owner: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={() => addChore()}>Add</Button>

              <div className="mt-6 grid gap-2">
                {chores.map((chore) => (
                  <div key={chore.id} className="flex justify-between border p-2 rounded-lg">
                    <div>
                      <div>{chore.name}</div>
                      <div className="text-sm opacity-70">
                        {chore.frequency} • {chore.room} • {chore.owner}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditing(chore)}>
                        <Pencil size={16} />
                      </Button>
                      <Button variant="ghost" onClick={() => deleteChore(chore.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai">
          <Card>
            <CardContent className="p-4 grid gap-3">
              <h2 className="text-xl font-semibold flex gap-2 items-center">
                <Sparkles size={18} /> AI Suggestions
              </h2>

              {suggestions.length === 0 && <p>Your home is extremely well covered 👍</p>}

              {suggestions.map((s, i) => (
                <div key={i} className="flex justify-between border p-3 rounded-xl">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm opacity-70">
                      {s.room} • {s.frequency}
                    </div>
                  </div>

                  <Button onClick={() => addChore({ ...s, owner: members[0] })}>
                    Add
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* EDIT MODAL */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        {editing && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Chore</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />

              <Input
                value={editing.room}
                onChange={(e) => setEditing({ ...editing, room: e.target.value })}
              />

              <Select
                defaultValue={editing.frequency}
                onValueChange={(v) => setEditing({ ...editing, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(frequencyDays).map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {freq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                defaultValue={editing.owner}
                onValueChange={(v) => setEditing({ ...editing, owner: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={saveEdit}>Save</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
