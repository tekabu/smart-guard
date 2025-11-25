import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, getRealtimeDb } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ref, onValue, off, set, remove } from "firebase/database";
import { toast } from "react-toastify";
import Sidebar from "../components/Sidebar";
import EnrollmentScanner from "../components/EnrollmentScanner";
import { useEnrollmentListener } from "../hooks/useEnrollmentListener";

interface Student {
  id: string;
  studentId: string;
  name: string;
  course: string;
  yearLevel: string;
  cardId: string;
  fingerprintId: string;
  email: string;
  lastAccess: string;
  attendanceRate: number;
  accessCount: number;
}

interface AccessLog {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  result: string;
  door: string;
  notes: string;
}

export default function Students() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [adminName, setAdminName] = useState("Admin");
  
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    name: "",
    course: "",
    yearLevel: "",
    cardId: "",
    fingerprintId: "",
    email: "",
  });

  // Enrollment listener hook
  const {
    rfidUID,
    fingerprintID,
    isRFIDScanning,
    isFingerprintScanning,
    startRFIDScan,
    startFingerprintEnroll,
    clearEnrollmentData,
    resetEnrollment,
  } = useEnrollmentListener();

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/");
      else setAdminName(user.email?.split("@")[0] || "Admin");
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const db = getRealtimeDb();
    const studentsRef = ref(db, "users/students");

    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const studentsList: Student[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            studentId: value.student_id || "N/A",
            name: value.name || "Unknown",
            course: value.course || "N/A",
            yearLevel: value.year_level || "N/A",
            cardId: key,
            fingerprintId: value.fprints ? Object.keys(value.fprints)[0] : "N/A",
            email: value.email || "N/A",
            lastAccess: value.lastAccess || "Never",
            attendanceRate: value.attendanceRate || 0,
            accessCount: value.accessCount || 0,
          }));
        setStudents(studentsList);
        setFilteredStudents(studentsList);
      } else {
        setStudents([]);
        setFilteredStudents([]);
      }
    });

    return () => off(studentsRef, "value", unsubscribe);
  }, []);

  useEffect(() => {
    const db = getRealtimeDb();
    const logsRef = ref(db, "accessLogs");

    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logsList: AccessLog[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          timestamp: value.timestamp || "",
          user: value.user || "Unknown",
          method: value.method || "N/A",
          result: value.result || "N/A",
          door: value.door || "N/A",
          notes: value.notes || "",
        }));
        setAccessLogs(logsList.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      }
    });

    return () => off(logsRef, "value", unsubscribe);
  }, []);

  useEffect(() => {
    if (rfidUID && showAddModal) {
      setNewStudent(prev => ({ ...prev, cardId: rfidUID }));
      toast.success(`✅ RFID Scanned: ${rfidUID}`);
    }
  }, [rfidUID, showAddModal]);

  useEffect(() => {
    if (fingerprintID && showAddModal) {
      setNewStudent(prev => ({ ...prev, fingerprintId: fingerprintID }));
      toast.success(`✅ Fingerprint Enrolled: ${fingerprintID}`);
    }
  }, [fingerprintID, showAddModal]);

  useEffect(() => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
          s.studentId.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
          s.course.toLowerCase().startsWith(searchTerm.toLowerCase())
      );
    }

    if (filterCourse !== "all") {
      filtered = filtered.filter((s) => s.course === filterCourse);
    }

    if (filterYear !== "all") {
      filtered = filtered.filter((s) => s.yearLevel === filterYear);
    }

    setFilteredStudents(filtered);
  }, [searchTerm, filterCourse, filterYear, students]);

  const handleAddStudent = async () => {
    try {
      if (!newStudent.studentId || !newStudent.name || !newStudent.course || 
          !newStudent.yearLevel || !newStudent.cardId || !newStudent.fingerprintId || !newStudent.email) {
        toast.error("❌ Please fill in all required fields");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newStudent.email)) {
        toast.error("❌ Please enter a valid email address");
        return;
      }

      const studentIdRegex = /^\d{9}$/;
      if (!studentIdRegex.test(newStudent.studentId)) {
        toast.error("❌ Invalid Student ID format. Must be 9 digits (e.g., 202210583)");
        return;
      }

      // Check for duplicate RFID in Students
      const existingRFID = students.find(s => s.cardId === newStudent.cardId);
      if (existingRFID) {
        toast.error(`❌ RFID ${newStudent.cardId} is already registered to Student: ${existingRFID.name}`);
        return;
      }

      // Check for duplicate Fingerprint in Students
      const existingFingerprint = students.find(s => s.fingerprintId === newStudent.fingerprintId);
      if (existingFingerprint) {
        toast.error(`❌ Fingerprint ID ${newStudent.fingerprintId} is already registered to Student: ${existingFingerprint.name}`);
        return;
      }

      // Check for duplicate RFID in Faculty database
      const db = getRealtimeDb();
      const facultyRef = ref(db, "users/faculty");
      const facultySnapshot = await new Promise<any>((resolve) => {
        onValue(facultyRef, (snapshot) => {
          resolve(snapshot.val());
        }, { onlyOnce: true });
      });

      if (facultySnapshot) {
        const facultyList = Object.entries(facultySnapshot);
        
        // Check RFID
        const facultyWithRFID = facultyList.find(([key]) => key === newStudent.cardId);
        if (facultyWithRFID) {
          const facultyData = facultyWithRFID[1] as any;
          toast.error(`❌ RFID ${newStudent.cardId} is already registered to Faculty: ${facultyData.name}`);
          return;
        }

        // Check Fingerprint
        const facultyWithFingerprint = facultyList.find(([_, value]: [string, any]) => {
          return value.fprints && Object.keys(value.fprints).includes(newStudent.fingerprintId);
        });
        if (facultyWithFingerprint) {
          const facultyData = facultyWithFingerprint[1] as any;
          toast.error(`❌ Fingerprint ID ${newStudent.fingerprintId} is already registered to Faculty: ${facultyData.name}`);
          return;
        }
      }
      const rfidKey = newStudent.cardId;
      const studentRef = ref(db, `users/students/${rfidKey}`);

      const fprints: Record<string, boolean> = {};
      fprints[newStudent.fingerprintId] = true;

      await set(studentRef, {
        name: newStudent.name,
        student_id: newStudent.studentId,
        course: newStudent.course,
        year_level: newStudent.yearLevel,
        email: newStudent.email,
        registered: true,
        fprints: fprints,
        role: "student",
        createdAt: new Date().toISOString(),
        lastAccess: "Never",
        attendanceRate: 0,
        accessCount: 0,
      });

      toast.success("✅ Student registered successfully!");
      
      await clearEnrollmentData();
      resetEnrollment();

      setShowAddModal(false);
      setNewStudent({
        studentId: "",
        name: "",
        course: "",
        yearLevel: "",
        cardId: "",
        fingerprintId: "",
        email: "",
      });
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error("❌ Failed to register student. Please try again.");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const studentToDelete = students.find(s => s.id === id);
    if (!studentToDelete) return;

    if (confirm(`Are you sure you want to delete ${studentToDelete.name}?\n\nThis will also delete their fingerprint from the sensor.`)) {
      try {
        const db = getRealtimeDb();
        
        // Get fingerprint IDs before deleting
        const studentRef = ref(db, `users/students/${id}`);
        const studentSnapshot = await new Promise<any>((resolve) => {
          onValue(studentRef, (snapshot) => {
            resolve(snapshot.val());
          }, { onlyOnce: true });
        });

        const fingerprintIds: string[] = [];
        if (studentSnapshot && studentSnapshot.fprints) {
          fingerprintIds.push(...Object.keys(studentSnapshot.fprints));
        }

        // Send delete command to hardware for each fingerprint
        if (fingerprintIds.length > 0) {
          for (const fpId of fingerprintIds) {
            const deleteCommandRef = ref(db, `/hardware/commands/delete_fingerprint`);
            await set(deleteCommandRef, {
              fingerprintId: fpId,
              userId: id,
              userName: studentToDelete.name,
              userType: 'student',
              timestamp: Date.now(),
              status: 'pending'
            });
            
            // Log the deletion command
            await set(ref(db, `/smartguard/logs/system/${Date.now()}`), {
              action: 'DELETE_FINGERPRINT_COMMAND',
              fingerprintId: fpId,
              userId: id,
              userName: studentToDelete.name,
              userType: 'student',
              timestamp: new Date().toISOString()
            });
          }
          
          toast.info(`🔄 Deleting ${fingerprintIds.length} fingerprint(s) from sensor...`);
        }

        // Delete from Firebase
        await remove(studentRef);
        
        toast.success(`✅ Student deleted successfully${fingerprintIds.length > 0 ? ' (fingerprints will be removed from sensor)' : ''}`);
      } catch (error) {
        console.error("Error deleting student:", error);
        toast.error("❌ Failed to delete student");
      }
    }
  };

  const handleStartRFIDScan = async () => {
    try {
      await startRFIDScan('student');
      toast.info("📡 Waiting for RFID scan... Please tap your card");
    } catch (error) {
      console.error("Error starting RFID scan:", error);
      toast.error("❌ Failed to start RFID scan");
    }
  };

  const handleStartFingerprintEnroll = async () => {
    try {
      await startFingerprintEnroll('student');
      toast.info("👆 Waiting for fingerprint... Please place your finger on the sensor");
    } catch (error) {
      console.error("Error starting fingerprint enrollment:", error);
      toast.error("❌ Failed to start fingerprint enrollment");
    }
  };

  const handleModalClose = async () => {
    try {
      await clearEnrollmentData();
      resetEnrollment();
      setShowAddModal(false);
      setNewStudent({
        studentId: "",
        name: "",
        course: "",
        yearLevel: "",
        cardId: "",
        fingerprintId: "",
        email: "",
      });
    } catch (error) {
      console.error("Error closing modal:", error);
      setShowAddModal(false);
    }
  };

  const handleViewHistory = (student: Student) => {
    setSelectedStudent(student);
    setShowHistoryModal(true);
  };

  const getStudentLogs = () => {
    if (!selectedStudent) return [];
    return accessLogs.filter((log) => log.user === selectedStudent.name);
  };

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
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

  const stats = {
    total: students.length,
    bscs: students.filter((s) => s.course === "BSCS").length,
    bsit: students.filter((s) => s.course === "BSIT").length,
    bsce: students.filter((s) => s.course === "BSCE").length,
  };
  
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F9FC' }}>
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
              <p className="text-sm font-medium text-gray-900">{formatTime(currentTime)}</p>
              <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
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
                <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium">
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
          <Sidebar activePage="/students" />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="text-4xl">🎓</span>
              Student Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage students, attendance, and access permissions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Students" value={stats.total} icon="👥" color="from-blue-500 to-blue-600" bgColor="bg-blue-50" />
            <StatCard title="BSCS" value={stats.bscs} icon="💻" color="from-purple-500 to-purple-600" bgColor="bg-purple-50" />
            <StatCard title="BSIT" value={stats.bsit} icon="🖥️" color="from-orange-500 to-orange-600" bgColor="bg-orange-50" />
            <StatCard title="BSCE" value={stats.bsce} icon="⚙️" color="from-green-500 to-green-600" bgColor="bg-green-50" />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="🔍 Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none">
                <option value="all">All Courses</option>
                <option value="BSCS">BSCS</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCE">BSCE</option>
                <option value="BSEE">BSEE</option>
              </select>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none">
                <option value="all">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
              <button onClick={() => setShowAddModal(true)} className="px-6 py-2 bg-linear-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                ➕ Add Student
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-linear-to-r from-indigo-500 to-purple-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Student ID</th>
                    <th className="px-6 py-4 text-left font-semibold">Name</th>
                    <th className="px-6 py-4 text-left font-semibold">Course</th>
                    <th className="px-6 py-4 text-left font-semibold">Year</th>
                    <th className="px-6 py-4 text-left font-semibold">Card ID</th>
                    <th className="px-6 py-4 text-left font-semibold">Fingerprint</th>
                    <th className="px-6 py-4 text-left font-semibold">Attendance</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-lg font-semibold">No students found</p>
                        <p className="text-sm">Try adjusting your filters or add a new student</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-indigo-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-mono font-semibold">{s.studentId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{s.name}</p>
                            <p className="text-sm text-gray-500">{s.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">{s.course}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{s.yearLevel}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-mono">{s.cardId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-mono">{s.fingerprintId}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-linear-to-r from-green-400 to-green-600 h-2 rounded-full" 
                                style={{ width: `${s.attendanceRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">{s.attendanceRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleViewHistory(s)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-semibold">
                              📊
                            </button>
                            <button onClick={() => handleDeleteStudent(s.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-linear-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">➕ Add New Student</h2>
              <p className="text-sm opacity-90 mt-1">All fields are required *</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID * <span className="text-xs text-gray-500">(9 digits)</span></label>
                  <input type="text" value={newStudent.studentId} onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="202210583" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input type="text" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="Juan Dela Cruz" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course *</label>
                  <select value={newStudent.course} onChange={(e) => setNewStudent({ ...newStudent, course: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" required>
                    <option value="">Select Course</option>
                    <option value="BSCS">BSCS - Computer Science</option>
                    <option value="BSIT">BSIT - Information Technology</option>
                    <option value="BSCE">BSCE - Computer Engineering</option>
                    <option value="BSEE">BSEE - Electrical Engineering</option>
                    <option value="BSME">BSME - Mechanical Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Year Level *</label>
                  <select value={newStudent.yearLevel} onChange={(e) => setNewStudent({ ...newStudent, yearLevel: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" required>
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <EnrollmentScanner
                type="rfid"
                mode="student"
                value={newStudent.cardId}
                isScanning={isRFIDScanning}
                onStartScan={handleStartRFIDScan}
                onValueChange={(value) => setNewStudent({ ...newStudent, cardId: value })}
                label="RFID Card ID *"
                placeholder="Scan RFID or enter manually (e.g., A1B2C3D4)"
              />

              <EnrollmentScanner
                type="fingerprint"
                mode="student"
                value={newStudent.fingerprintId}
                isScanning={isFingerprintScanning}
                onStartScan={handleStartFingerprintEnroll}
                onValueChange={(value) => setNewStudent({ ...newStudent, fingerprintId: value })}
                label="Fingerprint Template ID * (Back Door Sensor)"
                placeholder="Enroll fingerprint or enter manually (e.g., 25)"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                <input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" placeholder="student@cvsu.edu.ph" required />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={handleModalClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold">
                Cancel
              </button>
              <button onClick={handleAddStudent} className="px-6 py-2 bg-linear-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                ✅ Add Student
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-linear-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">📊 Access History - {selectedStudent.name}</h2>
              <p className="text-sm opacity-90 mt-1">{selectedStudent.course} - {selectedStudent.yearLevel}</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                  <p className="text-sm text-blue-600 font-semibold">Total Access</p>
                  <p className="text-3xl font-bold text-blue-700">{selectedStudent.accessCount}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                  <p className="text-sm text-green-600 font-semibold">Attendance Rate</p>
                  <p className="text-3xl font-bold text-green-700">{selectedStudent.attendanceRate}%</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                  <p className="text-sm text-purple-600 font-semibold">Last Access</p>
                  <p className="text-lg font-bold text-purple-700">{selectedStudent.lastAccess}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Method</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Result</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Door</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getStudentLogs().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No access history found</td>
                      </tr>
                    ) : (
                      getStudentLogs().map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{log.method}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${log.result === "Granted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {log.result}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{log.door}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.notes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end">
              <button onClick={() => setShowHistoryModal(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  bgColor,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-3xl">{icon}</span>
        <span className={`text-3xl font-bold bg-linear-to-r ${color} bg-clip-text text-transparent`}>
          {value}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full bg-linear-to-r ${color} rounded-full animate-pulse`} style={{ width: "70%" }}></div>
      </div>
    </div>
  );
}
