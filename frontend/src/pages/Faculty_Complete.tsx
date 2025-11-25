// import { useEffect, useState } from "react";
// import { onAuthStateChanged, signOut } from "firebase/auth";
// import { auth, getRealtimeDb } from "../firebase";
// import { useNavigate } from "react-router-dom";
// import { ref, onValue, off, set, remove } from "firebase/database";
// import Sidebar from "../components/Sidebar";

// interface Faculty {
//   id: string;
//   name: string;
//   department: string;
//   cardId: string;
//   fingerprintId: string;
//   email: string;
//   phone: string;
//   clearance: boolean;
//   active: boolean;
//   lastAccess: string;
//   attendanceRate: number;
//   accessCount: number;
// }

// interface AccessLog {
//   id: string;
//   timestamp: string;
//   user: string;
//   method: string;
//   result: string;
//   door: string;
//   notes: string;
// }

// export default function Faculty_Complete() {
//   const [currentTime, setCurrentTime] = useState(new Date());
//   const [faculty, setFaculty] = useState<Faculty[]>([]);
//   const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
//   const [filteredFaculty, setFilteredFaculty] = useState<Faculty[]>([]);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
//   const [filterClearance, setFilterClearance] = useState<"all" | "cleared" | "pending">("all");
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showHistoryModal, setShowHistoryModal] = useState(false);
//   const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
//   const [adminName, setAdminName] = useState("Admin");
  
//   const [newFaculty, setNewFaculty] = useState({
//     name: "",
//     department: "",
//     cardId: "",
//     fingerprintId: "",
//     email: "",
//     phone: "",
//     clearance: false,
//     active: true,
//   });

//   const navigate = useNavigate();

//   // Auth check
//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (user) => {
//       if (!user) navigate("/");
//       else setAdminName(user.email?.split("@")[0] || "Admin");
//     });
//     return unsubscribe;
//   }, [navigate]);

//   // Real-time clock
//   useEffect(() => {
//     const timer = setInterval(() => setCurrentTime(new Date()), 1000);
//     return () => clearInterval(timer);
//   }, []);

//   // Real-time faculty data
//   useEffect(() => {
//     const db = getRealtimeDb();
//     const facultyRef = ref(db, "users");

//     const unsubscribe = onValue(facultyRef, (snapshot) => {
//       const data = snapshot.val();
//       if (data) {
//         const facultyList: Faculty[] = Object.entries(data)
//           .filter(([_, value]: [string, any]) => value.role === "faculty")
//           .map(([key, value]: [string, any]) => ({
//             id: key,
//             name: value.name || "Unknown",
//             department: value.department || "N/A",
//             cardId: value.cardId || "N/A",
//             fingerprintId: value.fingerprintId || "N/A",
//             email: value.email || "N/A",
//             phone: value.phone || "N/A",
//             clearance: value.clearance || false,
//             active: value.active !== false,
//             lastAccess: value.lastAccess || "Never",
//             attendanceRate: value.attendanceRate || 0,
//             accessCount: value.accessCount || 0,
//           }));
//         setFaculty(facultyList);
//         setFilteredFaculty(facultyList);
//       } else {
//         setFaculty([]);
//         setFilteredFaculty([]);
//       }
//     });

//     return () => off(facultyRef, "value", unsubscribe);
//   }, []);

//   // Real-time access logs
//   useEffect(() => {
//     const db = getRealtimeDb();
//     const logsRef = ref(db, "accessLogs");

//     const unsubscribe = onValue(logsRef, (snapshot) => {
//       const data = snapshot.val();
//       if (data) {
//         const logsList: AccessLog[] = Object.entries(data).map(([key, value]: [string, any]) => ({
//           id: key,
//           timestamp: value.timestamp || "",
//           user: value.user || "Unknown",
//           method: value.method || "N/A",
//           result: value.result || "N/A",
//           door: value.door || "N/A",
//           notes: value.notes || "",
//         }));
//         setAccessLogs(logsList.sort((a, b) => 
//           new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
//         ));
//       }
//     });

//     return () => off(logsRef, "value", unsubscribe);
//   }, []);

//   // Filter faculty - matches from first letter
//   useEffect(() => {
//     let filtered = faculty;

//     if (searchTerm) {
//       filtered = filtered.filter(
//         (f) =>
//           f.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
//           f.department.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
//           f.cardId.toLowerCase().startsWith(searchTerm.toLowerCase())
//       );
//     }

//     if (filterStatus !== "all") {
//       filtered = filtered.filter((f) =>
//         filterStatus === "active" ? f.active : !f.active
//       );
//     }

//     if (filterClearance !== "all") {
//       filtered = filtered.filter((f) =>
//         filterClearance === "cleared" ? f.clearance : !f.clearance
//       );
//     }

