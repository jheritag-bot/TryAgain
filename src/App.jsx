import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Checkbox } from "./components/ui/checkbox";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Calendar, Lock } from "lucide-react";

/***********************
 FIREBASE
***********************/

// 🔴 IMPORTANT:
// Replace this config with YOUR Firebase project config.

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from "firebase/firestore";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/***********************
 UTILITIES
***********************/

const MS_PER_DAY = 86400000;

function nextDueDate(days) {
  return Date.now() + days * MS_PER_DAY;
}

function formatCountdown(ts) {
  const diff = ts - Date.now();

  if (diff <= 0) return "Due now";

  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.floor((diff % MS_PER_DAY) / 3600000);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function generateICS(chores) {
  const events = chores
    .filter(c => !c.completed)
    .map(c => {
      const date = new Date(c.dueDate);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth()+1).padStart(2,'0');
      const d = String(date.getUTCDate()).padStart(2,'0');

      return `BEGIN:VEVENT\nSUMMARY:${c.name}\nDTSTART;VALUE=DATE:${y}${m}${d}\nEND:VEVENT`;
    }).join("\n");

  return `BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`;
}

/***********************
 DEFAULT DATA (FIRST RUN ONLY)
***********************/

const defaultRooms = ["Kitchen", "Living Room", "Bedrooms", "Bathrooms", "Basement"];

const defaultChores = [
  { name: "Vacuum floors", room: "Living Room", assignedTo: "Me", completed: false, completedAt: null, dueInDays: 7, dueDate: nextDueDate(7) },
  { name: "Clean toilets", room: "Bathrooms", assignedTo: "Me", completed: false, completedAt: null, dueInDays: 7, dueDate: nextDueDate(7) },
  { name: "Wipe kitchen counters", room: "Kitchen", assignedTo: "Me", completed: false, completedAt: null, dueInDays: 1, dueDate: nextDueDate(1) },
];

