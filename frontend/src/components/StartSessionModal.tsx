import { useState, useEffect } from 'react';
import { getRealtimeDb } from '../firebase';
import { ref, onValue, off } from 'firebase/database';

interface Subject {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  facultyName: string;
  room: string;
}

interface Faculty {
  id: string;
  name: string;
  department: string;
}

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (sessionData: {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    facultyId: string;
    facultyName: string;
    room: string;
  }) => void;
}

export default function StartSessionModal({ isOpen, onClose, onStartSession }: StartSessionModalProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const db = getRealtimeDb();
    
    // Load subjects
    const subjectsRef = ref(db, 'subjects');
    const subjectsUnsubscribe = onValue(subjectsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const subjectsList: Subject[] = Object.entries(data)
          .filter(([_, value]: [string, any]) => value.active !== false)
          .map(([key, value]: [string, any]) => ({
            id: key,
            code: value.code || 'N/A',
            name: value.name || 'Unknown',
            facultyId: value.facultyId || '',
            facultyName: value.facultyName || 'Unassigned',
            room: value.room || 'N/A',
          }));
        setSubjects(subjectsList);
      }
      setLoading(false);
    });

    // Load faculty
    const facultyRef = ref(db, 'users/faculty');
    const facultyUnsubscribe = onValue(facultyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const facultyList: Faculty[] = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          name: value.name || 'Unknown',
          department: value.department || 'N/A',
        }));
        setFaculty(facultyList);
      }
    });

    return () => {
      off(subjectsRef, 'value', subjectsUnsubscribe);
      off(facultyRef, 'value', facultyUnsubscribe);
    };
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedSubjectId) {
      alert('Please select a subject');
      return;
    }

    const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
    if (!selectedSubject) {
      alert('Invalid subject selected');
      return;
    }

    const room = customRoom.trim() || selectedSubject.room;

    onStartSession({
      subjectId: selectedSubject.id,
      subjectCode: selectedSubject.code,
      subjectName: selectedSubject.name,
      facultyId: selectedSubject.facultyId,
      facultyName: selectedSubject.facultyName,
      room: room,
    });

    // Reset form
    setSelectedSubjectId('');
    setCustomRoom('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold">🎓 Start New Session</h2>
          <p className="text-sm opacity-90 mt-1">Select a subject to begin class</p>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading subjects...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-lg font-semibold text-gray-700">No Subjects Available</p>
              <p className="text-sm text-gray-500">Please create subjects first in the Subjects page</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Subject *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Choose a subject...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name} ({subject.facultyName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSubjectId && (
                <>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Subject Details</h3>
                    {(() => {
                      const subject = subjects.find(s => s.id === selectedSubjectId);
                      return subject ? (
                        <div className="space-y-1 text-sm">
                          <p><span className="font-semibold">Code:</span> {subject.code}</p>
                          <p><span className="font-semibold">Name:</span> {subject.name}</p>
                          <p><span className="font-semibold">Faculty:</span> {subject.facultyName}</p>
                          <p><span className="font-semibold">Default Room:</span> {subject.room}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Room (Optional - Override default)
                    </label>
                    <input
                      type="text"
                      value={customRoom}
                      onChange={(e) => setCustomRoom(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder={`Leave empty to use: ${subjects.find(s => s.id === selectedSubjectId)?.room || 'default room'}`}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedSubjectId || loading}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Start Session
          </button>
        </div>
      </div>
    </div>
  );
}
