import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";

export default function Reports() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogout = () => signOut(auth);

  const generateReport = (type: string) => {
    fetch(`http://localhost:3001/api/reports/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateRange: "today" }),
    })
      .then(r => r.json())
      .then(data => {
        // Handle download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `${type}-report.pdf`;
        link.click();
      });
  };

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
          <h2 className="text-3xl font-bold mb-6">Reports and Analytics</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Daily Attendance Summary</h3>
              <p className="text-gray-600 mb-4">Generate daily attendance report for all sessions.</p>
              <button
                onClick={() => generateReport("daily-attendance")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Faculty Access Report</h3>
              <p className="text-gray-600 mb-4">Report on faculty access patterns and clearance status.</p>
              <button
                onClick={() => generateReport("faculty-access")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Student Attendance Report</h3>
              <p className="text-gray-600 mb-4">Detailed student attendance records per session.</p>
              <button
                onClick={() => generateReport("student-attendance")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Unauthorized Attempts Report</h3>
              <p className="text-gray-600 mb-4">Log of all unauthorized access attempts.</p>
              <button
                onClick={() => generateReport("unauthorized-attempts")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">System Usage Log</h3>
              <p className="text-gray-600 mb-4">Complete system activity and usage statistics.</p>
              <button
                onClick={() => generateReport("system-usage")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Faculty Exit Reasons</h3>
              <p className="text-gray-600 mb-4">Summary of reasons provided during faculty exits.</p>
              <button
                onClick={() => generateReport("faculty-exit-reasons")}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg w-full"
              >
                📄 Generate PDF
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
            <h3 className="text-xl font-bold mb-4">Report Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <select className="w-full p-2 border rounded-lg">
                  <option>Today</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Faculty</label>
                <select className="w-full p-2 border rounded-lg">
                  <option>All Faculty</option>
                  <option>Prof. Santos</option>
                  <option>Prof. Cruz</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Class/Session</label>
                <select className="w-full p-2 border rounded-lg">
                  <option>All Sessions</option>
                  <option>Session 01</option>
                  <option>Session 02</option>
                </select>
              </div>
            </div>
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
        <button onClick={() => navigate("/sessions")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🕒 Sessions</button>
        <button onClick={() => navigate("/door-control")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚪 Door Control</button>
        <button onClick={() => navigate("/security")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚨 Security</button>
        <button onClick={() => navigate("/reports")} className="w-full text-left py-2 px-4 rounded-lg bg-blue-100">📊 Reports</button>
        <button onClick={() => navigate("/settings")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
      </nav>
    </div>
  );
}
