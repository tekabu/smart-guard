import { useState } from 'react';

interface ScheduleSlot {
  day: string;
  timeRange: string;
}

interface ScheduleManagerProps {
  schedule: Record<string, string>;
  onChange: (schedule: Record<string, string>) => void;
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
];

/**
 * Schedule Manager Component for Faculty
 * Allows setting class schedules for each day of the week
 */
export default function ScheduleManager({ schedule, onChange }: ScheduleManagerProps) {
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('10:00');

  const handleAddSchedule = () => {
    if (!selectedDay) {
      alert('Please select a day');
      return;
    }

    if (startTime >= endTime) {
      alert('End time must be after start time');
      return;
    }

    const timeRange = `${startTime}-${endTime}`;
    const newSchedule = { ...schedule, [selectedDay]: timeRange };
    onChange(newSchedule);

    // Reset form
    setSelectedDay('');
    setStartTime('08:00');
    setEndTime('10:00');
  };

  const handleRemoveSchedule = (day: string) => {
    const newSchedule = { ...schedule };
    delete newSchedule[day];
    onChange(newSchedule);
  };

  const getDayLabel = (dayKey: string) => {
    return DAYS.find(d => d.key === dayKey)?.label || dayKey;
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700">
        Class Schedule (Optional)
      </label>

      {/* Add Schedule Form */}
      <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Day</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            >
              <option value="">Select Day</option>
              {DAYS.map((day) => (
                <option key={day.key} value={day.key} disabled={!!schedule[day.key]}>
                  {day.label} {schedule[day.key] ? '(Added)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddSchedule}
              className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all font-semibold text-sm"
            >
              ➕ Add
            </button>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      {Object.keys(schedule).length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Added Schedules:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(schedule).map(([day, timeRange]) => (
              <div
                key={day}
                className="flex items-center justify-between bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">
                      {getDayLabel(day)}
                    </p>
                    <p className="text-xs text-indigo-600 font-mono">
                      🕐 {timeRange}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSchedule(day)}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No schedule added yet</p>
          <p className="text-xs text-gray-400">Add class schedules using the form above</p>
        </div>
      )}

      {/* Visual Calendar Preview */}
      {Object.keys(schedule).length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
          <p className="text-sm font-semibold text-indigo-900 mb-3">📆 Weekly Schedule Preview</p>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div
                key={day.key}
                className={`text-center p-2 rounded-lg text-xs ${
                  schedule[day.key]
                    ? 'bg-indigo-500 text-white font-semibold'
                    : 'bg-white text-gray-400'
                }`}
              >
                <div className="font-bold">{day.label.substring(0, 3)}</div>
                {schedule[day.key] && (
                  <div className="text-[10px] mt-1 opacity-90">
                    {schedule[day.key].split('-')[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
