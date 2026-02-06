import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Pencil, Calendar, Lock, LogOut, 
  CheckCircle2, Circle, Moon, Sun, Clock, User as UserIcon, Settings, RefreshCw, Check, X
} from "lucide-react";

/***********************
  PREMIUM UI COMPONENTS
***********************/

const GlassCard = ({ children, className = "" }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm rounded-3xl ${className}`}
  >
    {children}
  </motion.div>
);

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50",
    destructive: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  };
  
  const sizes = {
    md: "px-5 py-2.5 text-sm",
    sm: "px-3 py-1.5 text-xs",
    icon: "p-2",
  };

  return (
    <button 
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-95 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props} 
    >
      {children}
    </button>
  );
};

const Input = (props) => (
  <input 
    className="bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-2xl px-4 py-2.5 w-full outline-none transition-all placeholder:text-slate-400" 
    {...props} 
  />
);

/***********************
  FIREBASE CONFIG
***********************/
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

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
const nextDueDate = (days) => Date.now() + (parseInt(days) * MS_PER_DAY);
const formatCountdown = (ts) => {
  const diff = ts - Date.now();
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / MS_PER_DAY);
  return days > 0 ? `${days}d left` : "Due today";
};

const OWNERS = ["John", "Jennifer"];
const COLORS = [
  { name: "Indigo", bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
  { name: "Rose", bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
  { name: "Amber", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  { name: "Emerald", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  { name: "Slate", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-100" },
];

export default function HomeOpsUltra() {
  const [chores, setChores] = useState([]);
  const [history, setHistory] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("All");
  const [lookback, setLookback] = useState("All");
  const [tab, setTab] = useState("active");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRoom, setNewRoom] = useState({ name: "", color: COLORS[0].name });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [isEditingChore, setIsEditingChore] = useState(null);
  
  const [newChore, setNewChore] = useState({ 
    name: "", room: "", assignedTo: OWNERS[0], dueInDays: 7, isRecurring: false 
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubRooms = onSnapshot(query(collection(db, "rooms"), where("userId", "==", user.uid)), (snap) => {
      const r = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRooms(r);
      if (r.length > 0 && !newChore.room) setNewChore(p => ({ ...p, room: r[0].name }));
    });

    const unsubChores = onSnapshot(query(collection(db, "chores"), where("userId", "==", user.uid)), (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubHistory = onSnapshot(query(collection(db, "choreHistory"), where("userId", "==", user.uid)), (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRooms(); unsubChores(); unsubHistory(); };
  }, [user]);

  const toggleComplete = async (chore) => {
    const historyPayload = {
      name: chore.name,
      room: chore.room,
      assignedTo: chore.assignedTo,
      completedAt: Date.now(),
      userId: user.uid,
      originalChoreId: chore.id
    };

    if (chore.isRecurring) {
      await addDoc(collection(db, "choreHistory"), historyPayload);
      await updateDoc(doc(db, "chores", chore.id), {
        dueDate: nextDueDate(chore.dueInDays)
      });
    } else {
      const isNowDone = !chore.completed;
      if (isNowDone) await addDoc(collection(db, "choreHistory"), historyPayload);
      await updateDoc(doc(db, "chores", chore.id), {
        completed: isNowDone,
        completedAt: isNowDone ? Date.now() : null
      });
    }
  };

  const addRoom = async () => {
    if (!newRoom.name.trim()) return;
    await addDoc(collection(db, "rooms"), { ...newRoom, userId: user.uid });
    setNewRoom({ name: "", color: COLORS[0].name });
  };

  const updateRoom = async (id) => {
    await updateDoc(doc(db, "rooms", id), { name: newRoom.name, color: newRoom.color });
    setEditingRoomId(null);
    setNewRoom({ name: "", color: COLORS[0].name });
  };

  const filteredChores = useMemo(() => {
    if (tab === "active") {
      const active = chores.filter(c => !c.completed);
      return filter === "All" ? active : active.filter(c => c.room === filter);
    } else {
      let past = [...history];
      if (lookback !== "All") {
        const threshold = Date.now() - (parseInt(lookback) * MS_PER_DAY);
        past = past.filter(h => h.completedAt >= threshold);
      }
      return filter === "All" ? past : past.filter(h => h.room === filter);
    }
  }, [chores, history, filter, lookback, tab]);

  const getRoomStyle = (roomName) => {
    const room = rooms.find(r => r.name === roomName);
    const color = COLORS.find(c => c.name === room?.color) || COLORS[0];
    return `${color.bg} ${color.text} ${color.border}`;
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <GlassCard className="w-full max-w-md p-8 text-center">
        <Lock className="text-indigo-600 mx-auto mb-6" size={40} />
        <h2 className="text-2xl font-bold mb-6">HomeOps Login</h2>
        <div className="space-y-4">
          <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <Button onClick={() => signInWithEmailAndPassword(auth, email, password)} className="w-full">Sign In</Button>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-4 md:p-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">
          <header className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold">H</div>
            <h1 className="text-xl font-extrabold">HomeOps<span className="text-indigo-600">Ultra</span></h1>
          </header>

          <GlassCard className="p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Manage Rooms</h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Input placeholder="Room Name" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} />
                <div className="flex gap-1 justify-between">
                  {COLORS.map(c => (
                    <button 
                      key={c.name} 
                      onClick={() => setNewRoom({...newRoom, color: c.name})}
                      className={`w-8 h-8 rounded-full border-2 ${c.bg} ${newRoom.color === c.name ? 'border-indigo-600' : 'border-transparent'}`}
                    />
                  ))}
                  <Button size="icon" onClick={editingRoomId ? () => updateRoom(editingRoomId) : addRoom}>
                    {editingRoomId ? <Check size={18}/> : <Plus size={18}/>}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {rooms.map(r => (
                  <div key={r.id} className={`flex items-center justify-between p-2 rounded-xl border ${getRoomStyle(r.name)}`}>
                    <span className="text-xs font-bold">{r.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingRoomId(r.id); setNewRoom({name: r.name, color: r.color}); }}><Pencil size={12}/></button>
                      <button onClick={() => deleteDoc(doc(db, "rooms", r.id))}><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
          <Button variant="outline" className="w-full" onClick={() => signOut(auth)}>Logout</Button>
        </div>

        {/* MAIN */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                <button onClick={() => setTab("active")} className={`px-4 py-1.5 rounded-xl text-sm font-bold ${tab === "active" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"}`}>To-Do</button>
                <button onClick={() => setTab("recent")} className={`px-4 py-1.5 rounded-xl text-sm font-bold ${tab === "recent" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"}`}>Finished</button>
            </div>
            
            <div className="flex gap-2">
              <select className="bg-white border rounded-xl px-3 py-1 text-xs font-bold" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="All">All Rooms</option>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {tab === "recent" && (
                <select className="bg-white border rounded-xl px-3 py-1 text-xs font-bold" value={lookback} onChange={e => setLookback(e.target.value)}>
                  <option value="All">All Time</option>
                  <option value="1">Last 24h</option>
                  <option value="3">Last 3 Days</option>
                  <option value="7">Last Week</option>
                </select>
              )}
            </div>
          </div>

          {tab === "active" && (
            <GlassCard className="p-4 grid md:grid-cols-3 gap-3 border-dashed border-2">
              <Input placeholder="Task name" value={newChore.name} onChange={e => setNewChore({...newChore, name: e.target.value})} className="md:col-span-2" />
              <select className="bg-white border rounded-2xl px-3 text-sm" value={newChore.room} onChange={e => setNewChore({...newChore, room: e.target.value})}>
                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <select className="bg-white border rounded-2xl px-3 text-sm" value={newChore.assignedTo} onChange={e => setNewChore({...newChore, assignedTo: e.target.value})}>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="flex gap-2">
                <select className="bg-white border rounded-2xl px-3 text-sm flex-1" value={newChore.isRecurring} onChange={e => setNewChore({...newChore, isRecurring: e.target.value === "true"})}>
                  <option value="false">One-time</option>
                  <option value="true">Recurring</option>
                </select>
                <Input type="number" className="w-20" value={newChore.dueInDays} onChange={e => setNewChore({...newChore, dueInDays: e.target.value})} />
              </div>
              <Button onClick={async () => {
                const payload = { ...newChore, userId: user.uid, completed: false, dueDate: nextDueDate(newChore.dueInDays) };
                await addDoc(collection(db, "chores"), payload);
                setNewChore({...newChore, name: ""});
              }}>Add</Button>
            </GlassCard>
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {filteredChores.map((item) => (
                <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GlassCard className="p-5 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      {tab === "active" && (
                        <button onClick={() => toggleComplete(item)}>
                          {item.completed ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-slate-300" />}
                        </button>
                      )}
                      <div>
                        <h4 className={`font-bold ${item.completed ? "line-through text-slate-400" : ""}`}>
                          {item.name} {item.isRecurring && <RefreshCw size={12} className="inline ml-1 text-indigo-400" />}
                        </h4>
                        <div className="flex gap-3 text-[10px] font-bold uppercase mt-1">
                          <span className={`px-2 py-0.5 rounded border ${getRoomStyle(item.room)}`}>{item.room}</span>
                          <span className="text-slate-400 flex items-center gap-1"><UserIcon size={10}/> {item.assignedTo}</span>
                          {tab === "active" && <span className="text-slate-400 flex items-center gap-1"><Clock size={10}/> {formatCountdown(item.dueDate)}</span>}
                          {tab === "recent" && <span className="text-emerald-500">Done {new Date(item.completedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                    {tab === "active" && (
                      <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                        <button onClick={() => deleteDoc(doc(db, "chores", item.id))} className="text-rose-500"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}