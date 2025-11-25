import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

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

  const handleAccessMode = async (deviceId: string, mode: string) => {
    try {
      await fetch(`http://localhost:3001/api/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "set_access_mode", mode }),
      });
      alert(`✅ Access mode updated to ${mode}!`);
      // Refresh devices
      const response = await fetch("http://localhost:3001/api/devices");
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      alert('❌ Failed to update access mode');
    }
  };

  const handleDisableDevice = async (deviceId: string) => {
    if (confirm('Disable this device?')) {
      try {
        await fetch(`http://localhost:3001/api/devices/${deviceId}/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "disable" }),
        });
        alert('✅ Device disabled!');
        const response = await fetch("http://localhost:3001/api/devices");
        const data = await response.json();
        setDevices(data);
      } catch (error) {
        alert('❌ Failed to disable device');
      }
    }
  };

  const handleRestartDevice = async (deviceId: string) => {
    if (confirm('Force restart this device?')) {
      try {
        await fetch(`http://localhost:3001/api/devices/${deviceId}/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "restart" }),
        });
        alert('✅ Device restart command sent!');
      } catch (error) {
        alert('❌ Failed to restart device');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F9FC' }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200/50 backdrop-blur-sm">
        <div className="px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* University Logo Placeholder */}
            <div className="w-12 h-12 bg-linear-to-br from-[#3A57E8] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
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
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
              <p className="text-xs text-gray-500">{new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200">
                <div className="w-8 h-8 bg-linear-to-br from-[#3A57E8] to-[#A78BFA] rounded-lg flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    A
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">Admin</span>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sticky Sidebar */}
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Door Access Control Panel</h2>
            <p className="text-gray-600">Monitor and control door access devices</p>
          </div>
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
                  <button 
                    onClick={() => alert('Faculty window configuration coming soon!')}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Set Faculty Window
                  </button>
                  <button 
                    onClick={() => handleDisableDevice(device.id)}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
                  >
                    Disable Device
                  </button>
                  <button 
                    onClick={() => handleRestartDevice(device.id)}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
                  >
                    Force Restart
                  </button>
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
