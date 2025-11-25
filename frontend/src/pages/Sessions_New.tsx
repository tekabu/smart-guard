import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, getRealtimeDb } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ref, onValue, off, set, push } from "firebase/database";
import { toast } from "react-toastify";
import Sidebar from "../components/Sidebar";
import StartSessionModal from "../components/StartSessionModal";

interface Session {
  id: string;
  sessionId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  room: string;
  status: "Active" | "Ended";
  started: string;
  ended: string | null;
  attendance: Record<string, AttendanceRecord>;
  attendanceCount: number;
}

interface AttendanceRecord {
  name: string;
  studentId: string;
  timeIn: string;
  method: "RFID" | "Fingerprint";
}

export default function Sessions() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "ended">("all");
  const [showStartModal, setShowStartModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [adminName, setAdminName] = useState("Admin");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
      else setAdminName(user.email?.split("@")[0] || "Admin");
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Sessions from Firebase with REAL-TIME updates
  useEffect(() => {
    const db = getRealtimeDb();
    const sessionsRef = ref(db, "sessions");

    // Real-time listener - updates immediately when Firebase changes
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sessionsList: Session[] = Object.entries(data)
          .filter(([key]) => key !== 'active') // Exclude the 'active' node
          .map(([key, value]: [string, any]) => {
            const attendanceObj = value.attendance || {};
            const attendanceCount = Object.keys(attendanceObj).length;
            
            return {
              id: key,
              sessionId: value.sessionId || key,
              subjectId: value.subjectId || '',
              subjectCode: value.subjectCode || 'N/A',
              subjectName: value.subjectName || 'Unknown',
              facultyId: value.facultyId || '',
              facultyName: value.facultyName || 'Unknown',
              room: value.room || 'N/A',
              status: value.status || 'Ended',
              started: value.started || 'N/A',
              ended: value.ended || null,
              attendance: attendanceObj,
              attendanceCount: attendanceCount,
            };
          });

        // Sort by started time (newest first)
        sessionsList.sort((a, b) => {
          const timeA = new Date(a.started).getTime();
          const timeB = new Date(b.started).getTime();
          return timeB - timeA;
        });

        setSessions(sessionsList);
        setFilteredSessions(sessionsList);
        
        // IMPORTANT: Auto-update selected session if viewing attendance modal
        if (selectedSession && showAttendanceModal) {
          const updatedSession = sessionsList.find(s => s.id === selectedSession.id);
          if (updatedSession) {
            setSelectedSession(updatedSession);
            console.log(`✅ Attendance updated: ${updatedSession.attendanceCount} students`);
          }
        }
      } else {
        setSessions([]);
        setFilteredSessions([]);
      }
    });

    return () => off(sessionsRef, "value", unsubscribe);
  }, [selectedSession, showAttendanceModal]);

  // Additional: Force refresh every 2 seconds for active sessions
  useEffect(() => {
    const interval = setInterval(() => {
      const db = getRealtimeDb();
      const sessionsRef = ref(db, "sessions");
      
      // Trigger a manual refresh
      onValue(sessionsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const sessionsList: Session[] = Object.entries(data)
            .filter(([key]) => key !== 'active')
            .map(([key, value]: [string, any]) => {
              const attendanceObj = value.attendance || {};
              const attendanceCount = Object.keys(attendanceObj).length;
              
              return {
                id: key,
                sessionId: value.sessionId || key,
                subjectId: value.subjectId || '',
                subjectCode: value.subjectCode || 'N/A',
                subjectName: value.subjectName || 'Unknown',
                facultyId: value.facultyId || '',
                facultyName: value.facultyName || 'Unknown',
                room: value.room || 'N/A',
                status: value.status || 'Ended',
                started: value.started || 'N/A',
                ended: value.ended || null,
                attendance: attendanceObj,
                attendanceCount: attendanceCount,
              };
            });

          sessionsList.sort((a, b) => {
            const timeA = new Date(a.started).getTime();
            const timeB = new Date(b.started).getTime();
            return timeB - timeA;
          });

          setSessions(sessionsList);
          
          // Update selected session if modal is open
          if (selectedSession && showAttendanceModal) {
            const updatedSession = sessionsList.find(s => s.id === selectedSession.id);
            if (updatedSession) {
              setSelectedSession(updatedSession);
            }
          }
        }
      }, { onlyOnce: true });
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [selectedSession, showAttendanceModal]);

  useEffect(() => {
    let filtered = sessions;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.room.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((s) =>
        filterStatus === "active" ? s.status === "Active" : s.status === "Ended"
      );
    }

    setFilteredSessions(filtered);
  }, [searchTerm, filterStatus, sessions]);

  const handleStartSession = async (sessionData: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    facultyId: string;
    facultyName: string;
    room: string;
  }) => {
    try {
      const db = getRealtimeDb();
      const sessionsRef = ref(db, "sessions");
      const newSessionRef = push(sessionsRef);

      const sessionId = `SESSION_${Date.now()}`;
      const now = new Date();

      // Write session data
      await set(newSessionRef, {
        sessionId: sessionId,
        subjectId: sessionData.subjectId,
        subjectCode: sessionData.subjectCode,
        subjectName: sessionData.subjectName,
        facultyId: sessionData.facultyId,
        facultyName: sessionData.facultyName,
        room: sessionData.room,
        status: "Active",
        started: now.toISOString(),
        ended: null,
        attendance: {},
        createdAt: now.toISOString(),
      });

      // IMPORTANT: Write to /sessions/active/sessionId so NodeMCU can detect it
      const activeSessionRef = ref(db, "sessions/active");
      await set(activeSessionRef, {
        sessionId: sessionId,
        firebaseKey: newSessionRef.key,
        subjectCode: sessionData.subjectCode,
        subjectName: sessionData.subjectName,
        facultyName: sessionData.facultyName,
        room: sessionData.room,
      });

      toast.success(`✅ Session started: ${sessionData.subjectName}`);
      setShowStartModal(false);
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("❌ Failed to start session. Please try again.");
    }
  };

  const handleEndSession = async (sessionId: string, sessionName: string) => {
    if (!confirm(`End session: ${sessionName}?`)) return;

    try {
      const db = getRealtimeDb();
      const sessionRef = ref(db, `sessions/${sessionId}`);
      
      // Update session status to Ended
      await set(sessionRef, {
        ...sessions.find(s => s.id === sessionId),
        status: "Ended",
        ended: new Date().toISOString(),
      });

      // IMPORTANT: Remove from /sessions/active so NodeMCU knows session ended
      const activeSessionRef = ref(db, "sessions/active");
      await set(activeSessionRef, {
        sessionId: "",
      });

      toast.success("✅ Session ended successfully");
    } catch (error) {
      console.error("Error ending session:", error);
      toast.error("❌ Failed to end session");
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    if (!confirm(`⚠️ Delete session: ${sessionName}?\n\nThis will permanently delete the session and all attendance records. This action cannot be undone.`)) return;

    try {
      const db = getRealtimeDb();
      const sessionRef = ref(db, `sessions/${sessionId}`);
      
      // Delete the session
      await set(sessionRef, null);

      toast.success("✅ Session deleted successfully");
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("❌ Failed to delete session");
    }
  };

  const handleViewAttendance = (session: Session) => {
    setSelectedSession(session);
    setShowAttendanceModal(true);
  };

  const handleExportCSV = () => {
    if (!selectedSession) return;

    const attendanceArray = Object.values(selectedSession.attendance);
    
    let csv = 'Student ID,Student Name,Time In,Method\n';
    attendanceArray.forEach((record) => {
      csv += `${record.studentId},${record.name},${record.timeIn},${record.method}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSession.sessionId}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('✅ CSV file downloaded successfully!');
  };

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stats = {
    total: sessions.length,
    active: sessions.filter((s) => s.status === "Active").length,
    ended: sessions.filter((s) => s.status === "Ended").length,
    totalAttendance: sessions.reduce((sum, s) => sum + s.attendanceCount, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              🛡️ SmartGuard Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Cavite State University - Imus Campus
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">{formatTime(currentTime)}</p>
              <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all">
                <span className="text-sm font-medium">👤 {adminName}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <Sidebar activePage="/sessions" />

        <main className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="text-4xl">📅</span>
              Session Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Start class sessions and monitor real-time attendance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Sessions" value={stats.total} icon="📊" color="from-blue-500 to-blue-600" bgColor="bg-blue-50" />
            <StatCard title="Active Now" value={stats.active} icon="🟢" color="from-green-500 to-green-600" bgColor="bg-green-50" />
            <StatCard title="Ended" value={stats.ended} icon="🔴" color="from-red-500 to-red-600" bgColor="bg-red-50" />
            <StatCard title="Total Attendance" value={stats.totalAttendance} icon="👥" color="from-purple-500 to-purple-600" bgColor="bg-purple-50" />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="🔍 Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none">
                <option value="all">All Sessions</option>
                <option value="active">Active Only</option>
                <option value="ended">Ended Only</option>
              </select>
              <button onClick={() => setShowStartModal(true)} className="px-6 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                🚀 Start Session
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Session ID</th>
                    <th className="px-6 py-4 text-left font-semibold">Subject</th>
                    <th className="px-6 py-4 text-left font-semibold">Faculty</th>
                    <th className="px-6 py-4 text-left font-semibold">Room</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Started</th>
                    <th className="px-6 py-4 text-left font-semibold">Attendance</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <div className="text-6xl mb-4">📅</div>
                        <p className="text-lg font-semibold">No sessions found</p>
                        <p className="text-sm">Start a new session to begin tracking attendance</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-indigo-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-mono">
                            {session.sessionId.substring(0, 15)}...
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{session.subjectName}</p>
                            <p className="text-xs text-gray-500">{session.subjectCode}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {session.facultyName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                            {session.room}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              session.status === "Active"
                                ? "bg-green-100 text-green-700 animate-pulse"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {session.status === "Active" ? "🟢 Active" : "🔴 Ended"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(session.started)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                            👥 {session.attendanceCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewAttendance(session)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-semibold"
                              title="View Attendance"
                            >
                              👥
                            </button>
                            {session.status === "Active" && (
                              <button
                                onClick={() => handleEndSession(session.id, session.subjectName)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
                                title="End Session"
                              >
                                ⏹️
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSession(session.id, session.subjectName)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-semibold"
                              title="Delete Session"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Start Session Modal */}
      <StartSessionModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStartSession={handleStartSession}
      />

      {/* Attendance Modal */}
      {showAttendanceModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">📋 Attendance Record</h2>
                  <p className="text-sm opacity-90 mt-1">
                    {selectedSession.subjectCode} - {selectedSession.subjectName}
                  </p>
                  <p className="text-sm opacity-90">
                    {selectedSession.facultyName} • Room {selectedSession.room}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    Started: {formatDateTime(selectedSession.started)}
                    {selectedSession.ended && ` • Ended: ${formatDateTime(selectedSession.ended)}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">
                    Total Students: <span className="text-blue-600">{selectedSession.attendanceCount}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <span>📊</span> Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-4">Student ID</th>
                      <th className="text-left py-3 px-4">Student Name</th>
                      <th className="text-left py-3 px-4">Time In</th>
                      <th className="text-left py-3 px-4">Method</th>
                      <th className="text-left py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(selectedSession.attendance).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          <p className="text-4xl mb-2">📭</p>
                          <p>No attendance records yet</p>
                          <p className="text-sm">Students will appear here when they tap their RFID/Fingerprint</p>
                        </td>
                      </tr>
                    ) : (
                      Object.values(selectedSession.attendance).map((record, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50 transition">
                          <td className="py-3 px-4 font-semibold">{index + 1}</td>
                          <td className="py-3 px-4 font-mono text-sm">{record.studentId}</td>
                          <td className="py-3 px-4 font-semibold">{record.name}</td>
                          <td className="py-3 px-4 text-sm">{formatDateTime(record.timeIn)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              record.method === 'RFID' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {record.method}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                              ✓ Present
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  bgColor,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-3xl">{icon}</span>
        <span className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
          {value}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full animate-pulse`} style={{ width: "70%" }}></div>
      </div>
    </div>
  );
}
