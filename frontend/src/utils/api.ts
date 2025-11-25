const API_BASE_URL = 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(0, 'Network error: Unable to connect to server');
    }
    throw new ApiError(500, 'An unexpected error occurred');
  }
}

export const api = {
  // Devices (Firestore)
  getDevices: () => apiRequest<any[]>('/devices'),
  sendDeviceCommand: (deviceId: string, command: string, mode?: string) =>
    apiRequest(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, mode }),
    }),

  // Realtime Devices (for IoT)
  getRealtimeDevices: () => apiRequest<any[]>('/realtime/devices'),
  getRealtimeDevice: (deviceId: string) => apiRequest(`/realtime/devices/${deviceId}`),
  lockDevice: (deviceId: string) =>
    apiRequest(`/realtime/devices/${deviceId}/lock`, { method: 'POST' }),
  unlockDevice: (deviceId: string) =>
    apiRequest(`/realtime/devices/${deviceId}/unlock`, { method: 'POST' }),

  // Users
  getUsers: (role?: string) =>
    apiRequest<any[]>(`/users${role ? `?role=${role}` : ''}`),
  createUser: (user: any) =>
    apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  updateUser: (userId: string, updates: any) =>
    apiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteUser: (userId: string) =>
    apiRequest(`/users/${userId}`, { method: 'DELETE' }),

  // Sessions
  getSessions: () => apiRequest<any[]>('/sessions'),
  createSession: (session: any) =>
    apiRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),
  updateSession: (sessionId: string, updates: any) =>
    apiRequest(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  endSession: (sessionId: string) =>
    apiRequest(`/sessions/${sessionId}/end`, { method: 'POST' }),
  generateOTP: (sessionId: string) =>
    apiRequest(`/sessions/${sessionId}/generate-otp`, { method: 'POST' }),
  validateOTP: (sessionId: string, otp: string) =>
    apiRequest(`/sessions/${sessionId}/validate-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),

  // Attendance
  getAttendance: (sessionId: string) =>
    apiRequest<any[]>(`/attendance/${sessionId}`),
  markAttendance: (sessionId: string, data: any) =>
    apiRequest(`/attendance/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Access Logs
  getAccessLogs: () => apiRequest<any[]>('/access-logs'),
  getRealtimeAccessLogs: (limit?: number) =>
    apiRequest<any[]>(`/realtime/access-logs${limit ? `?limit=${limit}` : ''}`),
  addAccessLog: (log: any) =>
    apiRequest('/realtime/access-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  // Security
  emergencyUnlock: () =>
    apiRequest('/security/emergency-unlock', {
      method: 'POST',
      body: JSON.stringify({ door: 'All Doors' }),
    }),
  getUnauthorizedAttempts: () =>
    apiRequest<any[]>('/security/unauthorized-attempts'),
  blockUser: (userId: string) =>
    apiRequest('/security/block-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Emergency Alerts
  getEmergencyAlerts: () => apiRequest<any[]>('/emergency-alerts'),
  createEmergencyAlert: (alert: any) =>
    apiRequest('/emergency-alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    }),
  acknowledgeAlert: (alertId: string, acknowledgedBy: string) =>
    apiRequest(`/emergency-alerts/${alertId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy }),
    }),

  // System Status
  getSystemStatus: () => apiRequest('/system-status'),
  updateSystemStatus: (status: any) =>
    apiRequest('/system-status', {
      method: 'POST',
      body: JSON.stringify(status),
    }),

  // EEPROM Management
  getEEPROM: (deviceId: string) => apiRequest(`/eeprom/${deviceId}`),
  backupEEPROM: (deviceId: string, data: any) =>
    apiRequest(`/eeprom/${deviceId}/backup`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Schedules
  getSchedules: () => apiRequest<any[]>('/schedules'),
  createSchedule: (schedule: any) =>
    apiRequest('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    }),
  updateSchedule: (scheduleId: string, updates: any) =>
    apiRequest(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteSchedule: (scheduleId: string) =>
    apiRequest(`/schedules/${scheduleId}`, { method: 'DELETE' }),

  // Clearance
  getClearances: (facultyId?: string) =>
    apiRequest<any[]>(`/clearance${facultyId ? `?facultyId=${facultyId}` : ''}`),
  createClearance: (clearance: any) =>
    apiRequest('/clearance', {
      method: 'POST',
      body: JSON.stringify(clearance),
    }),
  updateClearance: (clearanceId: string, updates: any) =>
    apiRequest(`/clearance/${clearanceId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Reports
  generateReport: (type: string, data?: any) =>
    apiRequest(`/reports/${type}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  // Settings
  backupData: () =>
    apiRequest('/settings/backup', { method: 'POST' }),
};
