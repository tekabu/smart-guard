import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, realtimeDb } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ref, onValue, set } from "firebase/database";
import Sidebar from "../components/Sidebar";

interface Door {
  name: string;
  status: "locked" | "unlocked";
  lastAccessBy: string | null;
  lastAccessTime: string | null;
  lastAccessMethod: string | null;
  location: string;
}

interface DoorLog {
  doorId: string;
  doorName: string;
  userName: string;
  method: string;
  timestamp: string;
  action: string;
}

export default function DoorControlEnhanced() {
  const [doors, setDoors] = useState<Record<string, Door>>({});
  const [doorLogs, setDoorLogs] = useState<DoorLog[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Real-time door status listener
  useEffect(() => {
    const doorsRef = ref(realtimeDb, 'doors');
    const unsubscribe = onValue(doorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDoors(data);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time door logs listener
  useEffect(() => {
    const logsRef = ref(realtimeDb, 'doorLogs');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logsArray = Object.entries(data).map(([id, log]: [string, any]) => ({
          id,
          ...log
        })).sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ).slice(0, 10);
        setDoorLogs(logsArray as DoorLog[]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    try {
      signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
      alert("Failed to sign out. Please try again.");
    }
  };

  const handleLockUnlock = async (doorId: string, action: "lock" | "unlock") => {
    try {
      const doorRef = ref(realtimeDb, `doors/${doorId}`);
      const door = doors[doorId];
      
      await set(doorRef, {
        ...door,
        status: action === "lock" ? "locked" : "unlocked",
        lastAccessBy: adminName,
        lastAccessTime: new Date().toLocaleString(),
        lastAccessMethod: "Manual Control"
      });

      // Add to logs
      const logRef = ref(realtimeDb, `doorLogs/${Date.now()}`);
      await set(logRef, {
        doorId,
        doorName: door.name,
        userName: adminName,
        method: "Manual Control",
        timestamp: new Date().toLocaleString(),
        action: action === "lock" ? "locked" : "unlocked"
      });
    } catch (err) {
      console.error("Error updating door status:", err);
      alert(`Failed to ${action} door. Please try again.`);
    }
  };

  const handleEmergencyUnlock = async () => {
    if (!confirm('⚠️ EMERGENCY UNLOCK ALL DOORS?\n\nThis will unlock all doors immediately. Use only in emergency situations.')) return;
    
    try {
      const updates: any = {};
      Object.keys(doors).forEach(doorId => {
        updates[`doors/${doorId}/status`] = "unlocked";
        updates[`doors/${doorId}/lastAccessBy`] = `Emergency - ${adminName}`;
        updates[`doors/${doorId}/lastAccessTime`] = new Date().toLocaleString();
        updates[`doors/${doorId}/lastAccessMethod`] = "Emergency Unlock";
      });
      
      await set(ref(realtimeDb), updates);
      
      // Log emergency unlock
      const logRef = ref(realtimeDb, `doorLogs/${Date.now()}`);
      await set(logRef, {
        doorId: "all",
        doorName: "All Doors",
        userName: adminName,
        method: "Emergency",
        timestamp: new Date().toLocaleString(),
        action: "emergency_unlock"
      });
      
      alert('✅ All doors unlocked successfully!');
    } catch (err) {
      console.error("Error during emergency unlock:", err);
      alert('❌ Failed to unlock doors. Please try again.');
    }
  };

  const handleLockAllDoors = async () => {
    if (!confirm('🔒 Lock all doors?\n\nThis will lock all currently unlocked doors.')) return;
    
    try {
      const updates: any = {};
      Object.keys(doors).forEach(doorId => {
        if (doors[doorId].status === "unlocked") {
          updates[`doors/${doorId}/status`] = "locked";
          updates[`doors/${doorId}/lastAccessBy`] = `Bulk Lock - ${adminName}`;
          updates[`doors/${doorId}/lastAccessTime`] = new Date().toLocaleString();
          updates[`doors/${doorId}/lastAccessMethod`] = "Bulk Control";
        }
      });
      
      if (Object.keys(updates).length === 0) {
        alert('ℹ️ All doors are already locked.');
        return;
      }
      
      await set(ref(realtimeDb), updates);
      
      // Log bulk lock
      const logRef = ref(realtimeDb, `doorLogs/${Date.now()}`);
      await set(logRef, {
        doorId: "all",
        doorName: "All Doors",
        userName: adminName,
        method: "Bulk Control",
        timestamp: new Date().toLocaleString(),
        action: "bulk_lock"
      });
      
      alert('✅ All doors locked successfully!');
    } catch (err) {
      console.error("Error during bulk lock:", err);
      alert('❌ Failed to lock doors. Please try again.');
    }
  };  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A57E8] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading door control system...</p>
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
                {formatTime(currentTime)}
              </p>
              <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
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
        <Sidebar activePage="/door-control" />

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">🚪 Door Control Center</h2>
            <p className="text-gray-600">Monitor and control all access points in real-time</p>
          </div>

          {/* Emergency Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-red-800">🚨 Emergency Controls</h3>
                  <p className="text-sm text-red-600">Critical situation response</p>
                </div>
              </div>
              <button
                onClick={handleEmergencyUnlock}
                className="w-full bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-all font-bold text-lg shadow-lg hover:shadow-xl"
              >
                🔓 Emergency Unlock All
              </button>
              <p className="text-xs text-red-600 mt-2">⚠️ Use only in emergencies</p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-blue-800">🔒 Bulk Controls</h3>
                  <p className="text-sm text-blue-600">Manage multiple doors</p>
                </div>
              </div>
              <button
                onClick={handleLockAllDoors}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg hover:shadow-xl"
              >
                🔒 Lock All Doors
              </button>
              <p className="text-xs text-blue-600 mt-2">Secure all access points</p>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">📊 System Status</h3>
                  <p className="text-sm text-green-600">Current overview</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-800">{Object.keys(doors).length}</p>
                <p className="text-sm text-green-600">Total Doors</p>
                <p className="text-lg font-bold text-green-800 mt-2">
                  {Object.values(doors).filter(d => d.status === "unlocked").length} Unlocked
                </p>
              </div>
            </div>
          </div>

          {/* Door Status Cards */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Door Status Overview</h3>
            {Object.keys(doors).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🚪</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Doors Configured</h3>
                <p className="text-gray-600">Configure doors in the Settings page</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(doors).map(([doorId, door]) => (
                  <div key={doorId} className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{door.name}</h4>
                        <p className="text-sm text-gray-500">{door.location}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full ${
                        door.status === "unlocked" ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          door.status === "unlocked"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {door.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked"}
                        </span>
                      </div>
                      {door.lastAccessBy && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Last Access:</span>
                            <span className="text-sm text-gray-900">{door.lastAccessBy}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Method:</span>
                            <span className="text-sm text-gray-900">{door.lastAccessMethod}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {door.lastAccessTime}
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handleLockUnlock(doorId, door.status === "locked" ? "unlock" : "lock")}
                      className={`w-full py-3 rounded-xl font-semibold text-white transition-all shadow-md hover:shadow-lg ${
                        door.status === "locked" 
                          ? "bg-green-600 hover:bg-green-700" 
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {door.status === "locked" ? "🔓 Unlock Door" : "🔒 Lock Door"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-sm text-gray-500 mt-1">Latest door access events</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-gray-600">Live Updates</span>
              </div>
            </div>
            <div className="space-y-4">
              {doorLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xl">📋</span>
                  </div>
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">Door events will appear here</p>
                </div>
              ) : (
                doorLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                        <span className="text-lg">
                          {log.action === "unlocked" ? "🔓" : log.action === "locked" ? "🔒" : "🚨"}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {log.doorName} {log.action.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          by {log.userName} • {log.method} • {log.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
