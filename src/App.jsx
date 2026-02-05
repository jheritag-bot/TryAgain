import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Pencil, Calendar, Lock, LogOut, 
  CheckCircle2, Circle, Moon, Sun, Clock, User as UserIcon, Settings, Check, X
} from "lucide-react";

/***********************
  PREMIUM UI COMPONENTS
***********************/

const GlassCard = ({ children, className = "", darkMode = false }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`backdrop-blur-md border rounded-3xl transition-all duration-300 ${
      darkMode 
        ? "bg-slate-900/70 border-slate-700 text-white" 
        : "bg-white/80 border-slate-200 shadow-sm text-slate-900"
    } ${className}`}
  >
    {children}
  </motion.div>
);

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800",
    destructive: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400",
  };
  
  const sizes = { md: "px-5 py-2.5 text-sm", sm: "px-3 py-1.5 text-xs", icon: "p-2" };

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
    className="bg-slate-50 dark:bg-slate-900/50 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 rounded-2xl px-4 py-2.5 w-full outline-none transition-all placeholder:text-slate-400 dark:text-white" 
    {...props} 
  />
);

/***********************
  FIREBASE CONFIG
***********************/
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, where, setDoc, getDoc, writeBatch, getDocs
} from "firebase/firestore";
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
const nextDueDate = (days) => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime() + (days * MS_PER_DAY);
};

const formatCountdown = (ts) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(ts);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  
  const diff = dueDay - today;
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due Today";
  if (diff === MS_PER_DAY) return "Due Tomorrow";
  return `Due in ${Math.round(diff / MS_PER_DAY)}d`;
};