//     setFilteredFaculty(filtered);
//   }, [searchTerm, filterStatus, filterClearance, faculty]);

//   const handleAddFaculty = async () => {
//     if (!newFaculty.name || !newFaculty.department || !newFaculty.cardId || 
//         !newFaculty.fingerprintId || !newFaculty.email || !newFaculty.phone) {
//       alert("Please fill in all required fields");
//       return;
//     }

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(newFaculty.email)) {
//       alert("Please enter a valid email address");
//       return;
//     }

//     const rfidRegex = /^FAC\d{3}$/;
//     if (!rfidRegex.test(newFaculty.cardId)) {
//       alert("Invalid RFID Card ID format. Must be FAC followed by 3 digits (e.g., FAC001)");
//       return;
//     }

//     const fingerprintRegex = /^FP\d{3}$/;
//     if (!fingerprintRegex.test(newFaculty.fingerprintId)) {
//       alert("Invalid Fingerprint ID format. Must be FP followed by 3 digits (e.g., FP001)");
//       return;
//     }

//     const phoneRegex = /^(\+63|0)?9\d{9}$/;
//     if (!phoneRegex.test(newFaculty.phone.replace(/[\s-]/g, ''))) {
//       alert("Invalid Philippines phone number. Must start with +63 or 09 followed by 9 digits (e.g., +63 912 345 6789)");
//       return;
//     }

//     const db = getRealtimeDb();
//     const facultyId = `FAC${Date.now()}`;
//     const facultyRef = ref(db, `users/${facultyId}`);

//     await set(facultyRef, {
//       ...newFaculty,
//       role: "faculty",
//       createdAt: new Date().toISOString(),
//       lastAccess: "Never",
//       attendanceRate: 0,
//       accessCount: 0,
//     });

//     setShowAddModal(false);
//     setNewFaculty({
//       name: "",
//       department: "",
//       cardId: "",
//       fingerprintId: "",
//       email: "",
//       phone: "",
//       clearance: false,
//       active: true,
//     });
//   };

//   const handleDeleteFaculty = async (id: string) => {
//     if (confirm("Are you sure you want to delete this faculty member?")) {
//       const db = getRealtimeDb();
//       const facultyRef = ref(db, `users/${id}`);
//       await remove(facultyRef);
//     }
//   };

//   const handleToggleClearance = async (id: string, currentStatus: boolean) => {
//     const db = getRealtimeDb();
//     const facultyRef = ref(db, `users/${id}/clearance`);
//     await set(facultyRef, !currentStatus);
//   };

//   const handleToggleActive = async (id: string, currentStatus: boolean) => {
//     const db = getRealtimeDb();
//     const facultyRef = ref(db, `users/${id}/active`);
//     await set(facultyRef, !currentStatus);
//   };

//   const handleViewHistory = (facultyMember: Faculty) => {
//     setSelectedFaculty(facultyMember);
//     setShowHistoryModal(true);
//   };

//   const getFacultyLogs = () => {
//     if (!selectedFaculty) return [];
//     return accessLogs.filter((log) => log.user === selectedFaculty.name);
//   };

//   const handleLogout = () => {
//     signOut(auth);
//     navigate("/");
//   };

//   const formatTime = (date: Date) => {
//     return date.toLocaleTimeString("en-US", {
//       hour: "2-digit",
//       minute: "2-digit",
//       second: "2-digit",
//     });
//   };

//   const formatDate = (date: Date) => {
//     return date.toLocaleDateString("en-US", {
//       weekday: "long",
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     });
//   };

//   const stats = {
//     total: faculty.length,
//     active: faculty.filter((f) => f.active).length,
//     cleared: faculty.filter((f) => f.clearance).length,
//     pending: faculty.filter((f) => !f.clearance).length,
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
//       {/* Header Bar - Same as Dashboard */}
//       <header className="bg-white shadow-md border-b border-gray-200">
//         <div className="px-6 py-4 flex justify-between items-center">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-800">
//               🛡️ SmartGuard Admin Dashboard
//             </h1>
//             <p className="text-sm text-gray-500">
//               Cavite State University - Imus Campus
//             </p>
//           </div>
//           <div className="flex items-center gap-6">
//             <div className="text-right">
//               <p className="text-sm font-semibold text-gray-700">
//                 {formatTime(currentTime)}
//               </p>
//               <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
//             </div>
//             <div className="relative group">
//               <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all">
//                 <span className="text-sm font-medium">👤 {adminName}</span>
//                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//                 </svg>
//               </button>
//               <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
//                 <button
//                   onClick={handleLogout}
//                   className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
//                 >
//                   🚪 Logout
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </header>

