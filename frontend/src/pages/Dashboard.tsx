import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api, ApiError } from "../utils/api";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      const [devicesData, logsData] = await Promise.all([
        api.getDevices(),
        api.getAccessLogs(),
      ]);

      setDevices(devicesData);
      setLogs(logsData);

      const unlockedDoors = devicesData.filter((d: Device) => d.status === "unlocked").length;
      const devicesOnline = devicesData.filter((d: Device) => d.online).length;
      const unauthorized = logsData.filter((log: Log) => log.result === "Denied").length;
      
      setSummary(prev => ({ ...prev, unlockedDoors, devicesOnline, unauthorized }));
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to load dashboard data';
      setError(errorMessage);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => signOut(auth);

  const handleEmergencyUnlock = async () => {
    if (!confirm('⚠️ Are you sure you want to trigger EMERGENCY UNLOCK for all doors?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.emergencyUnlock();
      alert('✅ Emergency unlock activated for all doors!');
      await fetchData(); // Refresh data
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to activate emergency unlock';
      alert(`❌ ${errorMessage}`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockAllDoors = async () => {
    if (!confirm('🔒 Lock all doors?')) {
      return;
    }

    setActionLoading(true);
    try {
      await Promise.all(
        devices.map(device => api.sendDeviceCommand(device.id, 'lock'))
      );
      alert('✅ All doors have been locked!');
      await fetchData(); // Refresh data
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to lock doors';
      alert(`❌ ${errorMessage}`);
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform">
              <span className="text-white text-xl font-bold">SG</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SmartGuard</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-5 py-2.5 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
            <span className="flex items-center gap-2"><span>🚪</span>Logout</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 flex gap-6">
        <Sidebar activePage="/dashboard" />

        <div className="flex-1">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Dashboard Home</h2>
            <p className="text-gray-600">Real-time monitoring and control center</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={fetchData} />}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <SummaryCard title="Active Classes" value={summary.activeClasses} icon="🧑‍🏫" gradient="from-blue-500 to-blue-600" />
            <SummaryCard title="Doors Unlocked" value={summary.unlockedDoors} icon="🔓" gradient="from-green-500 to-green-600" />
            <SummaryCard title="Unauthorized" value={summary.unauthorized} icon="⚠️" gradient="from-red-500 to-red-600" />
            <SummaryCard title="Devices Online" value={summary.devicesOnline} icon="📶" gradient="from-purple-500 to-purple-600" />
            <SummaryCard title="Emergency" value={summary.emergency} icon="🚨" gradient="from-orange-500 to-orange-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                <span className="mr-2 text-2xl">📡</span>
                <span>Live Access Activity</span>
                <span className="ml-auto w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.length > 0 ? logs.map((log, i) => (
                  <div key={i} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-3 hover:from-blue-50 hover:to-indigo-50 transition-all border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm text-gray-800">{log.user}</span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">{log.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="bg-white px-3 py-1 rounded-full font-medium text-gray-700 shadow-sm">{log.method}</span>
                      <span className={`font-bold px-3 py-1 rounded-full ${log.result === "Granted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {log.result === "Granted" ? "✅" : "❌"} {log.result}
                      </span>
                      <span className="text-gray-600 font-medium">{log.door}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-gray-500">No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                <span className="mr-2 text-2xl">🖥️</span> Device Status
              </h3>
              <div className="space-y-3">
                {devices.length > 0 ? devices.map(device => (
                  <div key={device.id} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-indigo-50 transition-all border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{device.name}</p>
                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                          <span>📍</span> {device.location}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${device.online ? "bg-green-500 text-white animate-pulse" : "bg-gray-400 text-white"}`}>
                        {device.online ? "● Online" : "○ Offline"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className={`font-bold text-sm ${device.status === "unlocked" ? "text-green-600" : "text-red-600"}`}>
                        {device.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked"}
                      </span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">⏰ {device.lastSeen}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🔌</div>
                    <p className="text-gray-500">No devices found</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                <span className="mr-2 text-2xl">⚡</span> Quick Actions
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={handleEmergencyUnlock}
                  disabled={actionLoading}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl">🚨</span><span>{actionLoading ? 'Processing...' : 'Emergency Unlock'}</span>
                </button>
                <button 
                  onClick={handleLockAllDoors}
                  disabled={actionLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl">🔒</span><span>{actionLoading ? 'Processing...' : 'Lock All Doors'}</span>
                </button>
                <button 
                  onClick={() => navigate('/reports')}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">📊</span><span>Generate Report</span>
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">⚙️</span><span>System Settings</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
              <span className="mr-2 text-2xl">📈</span> Analytics Snapshot
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <h4 className="font-bold mb-3 text-gray-700">Access Frequency (24h)</h4>
                <div className="h-32 bg-white/50 rounded-lg flex items-end justify-center gap-2 p-2 shadow-inner">
                  <div className="w-10 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '60%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '80%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '40%' }}></div>
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <h4 className="font-bold mb-3 text-gray-700">Attendance Rate</h4>
                <div className="h-32 bg-white/50 rounded-lg flex items-end justify-center gap-2 p-2 shadow-inner">
                  <div className="w-10 bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '90%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '85%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '95%' }}></div>
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-200">
                <h4 className="font-bold mb-3 text-gray-700">Unauthorized Attempts</h4>
                <div className="h-32 bg-white/50 rounded-lg flex items-end justify-center gap-2 p-2 shadow-inner">
                  <div className="w-10 bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '20%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '10%' }}></div>
                  <div className="w-10 bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, gradient }: { title: string; value: number; icon: string; gradient: string }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer border border-white/20`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm opacity-90 font-medium mb-1">{title}</p>
          <p className="text-4xl font-bold">{value}</p>
        </div>
        <div className="text-5xl opacity-90 transform hover:scale-110 transition-transform">{icon}</div>
      </div>
      <div className="mt-3 h-1 bg-white/30 rounded-full overflow-hidden">
        <div className="h-full bg-white/50 rounded-full animate-pulse" style={{ width: '70%' }}></div>
      </div>
    </div>
  );
}
