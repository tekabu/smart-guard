import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.ts";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ErrorMessage from "../components/ErrorMessage";
import { api, ApiError } from "../utils/api";

interface ReportData {
  title: string;
  dateRange: string;
  data: any[];
  summary: {
    total: number;
    granted: number;
    denied: number;
  };
}

export default function Reports() {
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState("daily_access");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [faculty, setFaculty] = useState("");
  const [student, setStudent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogout = () => signOut(auth);

  const getReportTitle = (type: string) => {
    const titles: Record<string, string> = {
      daily_access: "Daily Access Report",
      attendance_summary: "Attendance Summary",
      faculty_clearance: "Faculty Clearance Log",
      unauthorized_audit: "Unauthorized Attempts Audit",
    };
    return titles[type] || "Report";
  };

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      alert('⚠️ Please select date range');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const reportPayload = {
        type: reportType,
        dateFrom,
        dateTo,
        faculty,
        student,
      };

      await api.generateReport(reportType, reportPayload);
      
      // Generate sample report data for preview
      const sampleData = generateSampleReportData(reportType);
      setReportData({
        title: getReportTitle(reportType),
        dateRange: `${dateFrom} to ${dateTo}`,
        data: sampleData,
        summary: {
          total: sampleData.length,
          granted: sampleData.filter((d: any) => d.status === 'Granted').length,
          denied: sampleData.filter((d: any) => d.status === 'Denied').length,
        }
      });
      
      setShowPreview(true);
      alert('✅ Report generated successfully!');
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Failed to generate report';
      setError(errorMessage);
      alert(`❌ ${errorMessage}`);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const generateSampleReportData = (type: string) => {
    const data = [];
    for (let i = 1; i <= 10; i++) {
      data.push({
        id: i,
        timestamp: `2025-01-${String(10 + i).padStart(2, '0')} ${8 + i}:${String(i * 3).padStart(2, '0')} AM`,
        user: type.includes('faculty') ? `Prof. Faculty ${i}` : `Student ${1000 + i}`,
        method: i % 2 === 0 ? 'RFID' : 'Fingerprint',
        door: i % 3 === 0 ? 'Front Door' : i % 3 === 1 ? 'Back Door' : 'Faculty Exit',
        status: i % 5 === 0 ? 'Denied' : 'Granted',
        description: i % 5 === 0 ? 'Unauthorized' : 'Access Granted'
      });
    }
    return data;
  };

  const handleExportPDF = () => {
    if (!reportData) {
      alert('⚠️ Please generate a report first');
      return;
    }
    
    alert(`📄 Exporting "${reportData.title}" to PDF...\n\nReport Details:\n- Date Range: ${reportData.dateRange}\n- Total Records: ${reportData.summary.total}\n- Format: PDF\n\nDownload will start shortly...`);
  };

  const handleExportCSV = () => {
    if (!reportData) {
      alert('⚠️ Please generate a report first');
      return;
    }
    
    // Generate CSV content
    let csv = 'ID,Timestamp,User,Method,Door,Status,Description\n';
    reportData.data.forEach((record: any) => {
      csv += `${record.id},${record.timestamp},${record.user},${record.method},${record.door},${record.status},${record.description}\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('✅ CSV file downloaded successfully!');
  };

  const handleExportExcel = () => {
    if (!reportData) {
      alert('⚠️ Please generate a report first');
      return;
    }
    
    alert(`📗 Exporting "${reportData.title}" to Excel...\n\nReport Details:\n- Date Range: ${reportData.dateRange}\n- Total Records: ${reportData.summary.total}\n- Format: XLSX\n\nDownload will start shortly...`);
  };

  const handlePrintReport = () => {
    if (!reportData) {
      alert('⚠️ Please generate a report first');
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F9FC' }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200/50 backdrop-blur-sm">
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
                <div className="w-8 h-8 bg-linear-to-br from-[#1a4b87] to-[#A78BFA] rounded-lg flex items-center justify-center">
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
          <Sidebar activePage="/reports" />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Reports & Analytics</h2>
            <p className="text-gray-600">Generate comprehensive reports and analyze system data</p>
          </div>

          {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Report Generator */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">📊</span> Report Generator
              </h3>

              <div className="space-y-4">
                {/* Report Type */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily_access">Daily Access Report</option>
                    <option value="attendance_summary">Attendance Summary</option>
                    <option value="faculty_clearance">Faculty Clearance Log</option>
                    <option value="unauthorized_audit">Unauthorized Attempts Audit</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Faculty (Optional)</label>
                    <input
                      type="text"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      placeholder="Enter faculty name"
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Student (Optional)</label>
                    <input
                      type="text"
                      value={student}
                      onChange={(e) => setStudent(e.target.value)}
                      placeholder="Enter student ID"
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="w-full bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? '⏳ Generating Report...' : '📊 Generate Report'}
                </button>

                {/* Export Options */}
                {reportData && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-3">Export Options:</p>
                    <div className="grid grid-cols-4 gap-3">
                      <button
                        onClick={handleExportPDF}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>📄</span> PDF
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>📊</span> CSV
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>📗</span> Excel
                      </button>
                      <button
                        onClick={handlePrintReport}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>🖨️</span> Print
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">📈 Quick Stats</h3>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Access Logs</p>
                    <p className="text-3xl font-bold text-blue-600">1,234</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Attendance Rate</p>
                    <p className="text-3xl font-bold text-green-600">94%</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Unauthorized</p>
                    <p className="text-3xl font-bold text-red-600">12</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4">📅 Recent Reports</h3>
                <div className="space-y-3">
                  <div className="border-l-4 border-blue-500 pl-3 py-2">
                    <p className="font-semibold text-sm">Daily Access Report</p>
                    <p className="text-xs text-gray-500">Generated: 2025-01-15</p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-3 py-2">
                    <p className="font-semibold text-sm">Attendance Summary</p>
                    <p className="text-xs text-gray-500">Generated: 2025-01-14</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-3 py-2">
                    <p className="font-semibold text-sm">Security Report</p>
                    <p className="text-xs text-gray-500">Generated: 2025-01-13</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Report Preview */}
          {showPreview && reportData && (
            <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">📄 Report Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Close
                </button>
              </div>
              
              <div className="border-b pb-4 mb-4">
                <h4 className="text-2xl font-bold text-gray-800">{reportData.title}</h4>
                <p className="text-gray-600">Date Range: {reportData.dateRange}</p>
                <div className="mt-2 flex gap-4">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded">Total: {reportData.summary.total}</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded">Granted: {reportData.summary.granted}</span>
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded">Denied: {reportData.summary.denied}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-4">#</th>
                      <th className="text-left py-2 px-4">Timestamp</th>
                      <th className="text-left py-2 px-4">User</th>
                      <th className="text-left py-2 px-4">Method</th>
                      <th className="text-left py-2 px-4">Door</th>
                      <th className="text-left py-2 px-4">Status</th>
                      <th className="text-left py-2 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data.map((record: any) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">{record.id}</td>
                        <td className="py-2 px-4 text-sm">{record.timestamp}</td>
                        <td className="py-2 px-4">{record.user}</td>
                        <td className="py-2 px-4">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">{record.method}</span>
                        </td>
                        <td className="py-2 px-4">{record.door}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${record.status === 'Granted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {record.status === 'Granted' ? '✅' : '❌'} {record.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-sm">{record.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytics Charts */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-6">📊 Analytics Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Attendance Chart */}
              <div className="text-center">
                <h4 className="font-bold mb-3 text-gray-700">Attendance Trend (7 Days)</h4>
                <div className="h-48 bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg flex items-end justify-center gap-2 p-4 shadow-inner">
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '60%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '80%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '70%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '90%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '85%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '95%' }}></div>
                  <div className="w-12 bg-linear-to-t from-blue-500 to-blue-400 rounded-t-lg shadow-lg" style={{ height: '88%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Mon - Sun</p>
              </div>

              {/* Access Frequency */}
              <div className="text-center">
                <h4 className="font-bold mb-3 text-gray-700">Access Frequency (24h)</h4>
                <div className="h-48 bg-linear-to-br from-green-50 to-emerald-50 rounded-lg flex items-end justify-center gap-2 p-4 shadow-inner">
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '40%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '60%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '80%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '90%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '70%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '50%' }}></div>
                  <div className="w-8 bg-linear-to-t from-green-500 to-green-400 rounded-t-lg shadow-lg" style={{ height: '30%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Hourly Distribution</p>
              </div>

              {/* Unauthorized Attempts */}
              <div className="text-center">
                <h4 className="font-bold mb-3 text-gray-700">Security Incidents</h4>
                <div className="h-48 bg-linear-to-br from-red-50 to-rose-50 rounded-lg flex items-end justify-center gap-2 p-4 shadow-inner">
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '20%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '15%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '30%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '10%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '25%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '18%' }}></div>
                  <div className="w-12 bg-linear-to-t from-red-500 to-red-400 rounded-t-lg shadow-lg" style={{ height: '12%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Weekly Trend</p>
              </div>
            </div>
          </div>

          {/* Clearance Validation & Audit Overview */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center">
              <span className="mr-2">🔍</span> Faculty Clearance Validation
            </h3>
            <p className="text-gray-600 mb-6">Enables administrators to validate and approve faculty logs</p>

            {/* Faculty Search */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Faculty Name/ID</label>
              <input
                type="text"
                placeholder="Search or select the faculty member requiring clearance"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Clearance Log Summary Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Faculty ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total Scheduled Sessions</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total Logged Entries</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Exit Reasons Audit</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">FAC001</td>
                    <td className="px-4 py-3 text-sm font-medium">Dr. Maria Santos</td>
                    <td className="px-4 py-3 text-sm">24</td>
                    <td className="px-4 py-3 text-sm">22</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Complete</span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
                        View Detailed Log
                      </button>
                      <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs">
                        Approve Clearance
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">FAC002</td>
                    <td className="px-4 py-3 text-sm font-medium">Prof. Juan Dela Cruz</td>
                    <td className="px-4 py-3 text-sm">18</td>
                    <td className="px-4 py-3 text-sm">16</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Partial</span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
                        View Detailed Log
                      </button>
                      <button className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs" disabled>
                        Pending Review
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">FAC003</td>
                    <td className="px-4 py-3 text-sm font-medium">Ms. Ana Reyes</td>
                    <td className="px-4 py-3 text-sm">20</td>
                    <td className="px-4 py-3 text-sm">20</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Complete</span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
                        View Detailed Log
                      </button>
                      <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs">
                        Approve Clearance
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>ℹ️ Note:</strong> Once logs are validated, the administrator confirms approval, marking the faculty member as cleared in the system. This is a critical section for administrative accountability.
              </p>
            </div>
          </div>

          {/* Report Templates */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-800 mb-2">📋 Available Report Templates</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Daily Access Report:</strong> Complete log of all door access activities</li>
              <li>• <strong>Attendance Summary:</strong> Student attendance per class/session</li>
              <li>• <strong>Faculty Clearance Log:</strong> Faculty presence and session records</li>
              <li>• <strong>Unauthorized Attempts Audit:</strong> Security incidents and failed access</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