export default function HomeOpsUltra() {
  const [darkMode, setDarkMode] = useState(false);
  const [chores, setChores] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [user, setUser] = useState(null);
  
  // Filters
  const [roomFilter, setRoomFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All"); // All, Today, Week
  const [tab, setTab] = useState("active");

  // Room Editing State
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomEditValue, setRoomEditValue] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isEditingChore, setIsEditingChore] = useState(null);
  const [newChore, setNewChore] = useState({ name: "", room: "", assignedTo: "", dueInDays: 1 });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists() && userSnap.data().darkMode !== undefined) setDarkMode(userSnap.data().darkMode);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubRooms = onSnapshot(query(collection(db, "rooms"), where("userId", "==", user.uid)), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubChores = onSnapshot(query(collection(db, "chores"), where("userId", "==", user.uid)), (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubRooms(); unsubChores(); };
  }, [user]);

  const toggleDarkMode = async () => {
    setDarkMode(!darkMode);
    if (user) await setDoc(doc(db, "users", user.uid), { darkMode: !darkMode }, { merge: true });
  };

  // ROOM LOGIC: Rename room and all associated chores
  const handleRenameRoom = async (roomObj) => {
    if (!roomEditValue.trim() || roomEditValue === roomObj.name) {
        setEditingRoom(null);
        return;
    }
    const batch = writeBatch(db);
    batch.update(doc(db, "rooms", roomObj.id), { name: roomEditValue });
    
    const choresToUpdate = chores.filter(c => c.room === roomObj.name);
    choresToUpdate.forEach(c => {
        batch.update(doc(db, "chores", c.id), { room: roomEditValue });
    });
    
    await batch.commit();
    setEditingRoom(null);
  };

  const addChore = async () => {
    if (!newChore.name.trim() || !newChore.room.trim()) return;
    
    // Auto-add room if it doesn't exist
    if (!rooms.some(r => r.name.toLowerCase() === newChore.room.toLowerCase())) {
        await addDoc(collection(db, "rooms"), { name: newChore.room, userId: user.uid });
    }

    const payload = { 
        ...newChore, 
        userId: user.uid, 
        completed: false, 
        dueDate: nextDueDate(parseInt(newChore.dueInDays)) 
    };

    if (isEditingChore) {
        await updateDoc(doc(db, "chores", isEditingChore), payload);
        setIsEditingChore(null);
    } else {
        await addDoc(collection(db, "chores"), payload);
    }
    setNewChore({ name: "", room: "", assignedTo: "", dueInDays: 1 });
  };

  // ADVANCED FILTERING LOGIC
  const filteredChores = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const weekEnd = todayEnd + (7 * MS_PER_DAY);

    return chores.filter(c => {
        const matchesTab = tab === "active" ? !c.completed : c.completed;
        const matchesRoom = roomFilter === "All" || c.room === roomFilter;
        const matchesOwner = ownerFilter === "All" || c.assignedTo === ownerFilter;
        
        let matchesDate = true;
        if (dateFilter === "Today") matchesDate = c.dueDate <= todayEnd;
        if (dateFilter === "Week") matchesDate = c.dueDate <= weekEnd;

        return matchesTab && matchesRoom && matchesOwner && matchesDate;
    });
  }, [chores, roomFilter, ownerFilter, dateFilter, tab]);

  // DAILY GOAL LOGIC
  const dailyProgress = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const todayTasks = chores.filter(c => c.dueDate <= todayEnd);
    if (todayTasks.length === 0) return 0;
    const completedToday = todayTasks.filter(c => c.completed).length;
    return Math.round((completedToday / todayTasks.length) * 100);
  }, [chores]);

  // Extract unique owners for filter dropdown
  const owners = useMemo(() => ["All", ...new Set(chores.map(c => c.assignedTo).filter(Boolean))], [chores]);

  if (!user) return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <GlassCard darkMode={darkMode} className="w-full max-w-md p-8 text-center">
        <Lock className="mx-auto mb-6 text-indigo-600" size={40} />
        <h2 className="text-2xl font-bold mb-6">HomeOps Login</h2>
        <div className="space-y-4">
          <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <Button onClick={() => signInWithEmailAndPassword(auth, email, password)} className="w-full">Enter Dashboard</Button>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 p-4 md:p-10 ${darkMode ? 'bg-slate-950 text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <div className="max-w-6xl mx-auto">
        
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold">H</div>
            <h1 className="text-xl font-extrabold tracking-tight">HomeOps<span className="text-indigo-600">Ultra</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleDarkMode} className={`p-2.5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-yellow-400' : 'bg-white border-slate-200'}`}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Button variant="outline" size="icon" onClick={() => signOut(auth)}><LogOut size={20}/></Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* SIDEBAR */}
          <div className="lg:col-span-4 space-y-6">
            <GlassCard darkMode={darkMode} className={`p-6 border-none ${darkMode ? 'bg-indigo-500/10' : 'bg-indigo-900 !text-white'}`}>
              <p className="opacity-70 text-sm font-bold uppercase tracking-widest mb-1">Today's Goal</p>
              <h3 className="text-5xl font-black mb-4">{dailyProgress}%</h3>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div animate={{ width: `${dailyProgress}%` }} className="h-full bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
              </div>
              <p className="text-xs mt-3 opacity-60">Based on tasks due by midnight.</p>
            </GlassCard>

            <GlassCard darkMode={darkMode} className="p-6">
              <h3 className="text-xs font-bold opacity-40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Settings size={14}/> Household Rooms
              </h3>
              <div className="space-y-2">
                  {rooms.map(r => (
                      <div key={r.id} className="flex items-center justify-between group">
                          {editingRoom === r.id ? (
                              <div className="flex gap-1 w-full">
                                  <Input size="sm" value={roomEditValue} onChange={e => setRoomEditValue(e.target.value)} autoFocus />
                                  <Button size="icon" variant="primary" onClick={() => handleRenameRoom(r)}><Check size={14}/></Button>
                                  <Button size="icon" variant="outline" onClick={() => setEditingRoom(null)}><X size={14}/></Button>
                              </div>
                          ) : (
                              <>
                                <span className={`text-sm font-medium ${roomFilter === r.name ? 'text-indigo-500' : ''}`}>{r.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => {setEditingRoom(r.id); setRoomEditValue(r.name);}} className="p-1 hover:text-indigo-500"><Pencil size={12}/></button>
                                    <button onClick={() => deleteDoc(doc(db, "rooms", r.id))} className="p-1 hover:text-rose-500"><Trash2 size={12}/></button>
                                </div>
                              </>
                          )}
                      </div>
                  ))}
              </div>
            </GlassCard>
          </div>

          {/* MAIN PANEL */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* COMPACT FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <select onChange={(e) => setDateFilter(e.target.value)} className={`p-2 rounded-xl text-xs font-bold border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
                    <option value="All">Any Deadline</option>
                    <option value="Today">Due Today</option>
                    <option value="Week">Due This Week</option>
                </select>
                <select onChange={(e) => setOwnerFilter(e.target.value)} className={`p-2 rounded-xl text-xs font-bold border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
                    {owners.map(o => <option key={o} value={o}>{o === "All" ? "Every Owner" : o}</option>)}
                </select>
                <select onChange={(e) => setRoomFilter(e.target.value)} className={`p-2 rounded-xl text-xs font-bold border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
                    <option value="All">All Rooms</option>
                    {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                <div className={`flex p-1 rounded-xl ${darkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
                    <button onClick={() => setTab("active")} className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${tab === "active" ? 'bg-indigo-600 text-white' : 'opacity-50'}`}>TO-DO</button>
                    <button onClick={() => setTab("recent")} className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${tab === "recent" ? 'bg-indigo-600 text-white' : 'opacity-50'}`}>DONE</button>
                </div>
            </div>

            {/* CHORE ENTRY: Advanced Version */}
            {tab === "active" && (
              <GlassCard darkMode={darkMode} className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 border-dashed border-2">
                  <Input placeholder="Chore name..." value={newChore.name} onChange={e => setNewChore({...newChore, name: e.target.value})} className="lg:col-span-2" />
                  <Input list="room-list" placeholder="Room name..." value={newChore.room} onChange={e => setNewChore({...newChore, room: e.target.value})} />
                  <datalist id="room-list">
                    {rooms.map(r => <option key={r.id} value={r.name} />)}
                  </datalist>
                  <Input placeholder="Owner..." value={newChore.assignedTo} onChange={e => setNewChore({...newChore, assignedTo: e.target.value})} />
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" placeholder="Days" value={newChore.dueInDays} onChange={e => setNewChore({...newChore, dueInDays: e.target.value})} />
                    <Button onClick={addChore} size="icon" className="shrink-0"><Plus size={20}/></Button>
                  </div>
              </GlassCard>
            )}

            {/* LIST */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                  {filteredChores.map((chore) => (
                      <motion.div key={chore.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <GlassCard darkMode={darkMode} className={`p-4 flex items-center justify-between group ${chore.completed ? "opacity-40" : ""}`}>
                              <div className="flex items-center gap-4">
                                  <button onClick={async () => {
                                      const isNowDone = !chore.completed;
                                      await updateDoc(doc(db, "chores", chore.id), { 
                                          completed: isNowDone, 
                                          dueDate: isNowDone ? nextDueDate(chore.dueInDays || 1) : chore.dueDate 
                                      });
                                  }}>
                                      {chore.completed ? <CheckCircle2 className="text-emerald-500" size={24}/> : <Circle className="text-slate-400" size={24}/>}
                                  </button>
                                  <div>
                                      <h4 className="font-bold">{chore.name}</h4>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] font-bold uppercase tracking-widest opacity-60">
                                          <span className="text-indigo-500">{chore.room}</span>
                                          <span className="flex items-center gap-1"><UserIcon size={10}/> {chore.assignedTo || "Anyone"}</span>
                                          <span className="flex items-center gap-1"><Calendar size={10}/> {formatCountdown(chore.dueDate)}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => {setIsEditingChore(chore.id); setNewChore(chore);}} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Pencil size={14}/></button>
                                  <button onClick={() => deleteDoc(doc(db, "chores", chore.id))} className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 rounded-lg"><Trash2 size={14}/></button>
                              </div>
                          </GlassCard>
                      </motion.div>
                  ))}
              </AnimatePresence>
              {filteredChores.length === 0 && <div className="text-center py-20 opacity-20 font-black tracking-tighter text-4xl italic">CLEAR SKIES</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}