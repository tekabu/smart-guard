import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase.ts";
import { useNavigate } from "react-router-dom";

interface Device {
  id: string;
  name: string;
  location: string;
  status: "locked" | "unlocked";
  lastSeen: string;
  online: boolean;
}

interface Log {
  timestamp: string;
  user: string;
  method: "RFID" | "Fingerprint";
  result: "Granted" | "Denied";
  door: string;
  description: string;
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [summary, setSummary] = useState({
    activeClasses: 3,
    unlockedDoors: 1,
    unauthorized: 5,
    devicesOnline: 2,
    emergency: 0,
  });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  // Fetch Devices with real-time updates
  useEffect(() => {
    const unsubscribe = db.collection("devices").onSnapshot(snapshot => {
      const devicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Device[];
      setDevices(devicesData);
    });
    return unsubscribe;
  }, []);

  // Fetch Logs with real-time updates
  useEffect(() => {
    const unsubscribe = db.collection("accessLogs")
      .orderBy("timestamp", "desc")
      .limit(10)
      .onSnapshot(snapshot => {
        const logsData = snapshot.docs.map((doc: any) => doc.data()) as Log[];
        setLogs(logsData);
      });
    return unsubscribe;
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
          <h2 className="text-3xl font-bold mb-6">Dashboard Home</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left: Summary Cards */}
            <div className="space-y-4">
              <SummaryCard title="Active Classes" value={summary.activeClasses} icon="🧑‍🏫" color="bg-blue-500" />
              <SummaryCard title="Doors Unlocked" value={summary.unlockedDoors} icon="🔓" color="bg-green-500" />
              <SummaryCard title="Unauthorized Attempts" value={summary.unauthorized} icon="⚠️" color="bg-red-500" />
              <SummaryCard title="Devices Online" value={summary.devicesOnline} icon="📶" color="bg-purple-500" />
              <SummaryCard title="Emergency Alerts" value={summary.emergency} icon="🚨" color="bg-orange-500" />
            </div>

            {/* Middle: Live Activity Feed */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">📡</span> Live Access Activity
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center text-sm border-b pb-2">
                    <span className="text-gray-500 w-32">{log.timestamp}</span>
                    <span className="font-medium w-32">{log.user}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{log.method}</span>
                    <span className={`mx-2 font-bold ${log.result === "Granted" ? "text-green-600" : "text-red-600"}`}>
                      {log.result === "Granted" ? "✅" : "❌"} {log.result}
                    </span>
                    <span className="text-gray-600">{log.door}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Device Status */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">🖥️</span> Device Status
              </h3>
              <div className="space-y-3">
                {devices.map(device => (
                  <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{device.name}</p>
                      <p className="text-sm text-gray-600">{device.location}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${device.status === "unlocked" ? "text-green-600" : "text-red-600"}`}>
                        {device.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked"}
                      </p>
                      <p className="text-xs text-gray-500">Last: {device.lastSeen}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: Analytics Snapshot */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Analytics Snapshot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <h4 className="font-semibold mb-2">Access Frequency (Last 24h)</h4>
                <div className="h-32 bg-gray-100 rounded flex items-end justify-center">
                  <div className="w-8 bg-blue-500 rounded-t" style={{ height: '60%' }}></div>
                  <div className="w-8 bg-blue-500 rounded-t ml-2" style={{ height: '80%' }}></div>
                  <div className="w-8 bg-blue-500 rounded-t ml-2" style={{ height: '40%' }}></div>
                </div>
              </div>
              <div className="text-center">
                <h4 className="font-semibold mb-2">Attendance Rate</h4>
                <div className="h-32 bg-gray-100 rounded flex items-end justify-center">
                  <div className="w-8 bg-green-500 rounded-t" style={{ height: '90%' }}></div>
                  <div className="w-8 bg-green-500 rounded-t ml-2" style={{ height: '85%' }}></div>
                  <div className="w-8 bg-green-500 rounded-t ml-2" style={{ height: '95%' }}></div>
                </div>
              </div>
              <div className="text-center">
                <h4 className="font-semibold mb-2">Unauthorized Attempts</h4>
                <div className="h-32 bg-gray-100 rounded flex items-end justify-center">
                  <div className="w-8 bg-red-500 rounded-t" style={{ height: '20%' }}></div>
                  <div className="w-8 bg-red-500 rounded-t ml-2" style={{ height: '10%' }}></div>
                  <div className="w-8 bg-red-500 rounded-t ml-2" style={{ height: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Card
function SummaryCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className={`${color} text-white p-5 rounded-xl shadow-md`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  return (
    <div className="w-64 bg-white rounded-2xl shadow-lg p-6">
      <nav className="space-y-4">
        <button onClick={() => navigate("/dashboard")} className="w-full text-left py-2 px-4 rounded-lg bg-blue-100">🏠 Dashboard</button>
        <button onClick={() => navigate("/faculty")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">👨‍🏫 Faculty</button>
        <button onClick={() => navigate("/students")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🎓 Students</button>
        <button onClick={() => navigate("/sessions")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🕒 Sessions</button>
        <button onClick={() => navigate("/door-control")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚪 Door Control</button>
        <button onClick={() => navigate("/security")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚨 Security</button>
        <button onClick={() => navigate("/reports")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">📊 Reports</button>
        <button onClick={() => navigate("/settings")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
      </nav>
    </div>
  );
}