export default function HomeOpsUltra() {
  const [chores, setChores] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("active");
  const [editingId, setEditingId] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRoom, setNewRoom] = useState("");

  const [newChore, setNewChore] = useState({
    name: "",
    room: "Kitchen",
    assignedTo: "",
    dueInDays: 7,
  });

  /***********************
   AUTH
  ***********************/

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  /***********************
   REALTIME SYNC
  ***********************/

  useEffect(() => {
    if (!user) return;

    const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => {
      if (snap.empty) {
        defaultRooms.forEach(r => setDoc(doc(db, "rooms", r), { name: r }));
        return;
      }
      setRooms(snap.docs.map(d => d.data().name));
    });

    const unsubChores = onSnapshot(collection(db, "chores"), (snap) => {
      if (snap.empty) {
        defaultChores.forEach(c => addDoc(collection(db, "chores"), c));
        return;
      }

      setChores(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => {
      unsubRooms();
      unsubChores();
    };
  }, [user]);

  /***********************
   AUTO RESET
  ***********************/

  useEffect(() => {
    const interval = setInterval(() => {
      chores.forEach(async c => {
        if (Date.now() >= c.dueDate) {
          await updateDoc(doc(db, "chores", c.id), {
            completed: false,
            completedAt: null,
            dueDate: nextDueDate(c.dueInDays)
          });
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [chores]);

  /***********************
   CRUD
  ***********************/

  const addOrUpdateChore = async () => {
    if (!newChore.name.trim()) return;

    if (editingId) {
      await updateDoc(doc(db, "chores", editingId), newChore);
      setEditingId(null);
    } else {
      await addDoc(collection(db, "chores"), {
        ...newChore,
        completed: false,
        completedAt: null,
        dueDate: nextDueDate(newChore.dueInDays)
      });
    }

    setNewChore({ name: "", room: rooms[0], assignedTo: "", dueInDays: 7 });
  };

  const toggleComplete = async (chore) => {
    await updateDoc(doc(db, "chores", chore.id), {
      completed: !chore.completed,
      completedAt: !chore.completed ? Date.now() : null,
      dueDate: !chore.completed ? nextDueDate(chore.dueInDays) : chore.dueDate
    });
  };

  const editChore = (chore) => {
    setEditingId(chore.id);
    setNewChore(chore);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteChore = async (id) => {
    await deleteDoc(doc(db, "chores", id));
  };

  /***********************
   ROOM MANAGEMENT
  ***********************/

  const addRoom = async () => {
    if (!newRoom.trim()) return;
    await setDoc(doc(db, "rooms", newRoom), { name: newRoom });
    setNewRoom("");
  };

  const removeRoom = async (room) => {
    await deleteDoc(doc(db, "rooms", room));
  };

  /***********************
   DERIVED DATA
  ***********************/

  const recentCompleted = useMemo(() => {
    const cutoff = Date.now() - MS_PER_DAY;
    return chores.filter(c => c.completed && c.completedAt && c.completedAt >= cutoff);
  }, [chores]);

  const filteredChores = useMemo(() => {
    const base = tab === "recent" ? recentCompleted : chores.filter(c => !c.completed);
    if (filter === "All") return base;
    return base.filter(c => c.room === filter);
  }, [chores, filter, tab, recentCompleted]);

  const groupedChores = filteredChores.reduce((acc, chore) => {
    if (!acc[chore.room]) acc[chore.room] = [];
    acc[chore.room].push(chore);
    return acc;
  }, {});

  /***********************
   CALENDAR
  ***********************/

  const downloadCalendar = () => {
    const blob = new Blob([generateICS(chores)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chores-calendar.ics";
    a.click();
  };

  /***********************
   LOGIN
  ***********************/

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Lock size={18}/> Household Login
            </div>

            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />

            <Button onClick={login} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /***********************
   UI
  ***********************/

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <motion.div className="flex flex-col md:flex-row md:justify-between gap-3">
        <h1 className="text-3xl font-bold">Home Ops Ultra</h1>

        <Button onClick={downloadCalendar} variant="outline">
          <Calendar size={16}/> Export Calendar
        </Button>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "active" ? "default" : "outline"} onClick={() => setTab("active")}>Active</Button>
        <Button variant={tab === "recent" ? "default" : "outline"} onClick={() => setTab("recent")}>Completed Recently</Button>
      </div>

      {/* Room Filters */}
      <div className="flex gap-2 flex-wrap">
        {["All", ...rooms].map(r => (
          <Button key={r} variant={filter === r ? "default" : "outline"} onClick={() => setFilter(r)}>
            {r}
          </Button>
        ))}
      </div>

      {/* Add/Edit Chore */}
      {tab === "active" && (
        <Card>
          <CardContent className="p-4 grid md:grid-cols-5 gap-3">
            <Input
              placeholder="Chore name"
              value={newChore.name}
              onChange={(e) => setNewChore({ ...newChore, name: e.target.value })}
            />

            <Select
              value={newChore.room}
              onValueChange={(val) => setNewChore({ ...newChore, room: val })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map(room => (
                  <SelectItem key={room} value={room}>{room}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Assigned to"
              value={newChore.assignedTo}
              onChange={(e) => setNewChore({ ...newChore, assignedTo: e.target.value })}
            />

            <Input
              type="number"
              min="1"
              value={newChore.dueInDays}
              onChange={(e) => setNewChore({ ...newChore, dueInDays: Number(e.target.value) })}
            />

            <Button onClick={addOrUpdateChore}>
              <Plus size={16}/> {editingId ? "Update" : "Add"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Room Admin */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Room Management</h2>

          <div className="flex gap-2">
            <Input
              placeholder="New room"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
            />
            <Button onClick={addRoom}>Add Room</Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {rooms.map(room => (
              <Button key={room} variant="outline" onClick={() => removeRoom(room)}>
                <Trash2 size={14}/> {room}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chores */}
      <div className="grid gap-6">
        {Object.keys(groupedChores).map(room => (
          <div key={room}>
            <h2 className="text-xl font-semibold mb-2">{room}</h2>

            <div className="grid md:grid-cols-2 gap-4">
              {groupedChores[room].map(chore => (
                <Card key={chore.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={chore.completed}
                        onCheckedChange={() => toggleComplete(chore)}
                      />

                      <div>
                        <p className={`font-medium ${chore.completed ? "line-through opacity-50" : ""}`}>
                          {chore.name}
                        </p>

                        <p className="text-sm opacity-70">
                          {chore.assignedTo || "Unassigned"} • ⏳ {formatCountdown(chore.dueDate)}
                        </p>
                      </div>
                    </div>

                    {tab === "active" && (
                      <div className="flex gap-2">
                        <Button size="icon" variant="outline" onClick={() => editChore(chore)}>
                          <Pencil size={16}/>
                        </Button>

                        <Button size="icon" variant="destructive" onClick={() => deleteChore(chore.id)}>
                          <Trash2 size={16}/>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
