import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, getRealtimeDb } from "../firebase";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

interface Session {
  id: string;
  sessionId: string;
  subjectCode?: string;
  subjectName?: string;
  facultyName: string;
  room: string;
  status: "Active" | "Ended";
  started: string;
  ended?: string | null;
  attendance: Record<string, RealtimeAttendanceRecord>;
}

interface RealtimeAttendanceRecord {
  studentId: string;
  name: string;
  timeIn: string;
  method: "RFID" | "Fingerprint";
  status?: "present" | "absent" | "late";
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  status: "present" | "absent" | "late";
  method: "RFID" | "Fingerprint" | "OTP" | "Manual";
}

export default function Attendance() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adminName, setAdminName] = useState("Admin User");

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
      else setAdminName(user.email?.split("@")[0] || "Admin");
    });
    return unsubscribe;
  }, [navigate]);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const mapAttendanceFromSession = (session: Session | undefined): AttendanceRecord[] => {
    if (!session || !session.attendance) return [];

    return Object.entries(session.attendance).map(([key, record]) => ({
      id: key,
      studentId: record.studentId || key,
      studentName: record.name || "Unknown Student",
      timestamp: record.timeIn || "",
      status: record.status || "present",
      method: (record.method || "RFID") as AttendanceRecord["method"],
    }));
  };

  useEffect(() => {
    const db = getRealtimeDb();
    const sessionsRef = ref(db, "sessions");

    const unsubscribe = onValue(
      sessionsRef,
      (snapshot) => {
        const data = snapshot.val();

        if (!data) {
          setSessions([]);
          setAttendance([]);
          setLoading(false);
          return;
        }

        const sessionList: Session[] = Object.entries(data)
          .filter(([key]) => key !== "active")
          .map(([key, value]: [string, any]) => ({
            id: key,
            sessionId: value.sessionId || key,
            subjectCode: value.subjectCode,
            subjectName: value.subjectName,
            facultyName: value.facultyName || "Unknown",
            room: value.room || "N/A",
            status: value.status || "Ended",
            started: value.started || "",
            ended: value.ended || null,
            attendance: value.attendance || {},
          }));

        sessionList.sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime());

        setSessions(sessionList);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading sessions:", err);
        setError("Failed to load sessions from database");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedSession) {
      setAttendance([]);
      return;
    }

    const session = sessions.find((s) => s.id === selectedSession);

    if (!session) {
      setSelectedSession("");
      setAttendance([]);
      return;
    }

    setAttendance(mapAttendanceFromSession(session));
  }, [selectedSession, sessions]);

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId);
    const session = sessions.find((s) => s.id === sessionId);
    setAttendance(mapAttendanceFromSession(session));
  };

  const exportToCSV = () => {
    if (attendance.length === 0) {
      alert("No attendance data to export");
      return;
    }

    const headers = ["Student ID", "Student Name", "Timestamp", "Status", "Method"];
    const rows = filteredAttendance.map(record => [
      record.studentId,
      record.studentName,
      record.timestamp,
      record.status,
      record.method
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedSession}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printAttendance = () => {
    window.print();
  };

  const filteredAttendance = attendance.filter(record => {
    const matchesSearch = record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || record.status === filterStatus;
    const matchesDate = !filterDate || record.timestamp.includes(filterDate);
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const stats = {
    total: attendance.length,
    present: attendance.filter(r => r.status === "present").length,
    absent: attendance.filter(r => r.status === "absent").length,
    late: attendance.filter(r => r.status === "late").length,
    attendanceRate: attendance.length > 0 
      ? ((attendance.filter(r => r.status === "present").length / attendance.length) * 100).toFixed(1)
      : "0"
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A57E8] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading attendance system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
      {/* Header Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200/50 backdrop-blur-sm">
        <div className="px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* University Logo Placeholder */}
            <div className="w-12 h-12 bg-gradient-to-br from-[#3A57E8] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">CSU</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                SmartGuard Security System
              </h1>
              <p className="text-sm text-gray-500">
                Cavite State University - Imus Campus
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="text-xs text-gray-500">{currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200">
                <div className="w-8 h-8 bg-gradient-to-br from-[#3A57E8] to-[#A78BFA] rounded-lg flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {adminName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">{adminName}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar activePage="/attendance" />

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">📋 Attendance Management</h2>
            <p className="text-gray-600">Monitor and manage student attendance records</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={() => window.location.reload()} />}

          {/* Session Selector */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Session</label>
            <select
              value={selectedSession}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
            >
              <option value="">-- Choose a session --</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.facultyName} - {session.subjectName || 'No Subject'} - Room {session.room} ({session.status})
                </option>
              ))}
            </select>
          </div>

          {selectedSession && (
            <>
              {/* Session Info */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
                {(() => {
                  const session = sessions.find(s => s.id === selectedSession);
                  return session ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Session Details</h3>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Professor:</span> {session.facultyName} | 
                          <span className="font-medium"> Room:</span> {session.room} | 
                          <span className="font-medium"> Subject:</span> {session.subjectName || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Status:</span> {session.status}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Started:</span> {session.started}
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <StatCard title="Total Students" value={stats.total} icon="👥" gradient="from-blue-500 to-blue-600" />
                <StatCard title="Present" value={stats.present} icon="✅" gradient="from-green-500 to-green-600" />
                <StatCard title="Absent" value={stats.absent} icon="❌" gradient="from-red-500 to-red-600" />
                <StatCard title="Late" value={stats.late} icon="⏰" gradient="from-orange-500 to-orange-600" />
                <StatCard title="Attendance Rate" value={`${stats.attendanceRate}%`} icon="📊" gradient="from-purple-500 to-purple-600" />
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Search</label>
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Filter by Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Filter by Date</label>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={exportToCSV}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-md"
                    >
                      📥 Export CSV
                    </button>
                    <button
                      onClick={printAttendance}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
                    >
                      🖨️ Print
                    </button>
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex justify-center items-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : filteredAttendance.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <tr>
                          <th className="px-6 py-4 text-left font-bold">Student ID</th>
                          <th className="px-6 py-4 text-left font-bold">Student Name</th>
                          <th className="px-6 py-4 text-left font-bold">Timestamp</th>
                          <th className="px-6 py-4 text-left font-bold">Status</th>
                          <th className="px-6 py-4 text-left font-bold">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((record, index) => (
                          <tr key={record.id || index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-800">{record.studentId}</td>
                            <td className="px-6 py-4 text-gray-700">{record.studentName}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm">{record.timestamp}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                record.status === "present" ? "bg-green-100 text-green-700" :
                                record.status === "late" ? "bg-orange-100 text-orange-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {record.status === "present" ? "✅ Present" :
                                 record.status === "late" ? "⏰ Late" :
                                 "❌ Absent"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {record.method}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📭</div>
                      <p className="text-gray-500 text-lg">No attendance records found</p>
                      <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or select a different session</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!selectedSession && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Select a Session</h3>
              <p className="text-gray-600">Choose a session from the dropdown above to view attendance records</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, gradient }: { title: string; value: number | string; icon: string; gradient: string }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90 font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="text-4xl opacity-90">{icon}</div>
      </div>
    </div>
  );
}
