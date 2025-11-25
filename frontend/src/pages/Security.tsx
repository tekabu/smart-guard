import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { api, ApiError } from "../utils/api";

interface UnauthorizedAttempt {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  door: string;
  result: string;
  description: string;
}

export default function Security() {
  const [attempts, setAttempts] = useState<UnauthorizedAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
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

  const fetchData = async () => {
    try {
      setError(null);
      const data = await api.getUnauthorizedAttempts();
      setAttempts(data);
      
      // Count recent attempts (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentAttempts = data.filter((attempt: UnauthorizedAttempt) => {
        const attemptTime = new Date(attempt.timestamp);
        return attemptTime > fiveMinutesAgo;
      });
      setAlertCount(recentAttempts.length);
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to load security data';
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

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  const handleEmergencyUnlock = async () => {
    if (!confirm('⚠️ EMERGENCY UNLOCK - Are you sure you want to unlock ALL doors?')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.emergencyUnlock();
      alert('✅ Emergency unlock activated for all doors!');
      await fetchData();
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

  const handleBlockUser = (userId: string) => {
    if (confirm(`Block user ${userId} from accessing the system?`)) {
      alert(`🚫 User ${userId} has been blocked (feature coming soon)`);
    }
  };

  const handleInvestigate = (attemptId: string) => {
    alert(`🔍 Opening investigation details for attempt ${attemptId} (feature coming soon)`);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A57E8] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading security system...</p>
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
        <Sidebar activePage="/security" />

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">🚨 Security & Emergency Control</h2>
            <p className="text-gray-600">Monitor unauthorized attempts and manage security incidents</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={fetchData} />}

          {/* Alert Banner */}
          {alertCount >= 3 && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg animate-pulse">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🚨</span>
                <div>
                  <p className="font-bold">Security Alert!</p>
                  <p className="text-sm">{alertCount} unauthorized attempts detected in the last 5 minutes</p>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
              <h3 className="text-xl font-bold mb-4 text-red-600">🚨 Emergency Controls</h3>
              <button
                onClick={handleEmergencyUnlock}
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Processing...' : '🔓 Emergency Unlock All Doors'}
              </button>
              <p className="text-xs text-gray-500 mt-2">Use only in emergency situations</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
              <h3 className="text-xl font-bold mb-2 text-orange-600">⚠️ Recent Alerts</h3>
              <p className="text-4xl font-bold text-orange-600">{alertCount}</p>
              <p className="text-sm text-gray-600">Unauthorized attempts (last 5 min)</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-bold mb-2 text-blue-600">📊 Total Incidents</h3>
              <p className="text-4xl font-bold text-blue-600">{attempts.length}</p>
              <p className="text-sm text-gray-600">All unauthorized attempts</p>
            </div>
          </div>

          {/* Unauthorized Attempts Table */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <span className="mr-2">🔒</span> Unauthorized Access Attempts
            </h3>
            
            {attempts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4">Timestamp</th>
                      <th className="text-left py-3 px-4">User/UID</th>
                      <th className="text-left py-3 px-4">Method</th>
                      <th className="text-left py-3 px-4">Door</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Description</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-sm">{attempt.timestamp}</td>
                        <td className="py-3 px-4 font-semibold">{attempt.user}</td>
                        <td className="py-3 px-4">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {attempt.method}
                          </span>
                        </td>
                        <td className="py-3 px-4">{attempt.door}</td>
                        <td className="py-3 px-4">
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                            ❌ {attempt.result}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{attempt.description}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleInvestigate(attempt.id)}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-xs mr-2 hover:bg-blue-600"
                          >
                            Investigate
                          </button>
                          <button
                            onClick={() => handleBlockUser(attempt.user)}
                            className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                          >
                            Block
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-xl font-semibold text-gray-700">No Unauthorized Attempts</p>
                <p className="text-gray-500">System is secure</p>
              </div>
            )}
          </div>

          {/* Security Tips */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-800 mb-2">💡 Security Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Monitor unauthorized attempts regularly</li>
              <li>• Investigate repeated failed attempts from the same user</li>
              <li>• Use emergency unlock only in critical situations</li>
              <li>• Review security logs daily for suspicious activity</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
