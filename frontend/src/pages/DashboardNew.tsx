import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { getRealtimeDb } from "../firebase";
import Sidebar from "../components/Sidebar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface SummaryStats {
  activeClasses: number;
  doorsUnlocked: number;
  unauthorizedAttempts: number;
  devicesOnline: number;
  emergencyAlerts: number;
}

interface Device {
  id: string;
  name: string;
  location: string;
  status: "locked" | "unlocked";
  online: boolean;
  lastSeen: string;
  signal: string;
}

interface AccessLog {
  id: string;
  timestamp?: number | string;
  user?: string;
  userName?: string;
  userRole?: string;
  role?: string;
  userId?: string;
  method?: string;
  result?: string;
  door?: string;
  notes?: string;
  description?: string;
}

interface AccessChartPoint {
  name: string;
  granted: number;
  denied: number;
}

interface AttendanceChartPoint {
  name: string;
  value: number;
}

const ACCESS_BUCKETS = [
  { label: "00-04", start: 0, end: 4 },
  { label: "04-08", start: 4, end: 8 },
  { label: "08-12", start: 8, end: 12 },
  { label: "12-16", start: 12, end: 16 },
  { label: "16-20", start: 16, end: 20 },
  { label: "20-24", start: 20, end: 24 },
];

const getLastNDays = (days = 7) => {
  const result: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    result.push({ key, label });
  }
  return result;
};

const buildDefaultAttendanceTrend = (): AttendanceChartPoint[] =>
  getLastNDays().map((day) => ({ name: day.label, value: 0 }));

const buildDefaultAccessChart = (): AccessChartPoint[] =>
  ACCESS_BUCKETS.map((bucket) => ({ name: bucket.label, granted: 0, denied: 0 }));

