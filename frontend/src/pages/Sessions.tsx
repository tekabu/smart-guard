import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";

interface Session {
  id: string;
  faculty: string;
  room: string;
  status: "Active" | "Ended";
  started: string;
  ended: string;
  attendance: number;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    fetch("http://localhost:3001/api/sessions")
      .then(r => r.json())
      .then(setSessions);
  }, []);

  const handleLogout = () => signOut(auth);

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
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 ml-6">
          <h2 className="text-3xl font-bold mb-6">Attendance & Session Management</h2>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Session ID</th>
                  <th className="text-left py-2">Faculty</th>
                  <th className="text-left py-2">Room</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Started</th>
                  <th className="text-left py-2">Ended</th>
                  <th className="text-left py-2">Attendance</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.id}</td>
                    <td className="py-2">{s.faculty}</td>
                    <td className="py-2">{s.room}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded ${s.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {s.status === "Active" ? "🟢" : "🔴"} {s.status}
                      </span>
                    </td>
                    <td className="py-2">{s.started}</td>
                    <td className="py-2">{s.ended || "-"}</td>
                    <td className="py-2">{s.attendance} Students</td>
                    <td className="py-2">
                      <button className="bg-blue-500 text-white px-3 py-1 rounded mr-2">View Attendance</button>
                      <button className="bg-yellow-500 text-white px-3 py-1 rounded mr-2">Export PDF</button>
                      {s.status === "Active" && <button className="bg-red-500 text-white px-3 py-1 rounded">End Session</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  return (
    <div className="w-64 bg-white rounded-2xl shadow-lg p-6">
      <nav className="space-y-4">
        <button onClick={() => navigate("/dashboard")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🏠 Dashboard</button>
        <button onClick={() => navigate("/faculty")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">👨‍🏫 Faculty</button>
        <button onClick={() => navigate("/students")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🎓 Students</button>
        <button onClick={() => navigate("/sessions")} className="w-full text-left py-2 px-4 rounded-lg bg-blue-100">🕒 Sessions</button>
        <button onClick={() => navigate("/door-control")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚪 Door Control</button>
        <button onClick={() => navigate("/security")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚨 Security</button>
        <button onClick={() => navigate("/reports")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">📊 Reports</button>
        <button onClick={() => navigate("/settings")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
      </nav>
    </div>
  );
}