//       <div className="flex">
//         {/* Sidebar */}
//         <Sidebar activePage="/faculty" />

//         {/* Main Content */}
//         <main className="flex-1 p-6">
//           {/* Page Title */}
//           <div className="mb-6">
//             <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
//               <span className="text-4xl">👨‍🏫</span>
//               Faculty Management
//             </h2>
//             <p className="text-sm text-gray-600 mt-1">
//               Manage faculty members, clearance, and access permissions
//             </p>
//           </div>

//           {/* Stats Cards */}
//           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
//             <StatCard title="Total Faculty" value={stats.total} icon="👥" color="from-blue-500 to-blue-600" bgColor="bg-blue-50" />
//             <StatCard title="Active" value={stats.active} icon="✅" color="from-green-500 to-green-600" bgColor="bg-green-50" />
//             <StatCard title="Cleared" value={stats.cleared} icon="🎓" color="from-purple-500 to-purple-600" bgColor="bg-purple-50" />
//             <StatCard title="Pending Clearance" value={stats.pending} icon="⏳" color="from-orange-500 to-orange-600" bgColor="bg-orange-50" />
//           </div>

//           {/* Controls */}
//           <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//             <div className="flex gap-4 items-center flex-wrap">
//               <div className="flex-1 min-w-[200px]">
//                 <input
//                   type="text"
//                   placeholder="🔍 Search faculty..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                 />
//               </div>
//               <select
//                 value={filterStatus}
//                 onChange={(e) => setFilterStatus(e.target.value as any)}
//                 className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//               >
//                 <option value="all">All Status</option>
//                 <option value="active">Active Only</option>
//                 <option value="inactive">Inactive Only</option>
//               </select>
//               <select
//                 value={filterClearance}
//                 onChange={(e) => setFilterClearance(e.target.value as any)}
//                 className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//               >
//                 <option value="all">All Clearance</option>
//                 <option value="cleared">Cleared</option>
//                 <option value="pending">Pending</option>
//               </select>
//               <button
//                 onClick={() => setShowAddModal(true)}
//                 className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
//               >
//                 ➕ Add Faculty
//               </button>
//             </div>
//           </div>

//           {/* Faculty Table */}
//           <div className="bg-white rounded-xl shadow-lg overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
//                   <tr>
//                     <th className="px-6 py-4 text-left font-semibold">Name</th>
//                     <th className="px-6 py-4 text-left font-semibold">Department</th>
//                     <th className="px-6 py-4 text-left font-semibold">Card ID</th>
//                     <th className="px-6 py-4 text-left font-semibold">Fingerprint</th>
//                     <th className="px-6 py-4 text-left font-semibold">Clearance</th>
//                     <th className="px-6 py-4 text-left font-semibold">Status</th>
//                     <th className="px-6 py-4 text-left font-semibold">Last Access</th>
//                     <th className="px-6 py-4 text-left font-semibold">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-gray-200">
//                   {filteredFaculty.length === 0 ? (
//                     <tr>
//                       <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
//                         <div className="text-6xl mb-4">📭</div>
//                         <p className="text-lg font-semibold">No faculty members found</p>
//                         <p className="text-sm">Try adjusting your filters or add a new faculty member</p>
//                       </td>
//                     </tr>
//                   ) : (
//                     filteredFaculty.map((f) => (
//                       <tr key={f.id} className="hover:bg-indigo-50 transition-colors">
//                         <td className="px-6 py-4">
//                           <div>
//                             <p className="font-semibold text-gray-900">{f.name}</p>
//                             <p className="text-sm text-gray-500">{f.email}</p>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 text-gray-700">{f.department}</td>
//                         <td className="px-6 py-4">
//                           <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-mono">
//                             {f.cardId}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4">
//                           <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-mono">
//                             {f.fingerprintId}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4">
//                           <button
//                             onClick={() => handleToggleClearance(f.id, f.clearance)}
//                             className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
//                               f.clearance
//                                 ? "bg-green-100 text-green-700 hover:bg-green-200"
//                                 : "bg-orange-100 text-orange-700 hover:bg-orange-200"
//                             }`}
//                           >
//                             {f.clearance ? "✅ Cleared" : "⏳ Pending"}
//                           </button>
//                         </td>
//                         <td className="px-6 py-4">
//                           <button
//                             onClick={() => handleToggleActive(f.id, f.active)}
//                             className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
//                               f.active
//                                 ? "bg-green-100 text-green-700 hover:bg-green-200"
//                                   : "bg-red-100 text-red-700 hover:bg-red-200"
//                             }`}
//                           >
//                             {f.active ? "🟢 Active" : "🔴 Inactive"}
//                           </button>
//                         </td>
//                         <td className="px-6 py-4 text-sm text-gray-600">{f.lastAccess}</td>
//                         <td className="px-6 py-4">
//                           <div className="flex gap-2">
//                             <button
//                               onClick={() => handleViewHistory(f)}
//                               className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-semibold"
//                             >
//                               📊
//                             </button>
//                             <button
//                               onClick={() => handleDeleteFaculty(f.id)}
//                               className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
//                             >
//                               🗑️
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </main>
//       </div>

