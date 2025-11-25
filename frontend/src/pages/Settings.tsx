import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api, ApiError } from "../utils/api";

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // System Settings
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [firebaseURL, setFirebaseURL] = useState("");
  const [firebaseCredentials, setFirebaseCredentials] = useState("");
  
  // Admin Users
  const [adminUsers, setAdminUsers] = useState([
    { username: "admin1", name: "John Doe", role: "Admin", lastLogin: "2023-10-01 10:00" },
    { username: "security1", name: "Jane Smith", role: "Security", lastLogin: "2023-10-02 14:30" },
  ]);
  
  // Local Data Sync
  const [lastSyncTime, setLastSyncTime] = useState("2023-10-01 12:00");
  const [recordsAwaitingUpload, setRecordsAwaitingUpload] = useState(5);
  
  // New Device Form
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [deviceId, setDeviceId] = useState("");
  
  // New Admin Form
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState("admin");
  const [adminNameForm, setAdminNameForm] = useState("");
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adminName, setAdminName] = useState("Admin User");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAdminName(user.email?.split("@")[0] || "Admin");
      }
      // Temporarily removed redirect for debugging
    });
    return unsubscribe;
  }, [navigate]);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  const handleEditResetPassword = (username: string) => {
    // Placeholder for edit/reset password functionality
    alert(`Edit/Reset Password for ${username}`);
  };

  const handleApplyConfiguration = async () => {
    setSaving(true);
    setError(null);

    try {
      // Send configuration to cloud and hardware
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert('✅ Configuration applied and pushed successfully!');
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to apply configuration';
      setError(errorMessage);
      alert(`❌ ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deviceName || !deviceLocation || !deviceId) {
      alert('⚠️ Please fill all device fields');
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert(`✅ Device "${deviceName}" registered successfully!`);
      setDeviceName("");
      setDeviceLocation("");
      setDeviceId("");
    } catch (err) {
      alert('❌ Failed to register device');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminEmail || !adminNameForm) {
      alert('⚠️ Please fill all admin fields');
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert(`✅ Admin "${adminNameForm}" added successfully!`);
      setAdminEmail("");
      setAdminNameForm("");
      setAdminRole("admin");
    } catch (err) {
      alert('❌ Failed to add admin');
    } finally {
      setSaving(false);
    }
  };

  const handleBackupData = async () => {
    if (!confirm('📦 Create a backup of all system data?')) {
      return;
    }

    setSaving(true);
    try {
      await api.backupData();
      alert('✅ Backup created successfully! Download will start shortly.');
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to create backup';
      alert(`❌ ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreData = () => {
    if (confirm('⚠️ Restore data from backup? This will overwrite current data.')) {
      alert('📥 Restore feature coming soon. Please upload backup file.');
    }
  };

  const handleResetSystem = () => {
    if (confirm('🚨 WARNING: This will reset all system settings to default. Continue?')) {
      if (confirm('⚠️ Are you absolutely sure? This action cannot be undone.')) {
        alert('🔄 System reset initiated (feature coming soon)');
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
                <div className="w-8 h-8 bg-linear-to-br from-[#3A57E8] to-[#A78BFA] rounded-lg flex items-center justify-center">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sticky Sidebar */}
        <div className="sticky top-0 h-screen">
          <Sidebar activePage="/settings" />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">System Settings</h2>
            <p className="text-gray-600">Configure system preferences and manage users</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Configuration */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">⚙️</span> System Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Wi-Fi SSID</label>
                  <input
                    type="text"
                    value={wifiSSID}
                    onChange={(e) => setWifiSSID(e.target.value)}
                    placeholder="Enter Wi-Fi SSID"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">SSID to be sent to the ESP8266 module</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Wi-Fi Password</label>
                  <input
                    type="password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Enter Wi-Fi Password"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Password to be sent to the ESP8266 module</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Firebase Database URL</label>
                  <input
                    type="text"
                    value={firebaseURL}
                    onChange={(e) => setFirebaseURL(e.target.value)}
                    placeholder="https://your-project.firebaseio.com/"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Firebase Database URL</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Firebase Credentials</label>
                  <textarea
                    value={firebaseCredentials}
                    onChange={(e) => setFirebaseCredentials(e.target.value)}
                    placeholder="Enter Firebase credentials JSON"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Firebase service account credentials</p>
                </div>

                <button
                  onClick={handleApplyConfiguration}
                  disabled={saving}
                  className="w-full bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '⏳ Applying...' : '🚀 Apply/Push Configuration'}
                </button>
              </div>
            </div>

            {/* Admin Users */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">👥</span> Admin Users
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-sm font-semibold">Username</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Role</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Last Login</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((user, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-sm">{user.username}</td>
                        <td className="px-4 py-2 text-sm">{user.name}</td>
                        <td className="px-4 py-2 text-sm">{user.role}</td>
                        <td className="px-4 py-2 text-sm">{user.lastLogin}</td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => handleEditResetPassword(user.username)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                          >
                            Edit/Reset Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Device Registration */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">📱</span> Register New Device
              </h3>

              <form onSubmit={handleRegisterDevice} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Device Name</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g., SmartGuard_03"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Door Location</label>
                  <select
                    value={deviceLocation}
                    onChange={(e) => setDeviceLocation(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select location...</option>
                    <option value="Front Door">Front Door</option>
                    <option value="Back Door">Back Door</option>
                    <option value="Faculty Exit">Faculty Exit</option>
                    <option value="Main Entrance">Main Entrance</option>
                    <option value="Side Entrance">Side Entrance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Device ID (MAC Address)</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="e.g., AA:BB:CC:DD:EE:FF"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '⏳ Registering...' : '➕ Register Device'}
                </button>
              </form>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> After registration, configure the device with the provided credentials and restart the NodeMCU.
                </p>
              </div>
            </div>

            {/* Admin Management */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">👥</span> Add Admin User
              </h3>

              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Full Name</label>
                  <input
                    type="text"
                    value={adminNameForm}
                    onChange={(e) => setAdminNameForm(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Email Address</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Role</label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="security">Security (Door Control & Monitoring)</option>
                    <option value="registrar">Registrar (Reports & Attendance)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '⏳ Adding...' : '➕ Add Admin'}
                </button>
              </form>
            </div>

            {/* Data Management */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">💾</span> Data Management
              </h3>

              <div className="space-y-3">
                <button
                  onClick={handleBackupData}
                  disabled={saving}
                  className="w-full bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>📦</span> Backup All Data
                </button>

                <button
                  onClick={handleRestoreData}
                  className="w-full bg-linear-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <span>📥</span> Restore from Backup
                </button>

                <button
                  onClick={handleResetSystem}
                  className="w-full bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <span>🔄</span> Reset System Settings
                </button>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  <strong>⚠️ Warning:</strong> Backup your data regularly. System reset will restore default settings.
                </p>
              </div>
            </div>
          </div>

          {/* Local Data Sync */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center">
              <span className="mr-2">🔄</span> Local Data Sync
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold">Last Sync Time</p>
                  <p className="text-sm text-gray-600">{lastSyncTime}</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold">Records Awaiting Upload</p>
                  <p className="text-sm text-gray-600">{recordsAwaitingUpload} records</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">ℹ️ System Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Version</p>
                <p className="text-lg font-bold">v1.0.0</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Database</p>
                <p className="text-lg font-bold">Firebase</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Uptime</p>
                <p className="text-lg font-bold">24h 15m</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Last Backup</p>
                <p className="text-lg font-bold">2 days ago</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