export default function DashboardNew() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<SummaryStats>({
    activeClasses: 0,
    doorsUnlocked: 0,
    unauthorizedAttempts: 0,
    devicesOnline: 0,
    emergencyAlerts: 0,
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceChartPoint[]>(buildDefaultAttendanceTrend());
  const [accessChartData, setAccessChartData] = useState<AccessChartPoint[]>(buildDefaultAccessChart());
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("Admin User");
  const [listenerKey, setListenerKey] = useState(0);

  const navigate = useNavigate();

  const buildAttendanceTrendFromSnapshot = (attendanceRoot: Record<string, any> | null) => {
    const base = getLastNDays();
    const counts: Record<string, number> = base.reduce((acc, day) => ({
      ...acc,
      [day.key]: 0,
    }), {} as Record<string, number>);

    if (attendanceRoot) {
      Object.values(attendanceRoot).forEach((sessionRecords: any) => {
        if (!sessionRecords) return;
        Object.values(sessionRecords as Record<string, any>).forEach((record) => {
          if (!record) return;
          const rawTimestamp = record.timestamp ?? record.timeIn;
          if (!rawTimestamp) return;
          const date = new Date(rawTimestamp);
          if (isNaN(date.getTime())) return;
          const key = date.toISOString().split("T")[0];
          if (counts[key] !== undefined) {
            counts[key] += 1;
          }
        });
      });
    }

    return base.map((day) => ({
      name: day.label,
      value: counts[day.key] || 0,
    }));
  };

  const buildAccessChartFromLogs = (logs: AccessLog[]) => {
    const buckets = ACCESS_BUCKETS.map((bucket) => ({ ...bucket, granted: 0, denied: 0 }));

    logs.forEach((log) => {
      if (!log.timestamp) return;
      const date = new Date(log.timestamp);
      if (isNaN(date.getTime())) return;
      const hour = date.getHours();
      const bucket = buckets.find((b) => hour >= b.start && hour < b.end);
      if (!bucket) return;
      if ((log.result || "").toLowerCase() === "denied") bucket.denied += 1;
      else bucket.granted += 1;
    });

    return buckets.map((bucket) => ({
      name: bucket.label,
      granted: bucket.granted,
      denied: bucket.denied,
    }));
  };

  const formatTimestamp = (value?: number | string) => {
    if (!value) return "--";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Auth check
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

  // Real-time Firebase listeners
  useEffect(() => {
    setLoadingDashboard(true);
    const db = getRealtimeDb();
    const devicesRef = ref(db, "devices");
    const logsRef = ref(db, "accessLogs");
    const sessionsRef = ref(db, "sessions");
    const alertsRef = ref(db, "emergencyAlerts");
    const attendanceRef = ref(db, "attendance");

    const unsubscribeDevices = onValue(
      devicesRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setDevices([]);
            setStats((prev) => ({ ...prev, doorsUnlocked: 0, devicesOnline: 0 }));
            setLoadingDashboard(false);
            return;
          }

          const devicesList: Device[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setDevices(devicesList);

          const unlocked = devicesList.filter((d) => d.status === "unlocked").length;
          const online = devicesList.filter((d) => d.online).length;
          setStats((prev) => ({
            ...prev,
            doorsUnlocked: unlocked,
            devicesOnline: online,
          }));
          setLoadingDashboard(false);
        } catch (err) {
          console.error("Error processing devices data:", err);
          setError("Failed to process devices information.");
        }
      },
      (err) => {
        console.error("Devices listener error:", err);
        setError("Unable to load device status.");
      }
    );

    const unsubscribeLogs = onValue(
      logsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setAccessLogs([]);
            setStats((prev) => ({ ...prev, unauthorizedAttempts: 0 }));
            setAccessChartData(buildDefaultAccessChart());
            setLoadingDashboard(false);
            return;
          }

          const logsList: AccessLog[] = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeB - timeA;
            })
            .slice(0, 10);
          setAccessLogs(logsList);
          setAccessChartData(buildAccessChartFromLogs(logsList));

          const today = new Date().toDateString();
          const unauthorized = Object.values(data).filter((log: any) => {
            if (!log?.timestamp) return false;
            return (
              (log.result || "").toLowerCase() === "denied" &&
              new Date(log.timestamp).toDateString() === today
            );
          }).length;
          setStats((prev) => ({ ...prev, unauthorizedAttempts: unauthorized }));
          setLoadingDashboard(false);
        } catch (err) {
          console.error("Error processing access logs:", err);
          setError("Failed to process access logs.");
        }
      },
      (err) => {
        console.error("Access logs listener error:", err);
        setError("Unable to load access logs.");
      }
    );

    const unsubscribeSessions = onValue(
      sessionsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setStats((prev) => ({ ...prev, activeClasses: 0 }));
            setLoadingDashboard(false);
            return;
          }

          const activeSessions = Object.values(data).filter(
            (session: any) => session?.status === "Active"
          ).length;
          setStats((prev) => ({ ...prev, activeClasses: activeSessions }));
          setLoadingDashboard(false);
        } catch (err) {
          console.error("Error processing sessions data:", err);
          setError("Failed to process sessions information.");
        }
      },
      (err) => {
        console.error("Sessions listener error:", err);
        setError("Unable to load session data.");
      }
    );

    const unsubscribeAlerts = onValue(
      alertsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setStats((prev) => ({ ...prev, emergencyAlerts: 0 }));
            return;
          }

          const unacknowledged = Object.values(data).filter(
            (alert: any) => !alert?.acknowledged
          ).length;
          setStats((prev) => ({ ...prev, emergencyAlerts: unacknowledged }));
        } catch (err) {
          console.error("Error processing emergency alerts:", err);
          setError("Failed to process emergency alerts.");
        }
      },
      (err) => {
        console.error("Emergency alerts listener error:", err);
        setError("Unable to load emergency alerts.");
      }
    );

    const unsubscribeAttendance = onValue(
      attendanceRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          setAttendanceTrend(buildAttendanceTrendFromSnapshot(data));
        } catch (err) {
          console.error("Error processing attendance data:", err);
        }
      },
      (err) => {
        console.error("Attendance listener error:", err);
      }
    );

    return () => {
      unsubscribeDevices();
      unsubscribeLogs();
      unsubscribeSessions();
      unsubscribeAlerts();
      unsubscribeAttendance();
    };
  }, [listenerKey]);

  const handleLogout = () => {
    try {
      signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
      alert("Failed to sign out. Please try again.");
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoadingDashboard(true);
    setListenerKey((key) => key + 1);
  };

  const formatTime = (date: Date) => {
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

  const deviceData = [
    { name: 'Online', value: stats.devicesOnline, color: '#10B981' },
    { name: 'Offline', value: Math.max(devices.length - stats.devicesOnline, 0), color: '#EF4444' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f0f4f7' }}>
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200/50 backdrop-blur-sm">
        <div className="px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* University Logo Placeholder */}
            <div className="w-12 h-12 bg-linear-to-br from-[#1a4b87] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
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
                <div className="w-8 h-8 bg-linear-to-br from-[#1a4b87] to-[#A78BFA] rounded-lg flex items-center justify-center">
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
        {/* Sidebar */}
        <div className="sticky top-0 h-screen overflow-y-auto">
          <Sidebar activePage="/dashboard" />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {error && (
            <ErrorMessage message={error} onRetry={handleRetry} />
          )}

          {loadingDashboard ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-12 mt-8">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                <SummaryCard
                  title="Active Classes"
                  value={stats.activeClasses}
                  accentColor="#1a4b87"
                  bgColor="#EEF2FF"
                />
                <SummaryCard
                  title="Doors Unlocked"
                  value={stats.doorsUnlocked}
                  accentColor="#10B981"
                  bgColor="#ECFDF5"
                />
                <SummaryCard
                  title="Unauthorized Attempts"
                  value={stats.unauthorizedAttempts}
                  accentColor="#EF4444"
                  bgColor="#FEF2F2"
                />
                <SummaryCard
                  title="Devices Online"
                  value={stats.devicesOnline}
                  accentColor="#A78BFA"
                  bgColor="#F3E8FF"
                />
                <SummaryCard
                  title="Emergency Alerts"
                  value={stats.emergencyAlerts}
                  accentColor="#F59E0B"
                  bgColor="#FFFBEB"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Activity Feed */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Live Activity Feed</h2>
                      <p className="text-sm text-gray-500 mt-1">Real-time access monitoring</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-gray-600">Live</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Method
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Result
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Door
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                    {accessLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                          </div>
                          <p className="text-sm font-medium">No activity yet</p>
                          <p className="text-xs text-gray-400 mt-1">Waiting for access events...</p>
                        </td>
                      </tr>
                    ) : (
                      accessLogs.map((log) => {
                        const resultText = log.result || "Unknown";
                        const isGranted = resultText.toLowerCase() === "granted";
                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-gray-50/50 transition-colors duration-150"
                          >
                            <td className="py-4 px-4 text-sm text-gray-600">
                              {formatTimestamp(log.timestamp)}
                            </td>
                            <td className="py-4 px-4 text-sm font-medium text-gray-900">
                              {log.user || log.userName || log.userId || "Unknown"}
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600 capitalize">
                              {log.role || log.userRole || "N/A"}
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1a4b87]/10 text-[#1a4b87]">
                                {log.method || "N/A"}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  isGranted
                                    ? "bg-[#10B981]/10 text-[#10B981]"
                                    : "bg-[#EF4444]/10 text-[#EF4444]"
                                }`}
                              >
                                {resultText}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600">
                              {log.door || "Unknown"}
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-500">
                              {log.notes || log.description || "--"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Device Status Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Device Status</h2>
                  <p className="text-sm text-gray-500 mt-1">IoT door controllers</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">
                    {stats.devicesOnline}/{devices.length} Online
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {devices.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📡</span>
                    </div>
                    <p className="text-sm font-medium">No devices connected</p>
                    <p className="text-xs text-gray-400 mt-1">Devices will appear here</p>
                  </div>
                ) : (
                  devices.map((device) => (
                    <div
                      key={device.id}
                      className="p-4 bg-gray-50/50 rounded-xl border border-gray-100"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {device.name}
                          </h3>
                          <p className="text-xs text-gray-500">{device.location}</p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          device.online ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                        } shadow-sm`}></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            device.status === "locked"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-[#10B981]/10 text-[#10B981]"
                          }`}
                        >
                          {device.status === "locked" ? "🔒 Locked" : "🔓 Unlocked"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {device.online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-gray-400">
                        Last seen: {device.lastSeen}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            {/* Attendance Trend Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Attendance Trend</h3>
                <p className="text-sm text-gray-500 mt-1">Weekly overview</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a4b87" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#1a4b87" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1a4b87"
                    strokeWidth={2}
                    fill="url(#attendanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Access Attempts Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Access Attempts</h3>
                <p className="text-sm text-gray-500 mt-1">Granted vs Denied</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={accessChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar
                    dataKey="granted"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    name="Granted"
                  />
                  <Bar
                    dataKey="denied"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    name="Denied"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Device Status Pie Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Device Connectivity</h3>
                <p className="text-sm text-gray-500 mt-1">Online vs Offline</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#10B981] rounded-full"></div>
                  <span className="text-xs text-gray-600">Online ({stats.devicesOnline})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#EF4444] rounded-full"></div>
                  <span className="text-xs text-gray-600">Offline ({Math.max(devices.length - stats.devicesOnline, 0)})</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  accentColor,
  bgColor,
}: {
  title: string;
  value: number;
  accentColor: string;
  bgColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 border border-gray-200/50"
      style={{ backgroundColor: bgColor }}
    >
      <div className="text-right mb-4">
        <div
          className="text-3xl font-bold"
          style={{ color: accentColor }}
        >
          {value}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="w-full bg-gray-200/50 rounded-full h-1.5 overflow-hidden mt-3">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min((value / 100) * 100, 85)}%`,
            backgroundColor: accentColor
          }}
        ></div>
      </div>
    </div>
  );
}
