import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Calendar, Lock, LogOut } from "lucide-react";

/***********************
 LIGHTWEIGHT UI COMPONENTS
***********************/

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const Button = ({ children, variant = "default", size, className = "", ...props }) => {
  const base = "rounded-xl px-3 py-2 flex items-center gap-2 transition font-medium";
  const variants = {
    default: "bg-black text-white hover:opacity-85",
    outline: "border hover:bg-gray-100",
    destructive: "bg-red-600 text-white hover:opacity-85",
  };
  const sizes = { icon: "p-2" };

  return (
    <button
      className={`${base} ${variants[variant] || ""} ${sizes[size] || ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = (props) => (
  <input className="border rounded-xl px-3 py-2 w-full focus:ring-2 focus:ring-black outline-none" {...props} />
);

const Select = ({ value, onChange, children }) => (
  <select
    className="border rounded-xl px-3 py-2 w-full bg-white"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {children}
  </select>
);

const Checkbox = ({ checked, onChange }) => (
  <input type="checkbox" checked={checked} onChange={onChange} className="w-5 h-5 accent-black cursor-pointer" />
);

/***********************
 FIREBASE CONFIG
***********************/

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  setDoc
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBVO4pKCfYMFiNz9rzvBBzks5PGL3Vw32M",
  authDomain: "choretracker-ddf17.firebaseapp.com",
  projectId: "choretracker-ddf17",
  storageBucket: "choretracker-ddf17.firebasestorage.app",
  messagingSenderId: "179468728865",
  appId: "1:179468728865:web:ca4c5762a08adc7dc0c160"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/***********************
 UTILITIES
***********************/

const MS_PER_DAY = 86400000;
const nextDueDate = (days) => Date.now() + days * MS_PER_DAY;

function formatCountdown(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return "Due now";
  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.floor((diff % MS_PER_DAY) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

/***********************
 MAIN APPLICATION
***********************/

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

  // 1. Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // 2. Persistent Data Listeners (Scoped to User ID)
  useEffect(() => {
    if (!user) return;

    // Listen for Rooms
    const qRooms = query(collection(db, "rooms"), where("userId", "==", user.uid));
    const unsubRooms = onSnapshot(qRooms, (snap) => {
      const roomList = snap.docs.map(d => d.data().name);
      setRooms(roomList);
      // Set default room for dropdown if none selected
      if (roomList.length > 0 && !newChore.room) {
        setNewChore(prev => ({ ...prev, room: roomList[0] }));
      }
    });

    // Listen for Chores
    const qChores = query(collection(db, "chores"), where("userId", "==", user.uid));
    const unsubChores = onSnapshot(qChores, (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRooms();
      unsubChores();
    };
  }, [user]);

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  };

  const logout = () => signOut(auth);

  const addOrUpdateChore = async () => {
    if (!newChore.name.trim() || !user) return;

    const choreData = {
      ...newChore,
      userId: user.uid,
      dueDate: editingId ? newChore.dueDate : nextDueDate(newChore.dueInDays),
      completed: newChore.completed || false,
      completedAt: newChore.completedAt || null
    };

    if (editingId) {
      await updateDoc(doc(db, "chores", editingId), choreData);
      setEditingId(null);
    } else {
      await addDoc(collection(db, "chores"), choreData);
    }

    setNewChore({ name: "", room: rooms[0] || "Kitchen", assignedTo: "", dueInDays: 7 });
  };

  const toggleComplete = async (chore) => {
    const isNowCompleted = !chore.completed;
    await updateDoc(doc(db, "chores", chore.id), {
      completed: isNowCompleted,
      completedAt: isNowCompleted ? Date.now() : null,
      // If completing, push the next due date forward
      dueDate: isNowCompleted ? nextDueDate(chore.dueInDays) : chore.dueDate
    });
  };

  const deleteChore = async (id) => {
    await deleteDoc(doc(db, "chores", id));
  };

  const addRoom = async () => {
    if (!newRoom.trim() || !user) return;
    const roomRef = doc(collection(db, "rooms"));
    await setDoc(roomRef, { name: newRoom, userId: user.uid });
    setNewRoom("");
  };

const removeRoom = async (roomName) => {
  const q = query(
    collection(db, "rooms"), 
    where("userId", "==", user.uid), 
    where("name", "==", roomName)
  );
  
  const querySnapshot = await getDocs(q); // Requires importing getDocs from firebase/firestore
  querySnapshot.forEach((document) => {
    deleteDoc(doc(db, "rooms", document.id));
  });
};

  // Memoized Filters
  const filteredChores = useMemo(() => {
    const cutoff = Date.now() - MS_PER_DAY;
    const base = tab === "recent" 
      ? chores.filter(c => c.completed && c.completedAt >= cutoff)
      : chores.filter(c => !c.completed);
    
    return filter === "All" ? base : base.filter(c => c.room === filter);
  }, [chores, filter, tab]);

  const groupedChores = filteredChores.reduce((acc, chore) => {
    if (!acc[chore.room]) acc[chore.room] = [];
    acc[chore.room].push(chore);
    return acc;
  }, {});

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md p-4">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Lock size={24}/> Login
            </div>
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            <Button onClick={login} className="w-full py-3">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-white min-h-screen">
      <header className="flex justify-between items-center">
        <h1 className="text-4xl font-black tracking-tight">HOME OPS</h1>
        <Button variant="outline" onClick={logout} size="icon"><LogOut size={18}/></Button>
      </header>

      {/* Inputs */}
      <Card className="bg-gray-50 border-none">
        <CardContent className="grid md:grid-cols-5 gap-3">
          <Input placeholder="Chore name" value={newChore.name} onChange={(e) => setNewChore({ ...newChore, name: e.target.value })} />
          <Select value={newChore.room} onChange={(val) => setNewChore({ ...newChore, room: val })}>
            {rooms.length === 0 && <option>Add a room first...</option>}
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input placeholder="Assignee" value={newChore.assignedTo} onChange={(e) => setNewChore({ ...newChore, assignedTo: e.target.value })} />
          <Input type="number" value={newChore.dueInDays} onChange={(e) => setNewChore({ ...newChore, dueInDays: Number(e.target.value) })} />
          <Button onClick={addOrUpdateChore} className="justify-center">
            {editingId ? "Update" : <Plus size={20}/>}
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "active" ? "default" : "outline"} onClick={() => setTab("active")}>Active</Button>
        <Button variant={tab === "recent" ? "default" : "outline"} onClick={() => setTab("recent")}>Done (24h)</Button>
        <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block" />
        {["All", ...rooms].map(r => (
          <Button key={r} variant={filter === r ? "default" : "outline"} onClick={() => setFilter(r)}>{r}</Button>
        ))}
      </div>

      {/* Chore List */}
      <div className="space-y-8">
        {Object.keys(groupedChores).map(room => (
          <div key={room} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">{room}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {groupedChores[room].map(chore => (
                <Card key={chore.id} className={chore.completed ? "bg-gray-50" : ""}>
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox checked={chore.completed} onChange={() => toggleComplete(chore)} />
                      <div>
                        <p className={`font-semibold ${chore.completed ? "line-through text-gray-400" : "text-gray-900"}`}>{chore.name}</p>
                        <p className="text-xs text-gray-500">{chore.assignedTo || "Anyone"} • {formatCountdown(chore.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="border-none" onClick={() => {setEditingId(chore.id); setNewChore(chore);}}><Pencil size={14}/></Button>
                      <Button size="icon" variant="outline" className="border-none text-red-500" onClick={() => deleteChore(chore.id)}><Trash2 size={14}/></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <footer className="pt-10 border-t">
        <h3 className="font-bold mb-4">Manage Rooms</h3>
        <div className="flex gap-2 mb-4">
          <Input className="max-w-xs" placeholder="Bathroom, Yard..." value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
          <Button onClick={addRoom} variant="outline">Add</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {rooms.map(r => (
            <span key={r} className="px-3 py-1 bg-gray-100 rounded-full text-xs flex items-center gap-2">
              {r} <button onClick={() => removeRoom(r)} className="text-red-500 hover:text-red-700">×</button>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}