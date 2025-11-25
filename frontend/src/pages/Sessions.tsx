import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api, ApiError } from "../utils/api";

interface Session {
  id: string;
  faculty: string;
  room: string;
  status: "Active" | "Ended";
  started: string;
  ended: string;
  attendance: number;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  timeIn: string;
  method: string;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  const fetchData = async () => {
    try {
      setError(null);
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to load sessions';
      setError(errorMessage);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => signOut(auth);

  const handleViewAttendance = async (session: Session) => {
    setSelectedSession(session);
    setShowAttendanceModal(true);
    
    // Generate sample attendance records
    const sampleRecords: AttendanceRecord[] = [];
    for (let i = 1; i <= session.attendance; i++) {
      sampleRecords.push({
        studentId: `2024-${String(i).padStart(4, '0')}`,
        studentName: `Student ${i}`,
        timeIn: `${session.started} + ${i}min`,
        method: i % 2 === 0 ? 'RFID' : 'Fingerprint'
      });
    }
    setAttendanceRecords(sampleRecords);
  };

  const handleEndSession = async (sessionId: string) => {
    if (!confirm('End this session?')) return;

    setActionLoading(true);
    try {
      await api.updateSession(sessionId, { 
        status: 'Ended',
        ended: new Date().toLocaleTimeString()
      });
      alert('✅ Session ended successfully!');
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to end session';
      alert(`❌ ${errorMessage}`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPDF = async (sessionId: string, faculty: string) => {
    setActionLoading(true);
    try {
      await api.generateReport('session_attendance', { 
        sessionId,
        faculty,
        format: 'pdf'
      });
      alert(`✅ PDF Report generated successfully!\n\nReport Details:\n- Session: ${sessionId}\n- Faculty: ${faculty}\n- Format: PDF\n\nDownload will start shortly...`);
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to generate report';
      alert(`❌ ${errorMessage}`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedSession) return;
    
    // Generate CSV content
    let csv = 'Student ID,Student Name,Time In,Method\n';
    attendanceRecords.forEach(record => {
      csv += `${record.studentId},${record.studentName},${record.timeIn},${record.method}\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSession.id}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('✅ CSV file downloaded successfully!');
  };

  const handlePrintAttendance = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      {/* Top Nav */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg"></div>
            <h1 className="text-2xl font-bold text-gray-800">SmartGuard Admin</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 flex">
        <Sidebar activePage="/sessions" />

        <div className="flex-1 ml-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Attendance & Session Management</h2>
            <p className="text-gray-600">Monitor and manage class sessions</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={fetchData} />}

          <div className="bg-white rounded-2xl shadow-lg p-6">
            {sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4">Session ID</th>
                      <th className="text-left py-3 px-4">Faculty</th>
                      <th className="text-left py-3 px-4">Room</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Started</th>
                      <th className="text-left py-3 px-4">Ended</th>
                      <th className="text-left py-3 px-4">Attendance</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-mono text-sm">{s.id.substring(0, 8)}...</td>
                        <td className="py-3 px-4 font-semibold">{s.faculty}</td>
                        <td className="py-3 px-4">{s.room}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {s.status === "Active" ? "🟢" : "🔴"} {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{s.started}</td>
                        <td className="py-3 px-4 text-sm">{s.ended || "-"}</td>
                        <td className="py-3 px-4">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                            {s.attendance} Students
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleViewAttendance(s)}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition"
                            >
                              👥 View
                            </button>
                            <button 
                              onClick={() => handleExportPDF(s.id, s.faculty)}
                              disabled={actionLoading}
                              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition disabled:opacity-50"
                            >
                              📄 PDF
                            </button>
                            {s.status === "Active" && (
                              <button 
                                onClick={() => handleEndSession(s.id)}
                                disabled={actionLoading}
                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition disabled:opacity-50"
                              >
                                ⏹️ End
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-xl font-semibold text-gray-700">No Sessions Found</p>
                <p className="text-gray-500">Sessions will appear here once faculty starts a class</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold mb-2">📋 Attendance Record</h3>
                  <p className="text-blue-100">Session: {selectedSession.faculty} - Room {selectedSession.room}</p>
                  <p className="text-blue-100 text-sm">Started: {selectedSession.started}</p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">Total Students: <span className="text-blue-600">{attendanceRecords.length}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <span>📊</span> Export CSV
                  </button>
                  <button
                    onClick={handlePrintAttendance}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                  >
                    <span>🖨️</span> Print
                  </button>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4">#</th>
                    <th className="text-left py-3 px-4">Student ID</th>
                    <th className="text-left py-3 px-4">Student Name</th>
                    <th className="text-left py-3 px-4">Time In</th>
                    <th className="text-left py-3 px-4">Method</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 transition">
                      <td className="py-3 px-4 font-semibold">{index + 1}</td>
                      <td className="py-3 px-4 font-mono text-sm">{record.studentId}</td>
                      <td className="py-3 px-4">{record.studentName}</td>
                      <td className="py-3 px-4 text-sm">{record.timeIn}</td>
                      <td className="py-3 px-4">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {record.method}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                          ✓ Present
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition"
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