//       {/* Add Faculty Modal */}
//       {showAddModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-t-2xl">
//               <h2 className="text-2xl font-bold">➕ Add New Faculty Member</h2>
//               <p className="text-sm opacity-90 mt-1">All fields are required *</p>
//             </div>
//             <div className="p-6 space-y-4">
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Full Name *
//                   </label>
//                   <input
//                     type="text"
//                     value={newFaculty.name}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     placeholder="Prof. Juan Dela Cruz"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Department *
//                   </label>
//                   <select
//                     value={newFaculty.department}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, department: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     required
//                   >
//                     <option value="">Select Department</option>
//                     <option value="Computer Science">Computer Science</option>
//                     <option value="Engineering">Engineering</option>
//                     <option value="Mathematics">Mathematics</option>
//                     <option value="Physics">Physics</option>
//                     <option value="Chemistry">Chemistry</option>
//                     <option value="Biology">Biology</option>
//                   </select>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     RFID Card ID * <span className="text-xs text-gray-500">(Format: FAC001)</span>
//                   </label>
//                   <input
//                     type="text"
//                     value={newFaculty.cardId}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, cardId: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     placeholder="FAC001"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Fingerprint ID * <span className="text-xs text-gray-500">(Format: FP001)</span>
//                   </label>
//                   <input
//                     type="text"
//                     value={newFaculty.fingerprintId}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, fingerprintId: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     placeholder="FP001"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Email Address *
//                   </label>
//                   <input
//                     type="email"
//                     value={newFaculty.email}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     placeholder="faculty@cvsu.edu.ph"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-semibold text-gray-700 mb-2">
//                     Phone Number * <span className="text-xs text-gray-500">(PH: +63 or 09)</span>
//                   </label>
//                   <input
//                     type="tel"
//                     value={newFaculty.phone}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })}
//                     className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
//                     placeholder="+63 912 345 6789"
//                     required
//                   />
//                 </div>
//               </div>
//               <div className="flex items-center gap-4 pt-4">
//                 <label className="flex items-center gap-2 cursor-pointer">
//                   <input
//                     type="checkbox"
//                     checked={newFaculty.clearance}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, clearance: e.target.checked })}
//                     className="w-5 h-5 text-indigo-500 rounded focus:ring-2 focus:ring-indigo-500"
//                   />
//                   <span className="text-sm font-semibold text-gray-700">Grant Clearance</span>
//                 </label>
//                 <label className="flex items-center gap-2 cursor-pointer">
//                   <input
//                     type="checkbox"
//                     checked={newFaculty.active}
//                     onChange={(e) => setNewFaculty({ ...newFaculty, active: e.target.checked })}
//                     className="w-5 h-5 text-indigo-500 rounded focus:ring-2 focus:ring-indigo-500"
//                   />
//                   <span className="text-sm font-semibold text-gray-700">Active Status</span>
//                 </label>
//               </div>
//             </div>
//             <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
//               <button
//                 onClick={() => setShowAddModal(false)}
//                 className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleAddFaculty}
//                 className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
//               >
//                 ✅ Add Faculty
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* History Modal */}
//       {showHistoryModal && selectedFaculty && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-t-2xl">
//               <h2 className="text-2xl font-bold">📊 Access History - {selectedFaculty.name}</h2>
//               <p className="text-sm opacity-90 mt-1">{selectedFaculty.department}</p>
//             </div>
//             <div className="p-6">
//               <div className="grid grid-cols-3 gap-4 mb-6">
//                 <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
//                   <p className="text-sm text-blue-600 font-semibold">Total Access</p>
//                   <p className="text-3xl font-bold text-blue-700">{selectedFaculty.accessCount}</p>
//                 </div>
//                 <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
//                   <p className="text-sm text-green-600 font-semibold">Attendance Rate</p>
//                   <p className="text-3xl font-bold text-green-700">{selectedFaculty.attendanceRate}%</p>
//                 </div>
//                 <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
//                   <p className="text-sm text-purple-600 font-semibold">Last Access</p>
//                   <p className="text-lg font-bold text-purple-700">{selectedFaculty.lastAccess}</p>
//                 </div>
//               </div>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead className="bg-gray-100">
//                     <tr>
//                       <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
//                       <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Method</th
