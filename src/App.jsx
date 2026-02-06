import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Pencil, Calendar, Lock, LogOut, 
  CheckCircle2, Circle, Moon, Sun, Clock, User as UserIcon, Settings
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
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, getDocs } from "firebase/firestore";
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
const nextDueDate = (days) => Date.now() + days * MS_PER_DAY;
const formatCountdown = (ts) => {
  const diff = ts - Date.now();
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / MS_PER_DAY);
  return days > 0 ? `${days}d left` : "Due today";
};

// Hardcoded Owners
const OWNERS = ["John", "Jennifer"];

export default function HomeOpsUltra() {
  const [chores, setChores] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("active");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [isEditing, setIsEditing] = useState(null);
  
  // Default values set to hardcoded Owners
  const [newChore, setNewChore] = useState({ name: "", room: "", assignedTo: OWNERS[0], dueInDays: 7 });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const qRooms = query(collection(db, "rooms"), where("userId", "==", user.uid));
    const unsubRooms = onSnapshot(qRooms, (snap) => {
      const r = snap.docs.map(d => d.data().name);
      setRooms(r);
      // Auto-select the first room for new chores if one isn't selected
      if (r.length > 0 && !newChore.room) setNewChore(p => ({ ...p, room: r[0] }));
    });

    const qChores = query(collection(db, "chores"), where("userId", "==", user.uid));
    const unsubChores = onSnapshot(qChores, (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRooms(); unsubChores(); };
  }, [user]);

  const toggleComplete = async (chore) => {
    const isNowDone = !chore.completed;
    await updateDoc(doc(db, "chores", chore.id), {
      completed: isNowDone,
      completedAt: isNowDone ? Date.now() : null,
      dueDate: isNowDone ? nextDueDate(chore.dueInDays) : chore.dueDate
    });
  };

  const addChore = async () => {
    if (!newChore.name.trim() || !newChore.room) return;
    const payload = { ...newChore, userId: user.uid, completed: false, dueDate: nextDueDate(newChore.dueInDays) };
    if (isEditing) {
        await updateDoc(doc(db, "chores", isEditing), payload);
        setIsEditing(null);
    } else {
        await addDoc(collection(db, "chores"), payload);
    }
    setNewChore({ ...newChore, name: "" });
  };

  const completionRate = chores.length ? Math.round((chores.filter(c => c.completed).length / chores.length) * 100) : 0;

  const filteredChores = useMemo(() => {
    const base = tab === "active" ? chores.filter(c => !c.completed) : chores.filter(c => c.completed);
    return filter === "All" ? base : base.filter(c => c.room === filter);
  }, [chores, filter, tab]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6 font-sans">
      <GlassCard className="w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
          <Lock className="text-white" size={28} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
        <p className="text-slate-500 mb-8">Manage your home operations with ease.</p>
        <div className="space-y-4">
          <Input placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <Button onClick={() => signInWithEmailAndPassword(auth, email, password)} className="w-full py-4">Sign In</Button>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR / STATS */}
        <div className="lg:col-span-4 space-y-6">
          <header className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100">H</div>
            <h1 className="text-xl font-extrabold tracking-tight">HomeOps<span className="text-indigo-600">Ultra</span></h1>
          </header>

          <GlassCard className="p-6 bg-indigo-900 !text-white border-none shadow-indigo-200">
            <p className="text-indigo-200 text-sm font-medium mb-1">Overall Progress</p>
            <div className="flex items-end justify-between mb-4">
                <h3 className="text-4xl font-bold">{completionRate}%</h3>
                <p className="text-xs text-indigo-300">Daily Goal</p>
            </div>
            <div className="w-full h-2 bg-indigo-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${completionRate}%` }} className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </div>
          </GlassCard>

          {/* Manage Rooms Section */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Settings size={14}/> Manage Rooms
            </h3>
            <div className="flex gap-2 mb-4">
                <Input placeholder="Room Name" value={newRoom} onChange={e => setNewRoom(e.target.value)} className="text-sm" />
                <Button variant="secondary" onClick={async () => {
                    if (!newRoom.trim()) return;
                    await setDoc(doc(collection(db, "rooms")), { name: newRoom, userId: user.uid });
                    setNewRoom("");
                }}><Plus size={18}/></Button>
            </div>
            <div className="flex flex-wrap gap-2">
                {rooms.map(r => (
                    <span key={r} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-xs font-medium text-slate-600">{r}</span>
                ))}
            </div>
          </GlassCard>
          
          <Button variant="outline" className="w-full py-3" onClick={() => signOut(auth)}>
            <LogOut size={16}/> Logout
          </Button>
        </div>

        {/* MAIN DASHBOARD */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TOP NAV & FILTERS */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                <button onClick={() => setTab("active")} className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${tab === "active" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"}`}>To-Do</button>
                <button onClick={() => setTab("recent")} className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${tab === "recent" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"}`}>Finished</button>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <Button variant={filter === "All" ? "primary" : "outline"} size="sm" onClick={() => setFilter("All")}>All</Button>
                {rooms.map(r => (
                    <Button key={r} variant={filter === r ? "primary" : "outline"} size="sm" onClick={() => setFilter(r)}>{r}</Button>
                ))}
            </div>
          </div>

          {/* CHORE ENTRY WITH DROPDOWNS */}
          {tab === "active" && (
            <GlassCard className="p-4 grid md:grid-cols-4 gap-3 border-dashed border-2 bg-indigo-50/30">
                <Input placeholder="What needs doing?" value={newChore.name} onChange={e => setNewChore({...newChore, name: e.target.value})} />
                
                {/* Room Selection Dropdown */}
                <select 
                  className="bg-white ring-1 ring-slate-200 rounded-2xl px-3 text-sm outline-none cursor-pointer" 
                  value={newChore.room} 
                  onChange={e => setNewChore({...newChore, room: e.target.value})}
                >
                    {rooms.length === 0 && <option value="">Add a room first</option>}
                    {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                
                {/* Owner Selection Dropdown */}
                <select 
                  className="bg-white ring-1 ring-slate-200 rounded-2xl px-3 text-sm outline-none cursor-pointer" 
                  value={newChore.assignedTo} 
                  onChange={e => setNewChore({...newChore, assignedTo: e.target.value})}
                >
                    {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                
                <Button onClick={addChore} className="w-full">{isEditing ? "Update" : "Add Chore"}</Button>
            </GlassCard>
          )}

          {/* CHORE LIST */}
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
                {filteredChores.map((chore) => (
                    <motion.div 
                        key={chore.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <GlassCard className={`p-5 flex items-center justify-between group ${chore.completed ? "bg-slate-50/50 opacity-60" : ""}`}>
                            <div className="flex items-center gap-5">
                                <button onClick={() => toggleComplete(chore)} className="transition-transform active:scale-90">
                                    {chore.completed ? 
                                        <CheckCircle2 size={28} className="text-emerald-500" /> : 
                                        <Circle size={28} className="text-slate-300 hover:text-indigo-400" />
                                    }
                                </button>
                                <div>
                                    <h4 className={`font-bold text-lg ${chore.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                                        {chore.name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-400">
                                        <span className="flex items-center gap-1 uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">{chore.room}</span>
                                        <span className="flex items-center gap-1"><UserIcon size={12}/> {chore.assignedTo}</span>
                                        <span className="flex items-center gap-1"><Clock size={12}/> {formatCountdown(chore.dueDate)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="icon" onClick={() => {setIsEditing(chore.id); setNewChore(chore);}}><Pencil size={14}/></Button>
                                <Button variant="destructive" size="icon" onClick={() => deleteDoc(doc(db, "chores", chore.id))}><Trash2 size={14}/></Button>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </AnimatePresence>
            
            {filteredChores.length === 0 && (
                <div className="text-center py-20">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="text-slate-300" size={32} />
                    </div>
                    <h3 className="text-slate-900 font-bold">All caught up!</h3>
                    <p className="text-slate-400 text-sm">Enjoy your clean house.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}