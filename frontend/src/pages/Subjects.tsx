import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, getRealtimeDb } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ref, onValue, off, set, remove, push } from "firebase/database";
import Sidebar from "../components/Sidebar";

interface Subject {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  facultyName: string;
  room: string;
  schedule: {
    days: string[];
    startTime: string;
    endTime: string;
  };
  enrolledStudents: string[];
  semester: string;
  schoolYear: string;
  active: boolean;
}

interface Faculty {
  id: string;
  name: string;
  department: string;
}

interface Student {
  id: string;
  studentId: string;
  name: string;
  course: string;
  yearLevel: string;
}

export default function Subjects() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFaculty, setFilterFaculty] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [adminName, setAdminName] = useState("Admin");
  
  const [newSubject, setNewSubject] = useState({
    code: "",
    name: "",
    facultyId: "",
    room: "",
    days: [] as string[],
    startTime: "",
    endTime: "",
    semester: "1st Semester",
    schoolYear: "2024-2025",
  });

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const navigate = useNavigate();
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  // Load Subjects
  useEffect(() => {
    const db = getRealtimeDb();
    const subjectsRef = ref(db, "subjects");

    const unsubscribe = onValue(subjectsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const subjectsList: Subject[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          code: value.code || "N/A",
          name: value.name || "Unknown",
          facultyId: value.facultyId || "",
          facultyName: value.facultyName || "Unassigned",
          room: value.room || "N/A",
          schedule: value.schedule || { days: [], startTime: "", endTime: "" },
          enrolledStudents: value.enrolledStudents || [],
          semester: value.semester || "1st Semester",
          schoolYear: value.schoolYear || "2024-2025",
          active: value.active !== false,
        }));
        setSubjects(subjectsList);
        setFilteredSubjects(subjectsList);
      } else {
        setSubjects([]);
        setFilteredSubjects([]);
      }
    });

    return () => off(subjectsRef, "value", unsubscribe);
  }, []);

  // Load Faculty
  useEffect(() => {
    const db = getRealtimeDb();
    const facultyRef = ref(db, "users/faculty");

    const unsubscribe = onValue(facultyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const facultyList: Faculty[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            name: value.name || "Unknown",
            department: value.department || "N/A",
          }));
        setFaculty(facultyList);
      } else {
        setFaculty([]);
      }
    });

    return () => off(facultyRef, "value", unsubscribe);
  }, []);

  // Load Students
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
          }));
        setStudents(studentsList);
      } else {
        setStudents([]);
      }
    });

    return () => off(studentsRef, "value", unsubscribe);
  }, []);

  useEffect(() => {
    let filtered = subjects;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterFaculty !== "all") {
      filtered = filtered.filter((s) => s.facultyId === filterFaculty);
    }

    setFilteredSubjects(filtered);
  }, [searchTerm, filterFaculty, subjects]);

  const handleDayToggle = (day: string) => {
    setNewSubject(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleAddSubject = async () => {
    if (!newSubject.code || !newSubject.name || !newSubject.facultyId || 
        !newSubject.room || newSubject.days.length === 0 || 
        !newSubject.startTime || !newSubject.endTime) {
      alert("Please fill in all required fields and select at least one day");
      return;
    }

    const selectedFaculty = faculty.find(f => f.id === newSubject.facultyId);
    if (!selectedFaculty) {
      alert("Please select a valid faculty");
      return;
    }

    const db = getRealtimeDb();
    const subjectsRef = ref(db, "subjects");
    const newSubjectRef = push(subjectsRef);

    await set(newSubjectRef, {
      code: newSubject.code.toUpperCase(),
      name: newSubject.name,
      facultyId: newSubject.facultyId,
      facultyName: selectedFaculty.name,
      room: newSubject.room,
      schedule: {
        days: newSubject.days,
        startTime: newSubject.startTime,
        endTime: newSubject.endTime,
      },
      enrolledStudents: [],
      semester: newSubject.semester,
      schoolYear: newSubject.schoolYear,
      active: true,
      createdAt: new Date().toISOString(),
    });

    setShowAddModal(false);
    setNewSubject({
      code: "",
      name: "",
      facultyId: "",
      room: "",
      days: [],
      startTime: "",
      endTime: "",
      semester: "1st Semester",
      schoolYear: "2024-2025",
    });
  };

  const handleDeleteSubject = async (id: string) => {
    if (confirm("Are you sure you want to delete this subject? All student enrollments will be removed.")) {
      const db = getRealtimeDb();
      const subjectRef = ref(db, `subjects/${id}`);
      await remove(subjectRef);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const db = getRealtimeDb();
    const subjectRef = ref(db, `subjects/${id}/active`);
    await set(subjectRef, !currentStatus);
  };

  const handleOpenEnrollModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedStudents(subject.enrolledStudents || []);
    setShowEnrollModal(true);
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSaveEnrollment = async () => {
    if (!selectedSubject) return;

    const db = getRealtimeDb();
    const enrollmentRef = ref(db, `subjects/${selectedSubject.id}/enrolledStudents`);
    await set(enrollmentRef, selectedStudents);

    alert(`✅ Successfully enrolled ${selectedStudents.length} students in ${selectedSubject.name}`);
    
    setShowEnrollModal(false);
    setSelectedSubject(null);
    setSelectedStudents([]);
    setStudentSearch("");
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
    total: subjects.length,
    active: subjects.filter(s => s.active).length,
    totalEnrollments: subjects.reduce((sum, s) => sum + s.enrolledStudents.length, 0),
    avgEnrollment: subjects.length > 0 
      ? Math.round(subjects.reduce((sum, s) => sum + s.enrolledStudents.length, 0) / subjects.length)
      : 0,
  };

  const filteredStudentsForEnroll = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.course.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              🛡️ SmartGuard Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Cavite State University - Imus Campus
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">{formatTime(currentTime)}</p>
              <p className="text-xs text-gray-500">{formatDate(currentTime)}</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all">
                <span className="text-sm font-medium">👤 {adminName}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <Sidebar activePage="/subjects" />

        <main className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="text-4xl">📚</span>
              Class Schedule Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Create subjects, assign faculty, and enroll students
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Subjects" value={stats.total} icon="📖" color="from-blue-500 to-blue-600" bgColor="bg-blue-50" />
            <StatCard title="Active" value={stats.active} icon="✅" color="from-green-500 to-green-600" bgColor="bg-green-50" />
            <StatCard title="Total Enrollments" value={stats.totalEnrollments} icon="🎓" color="from-purple-500 to-purple-600" bgColor="bg-purple-50" />
            <StatCard title="Avg per Subject" value={stats.avgEnrollment} icon="📊" color="from-orange-500 to-orange-600" bgColor="bg-orange-50" />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="🔍 Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none">
                <option value="all">All Faculty</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button onClick={() => setShowAddModal(true)} className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                ➕ Add Subject
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Code</th>
                    <th className="px-6 py-4 text-left font-semibold">Subject Name</th>
                    <th className="px-6 py-4 text-left font-semibold">Faculty</th>
                    <th className="px-6 py-4 text-left font-semibold">Room</th>
                    <th className="px-6 py-4 text-left font-semibold">Schedule</th>
                    <th className="px-6 py-4 text-left font-semibold">Enrolled</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-lg font-semibold">No subjects found</p>
                        <p className="text-sm">Create a new subject to get started</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((subject) => (
                      <tr key={subject.id} className="hover:bg-indigo-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-mono font-semibold">{subject.code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{subject.name}</p>
                            <p className="text-xs text-gray-500">{subject.semester} • {subject.schoolYear}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">{subject.facultyName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">{subject.room}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-semibold text-gray-700">{subject.schedule.days.join(", ")}</p>
                            <p className="text-gray-500">{subject.schedule.startTime} - {subject.schedule.endTime}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            👥 {subject.enrolledStudents.length}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleActive(subject.id, subject.active)}
                            className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                              subject.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            {subject.active ? "🟢 Active" : "🔴 Inactive"}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleOpenEnrollModal(subject)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all text-sm font-semibold">
                              👥
                            </button>
                            <button onClick={() => handleDeleteSubject(subject.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold">
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

      {/* Add Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">➕ Add New Subject</h2>
              <p className="text-sm opacity-90 mt-1">All fields are required *</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject Code *</label>
                  <input 
                    type="text" 
                    value={newSubject.code} 
                    onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="CS101" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject Name *</label>
                  <input 
                    type="text" 
                    value={newSubject.name} 
                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="Data Structures" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Faculty *</label>
                  <select 
                    value={newSubject.facultyId} 
                    onChange={(e) => setNewSubject({ ...newSubject, facultyId: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Faculty</option>
                    {faculty.map(f => (
                      <option key={f.id} value={f.id}>{f.name} - {f.department}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Room *</label>
                  <input 
                    type="text" 
                    value={newSubject.room} 
                    onChange={(e) => setNewSubject({ ...newSubject, room: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="Lab 305" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                  <input 
                    type="time" 
                    value={newSubject.startTime} 
                    onChange={(e) => setNewSubject({ ...newSubject, startTime: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Time *</label>
                  <input 
                    type="time" 
                    value={newSubject.endTime} 
                    onChange={(e) => setNewSubject({ ...newSubject, endTime: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Semester *</label>
                  <select 
                    value={newSubject.semester} 
                    onChange={(e) => setNewSubject({ ...newSubject, semester: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">School Year *</label>
                  <input 
                    type="text" 
                    value={newSubject.schoolYear} 
                    onChange={(e) => setNewSubject({ ...newSubject, schoolYear: e.target.value })} 
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none" 
                    placeholder="2024-2025"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Class Days * (Select at least one)</label>
                <div className="grid grid-cols-3 gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        newSubject.days.includes(day)
                          ? "bg-indigo-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
                {newSubject.days.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">Selected: {newSubject.days.join(", ")}</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold">
                Cancel
              </button>
              <button onClick={handleAddSubject} className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                ✅ Add Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Students Modal */}
      {showEnrollModal && selectedSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4">
              <h2 className="text-2xl font-bold">👥 Enroll Students - {selectedSubject.name}</h2>
              <p className="text-sm opacity-90 mt-1">{selectedSubject.code} • {selectedSubject.facultyName} • {selectedSubject.room}</p>
              <p className="text-sm opacity-90">Currently enrolled: {selectedStudents.length} students</p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search students by name, ID, or course..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-2">
                {filteredStudentsForEnroll.map((student) => (
                  <label
                    key={student.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedStudents.includes(student.id)
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => handleStudentToggle(student.id)}
                      className="w-5 h-5 text-indigo-500 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{student.name}</p>
                      <p className="text-sm text-gray-600">{student.studentId} • {student.course} • {student.yearLevel}</p>
                    </div>
                  </label>
                ))}
              </div>

              {filteredStudentsForEnroll.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>No students found matching your search</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
              <p className="text-sm font-semibold text-gray-700">
                Selected: {selectedStudents.length} / {students.length} students
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEnrollModal(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold">
                  Cancel
                </button>
                <button onClick={handleSaveEnrollment} className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold">
                  ✅ Save Enrollment
                </button>
              </div>
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
        <span className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
          {value}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full animate-pulse`} style={{ width: "70%" }}></div>
      </div>
    </div>
  );
}
