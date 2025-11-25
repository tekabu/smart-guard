import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";

interface Device {
  id: string;
  name: string;
  location: string;
  status: "locked" | "unlocked";
  lastSeen: string;
  online: boolean;
  accessMode: "rfid" | "fingerprint" | "both";
  facultyWindow: number;
}

export default function DoorControl() {
  const [devices, setDevices] = useState<Device[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    fetch("http://localhost:3001/api/devices")
      .then(r => r.json())
      .then(setDevices);
  }, []);

  const handleLogout = () => signOut(auth);

  const handleLockUnlock = (deviceId: string, action: "lock" | "unlock") => {
    fetch(`http://localhost:3001/api/devices/${deviceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: action }),
    });
  };

  const handleAccessMode = (deviceId: string, mode: string) => {
    fetch(`http://localhost:3001/api/devices/${deviceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "set_access_mode", mode }),
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
          <h2 className="text-3xl font-bold mb-6">Door Access Control Panel</h2>
          <div className="space-y-6">
            {devices.map(device => (
              <div key={device.id} className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">{device.name} - {device.location}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="font-semibold">Status</p>
                    <p className={`font-bold ${device.status === "unlocked" ? "text-green-600" : "text-red-600"}`}>
                      {device.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Last Seen</p>
                    <p>{device.lastSeen}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Connection</p>
                    <p className={device.online ? "text-green-600" : "text-red-600"}>
                      {device.online ? "Online" : "Offline"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Access Mode</p>
                    <p>{device.accessMode}</p>
                  </div>
                </div>
                <div className="mt-4 space-x-2">
                  <button
                    onClick={() => handleLockUnlock(device.id, device.status === "locked" ? "unlock" : "lock")}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      device.status === "locked" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}
                  >
                    {device.status === "locked" ? "Unlock Door" : "Lock Door"}
                  </button>
                  <select
                    onChange={(e) => handleAccessMode(device.id, e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    <option value="rfid">RFID Only</option>
                    <option value="fingerprint">Fingerprint Only</option>
                    <option value="both">Both Required</option>
                  </select>
                  <button className="bg-blue-500 text-white px-4 py-2 rounded-lg">Set Faculty Window</button>
                  <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg">Disable Device</button>
                  <button className="bg-purple-500 text-white px-4 py-2 rounded-lg">Force Restart</button>
                </div>
              </div>
            ))}
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
        <button onClick={() => navigate("/door-control")} className="w-full text-left py-2 px-4 rounded-lg bg-blue-100">🚪 Door Control</button>
        <button onClick={() => navigate("/security")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">🚨 Security</button>
        <button onClick={() => navigate("/reports")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">📊 Reports</button>
        <button onClick={() => navigate("/settings")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
      </nav>
    </div>
  );
}
