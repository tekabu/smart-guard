import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";

interface Device {
  id: string;
  name: string;
  location: string;
}

export default function Settings() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [newDevice, setNewDevice] = useState({ name: "", location: "" });
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

  const addDevice = () => {
    fetch("http://localhost:3001/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDevice),
    }).then(() => {
      setDevices([...devices, { id: Date.now().toString(), ...newDevice }]);
      setNewDevice({ name: "", location: "" });
    });
  };

  const backupData = () => {
    fetch("http://localhost:3001/api/settings/backup", {
      method: "POST",
    }).then(r => r.json()).then(data => {
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = 'smartguard-backup.json';
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
          <h2 className="text-3xl font-bold mb-6">Settings / Configuration</h2>

          <div className="space-y-6">
            {/* Device Registration */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Device Registration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Device Name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="p-2 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
                  className="p-2 border rounded-lg"
                />
                <button
                  onClick={addDevice}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                >
                  Add Device
                </button>
              </div>
              <div className="space-y-2">
                {devices.map(d => (
                  <div key={d.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{d.name} - {d.location}</span>
                    <button className="text-red-500">Remove</button>
                  </div>
                ))}
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">System Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Auto-Lock Timer (seconds)</label>
                  <input type="number" defaultValue="5" className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Faculty Activation Window (minutes)</label>
                  <input type="number" defaultValue="15" className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Emergency Alert Threshold</label>
                  <input type="number" defaultValue="3" className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time Synchronization</label>
                  <button className="bg-green-500 text-white px-4 py-2 rounded-lg w-full">Sync Now</button>
                </div>
              </div>
              <button className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg">Save Settings</button>
            </div>

            {/* Admin Roles */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Admin Role Management</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-semibold">admin@smartguard.com</p>
                    <p className="text-sm text-gray-600">Role: Admin</p>
                  </div>
                  <select className="p-2 border rounded">
                    <option>Admin</option>
                    <option>Registrar</option>
                    <option>Security</option>
                  </select>
                </div>
                <button className="bg-green-500 text-white px-4 py-2 rounded-lg">Add New Admin</button>
              </div>
            </div>

            {/* Data Backup */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Data Backup</h3>
              <p className="text-gray-600 mb-4">Export all system data to JSON/CSV for backup purposes.</p>
              <button
                onClick={backupData}
                className="bg-purple-500 text-white px-6 py-2 rounded-lg"
              >
                📦 Backup All Data
              </button>
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
        <button onClick={() => navigate("/reports")} className="w-full text-left py-2 px-4 rounded-lg hover:bg-gray-100">📊 Reports</button>
        <button onClick={() => navigate("/settings")} className="w-full text-left py-2 px-4 rounded-lg bg-blue-100">⚙️ Settings</button>
      </nav>
    </div>
  );
}
