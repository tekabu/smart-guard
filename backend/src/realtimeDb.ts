import admin from "firebase-admin";

// Lazy getter for Realtime Database to avoid initialization order issues
export const getRealtimeDb = (): admin.database.Database => admin.database();

/**
 * Realtime Database Structure for SmartGuard IoT System
 * 
 * /devices/{deviceId}
 *   - name: string
 *   - location: string
 *   - status: "locked" | "unlocked"
 *   - online: boolean
 *   - lastSeen: timestamp
 *   - accessMode: "rfid" | "fingerprint" | "both"
 *   - facultyWindow: number (minutes)
 * 
 * /accessLogs/{logId}
 *   - timestamp: string
 *   - userId: string
 *   - userName: string
 *   - method: "RFID" | "Fingerprint"
 *   - result: "Granted" | "Denied"
 *   - door: string
 *   - deviceId: string
 *   - description: string
 * 
 * /attendance/{sessionId}/{studentId}
 *   - studentId: string
 *   - studentName: string
 *   - timestamp: string
 *   - status: "present" | "absent" | "late"
 *   - method: "RFID" | "Fingerprint" | "OTP"
 * 
 * /sessions/{sessionId}
 *   - faculty: string
 *   - facultyId: string
 *   - room: string
 *   - subject: string
 *   - status: "Active" | "Ended"
 *   - started: timestamp
 *   - ended: timestamp
 *   - otp: string (optional)
 *   - otpExpiry: timestamp (optional)
 * 
 * /emergencyAlerts/{alertId}
 *   - timestamp: string
 *   - location: string
 *   - deviceId: string
 *   - acknowledged: boolean
 *   - acknowledgedBy: string (optional)
 *   - acknowledgedAt: timestamp (optional)
 * 
 * /faculty_exits/{exitId}
 *   - facultyId: string
 *   - timestamp: string
 *   - type: "exit"
 *   - reason: string (optional, to be filled by admin)
 * 
 * /systemStatus
 *   - wifiConnected: boolean
 *   - firebaseConnected: boolean
 *   - lastSync: timestamp
 *   - activeDevices: number
 *   - systemHealth: "healthy" | "warning" | "critical"
 * 
 * /eeprom/{deviceId}
 *   - rfidIds: string[]
 *   - fingerprintIds: number[]
 *   - lastBackup: timestamp
 *   - capacity: number
 *   - used: number
 */

// Helper functions for common operations
export const realtimeDbHelpers = {
  // Device operations
  async getDeviceStatus(deviceId: string) {
    const db = getRealtimeDb();
    const snapshot = await db.ref(`devices/${deviceId}`).once('value');
    return snapshot.val();
  },

  async updateDeviceStatus(deviceId: string, status: any) {
    const db = getRealtimeDb();
    await db.ref(`devices/${deviceId}`).update({
      ...status,
      lastSeen: admin.database.ServerValue.TIMESTAMP
    });
  },

  async setDeviceLockStatus(deviceId: string, locked: boolean) {
    const db = getRealtimeDb();
    await db.ref(`devices/${deviceId}`).update({
      status: locked ? "locked" : "unlocked",
      lastSeen: admin.database.ServerValue.TIMESTAMP
    });
  },

  // Access log operations
  async addAccessLog(log: any) {
    const db = getRealtimeDb();
    const newLogRef = db.ref('accessLogs').push();
    await newLogRef.set({
      ...log,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return newLogRef.key;
  },

  async getRecentAccessLogs(limit: number = 50) {
    const db = getRealtimeDb();
    const snapshot = await db.ref('accessLogs')
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');
    
    const logs: any[] = [];
    snapshot.forEach((child) => {
      logs.push({ id: child.key, ...child.val() });
    });
    return logs.reverse();
  },

  // Attendance operations
  async markAttendance(sessionId: string, studentId: string, data: any) {
    const db = getRealtimeDb();
    await db.ref(`attendance/${sessionId}/${studentId}`).set({
      ...data,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
  },

  async getSessionAttendance(sessionId: string) {
    const db = getRealtimeDb();
    const snapshot = await db.ref(`attendance/${sessionId}`).once('value');
    const attendance: any[] = [];
    snapshot.forEach((child) => {
      attendance.push({ id: child.key, ...child.val() });
    });
    return attendance;
  },

  // Session operations
  async createSession(sessionData: any) {
    const db = getRealtimeDb();
    const newSessionRef = db.ref('sessions').push();
    await newSessionRef.set({
      ...sessionData,
      started: admin.database.ServerValue.TIMESTAMP,
      status: "Active"
    });
    return newSessionRef.key;
  },

  async endSession(sessionId: string) {
    const db = getRealtimeDb();
    await db.ref(`sessions/${sessionId}`).update({
      status: "Ended",
      ended: admin.database.ServerValue.TIMESTAMP
    });
  },

  async generateSessionOTP(sessionId: string) {
    const db = getRealtimeDb();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + (30 * 60 * 1000); // 30 minutes
    
    await db.ref(`sessions/${sessionId}`).update({
      otp,
      otpExpiry: expiry
    });
    
    return otp;
  },

  async validateOTP(sessionId: string, otp: string) {
    const db = getRealtimeDb();
    const snapshot = await db.ref(`sessions/${sessionId}`).once('value');
    const session = snapshot.val();
    
    if (!session || !session.otp || !session.otpExpiry) {
      return false;
    }
    
    if (Date.now() > session.otpExpiry) {
      return false; // OTP expired
    }
    
    return session.otp === otp;
  },

  // Emergency alert operations
  async createEmergencyAlert(alertData: any) {
    const db = getRealtimeDb();
    const newAlertRef = db.ref('emergencyAlerts').push();
    await newAlertRef.set({
      ...alertData,
      timestamp: admin.database.ServerValue.TIMESTAMP,
      acknowledged: false
    });
    return newAlertRef.key;
  },

  async acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    const db = getRealtimeDb();
    await db.ref(`emergencyAlerts/${alertId}`).update({
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: admin.database.ServerValue.TIMESTAMP
    });
  },

  async getUnacknowledgedAlerts() {
    const db = getRealtimeDb();
    const snapshot = await db.ref('emergencyAlerts')
      .orderByChild('acknowledged')
      .equalTo(false)
      .once('value');
    
    const alerts: any[] = [];
    snapshot.forEach((child) => {
      alerts.push({ id: child.key, ...child.val() });
    });
    return alerts;
  },

  // Faculty exit operations
  async addFacultyExit(exitData: any) {
    const db = getRealtimeDb();
    const newExitRef = db.ref('faculty_exits').push();
    await newExitRef.set({
      ...exitData,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    return newExitRef.key;
  },

  async getFacultyExits(limit: number = 50) {
    const db = getRealtimeDb();
    const snapshot = await db.ref('faculty_exits')
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');
    
    const exits: any[] = [];
    snapshot.forEach((child) => {
      exits.push({ id: child.key, ...child.val() });
    });
    return exits.reverse();
  },

  async updateFacultyExitReason(exitId: string, reason: string, clearedBy: string) {
    const db = getRealtimeDb();
    await db.ref(`faculty_exits/${exitId}`).update({
      reason,
      clearedBy,
      clearedAt: admin.database.ServerValue.TIMESTAMP
    });
  },

  // System status operations
  async updateSystemStatus(status: any) {
    const db = getRealtimeDb();
    await db.ref('systemStatus').update({
      ...status,
      lastSync: admin.database.ServerValue.TIMESTAMP
    });
  },

  async getSystemStatus() {
    const db = getRealtimeDb();
    const snapshot = await db.ref('systemStatus').once('value');
    return snapshot.val();
  },

  // EEPROM operations
  async backupEEPROM(deviceId: string, data: any) {
    const db = getRealtimeDb();
    await db.ref(`eeprom/${deviceId}`).set({
      ...data,
      lastBackup: admin.database.ServerValue.TIMESTAMP
    });
  },

  async getEEPROMBackup(deviceId: string) {
    const db = getRealtimeDb();
    const snapshot = await db.ref(`eeprom/${deviceId}`).once('value');
    return snapshot.val();
  },

  // Listen for real-time changes (for WebSocket/SSE implementation)
  listenToDeviceChanges(callback: (deviceId: string, data: any) => void) {
    const db = getRealtimeDb();
    db.ref('devices').on('child_changed', (snapshot) => {
      callback(snapshot.key!, snapshot.val());
    });
  },

  listenToAccessLogs(callback: (log: any) => void) {
    const db = getRealtimeDb();
    db.ref('accessLogs').on('child_added', (snapshot) => {
      callback({ id: snapshot.key, ...snapshot.val() });
    });
  },

  listenToEmergencyAlerts(callback: (alert: any) => void) {
    const db = getRealtimeDb();
    db.ref('emergencyAlerts').on('child_added', (snapshot) => {
      callback({ id: snapshot.key, ...snapshot.val() });
    });
  },

  listenToFacultyExits(callback: (exit: any) => void) {
    const db = getRealtimeDb();
    db.ref('faculty_exits').on('child_added', (snapshot) => {
      callback({ id: snapshot.key, ...snapshot.val() });
    });
  },

  // Stop listening
  stopListening(path: string) {
    const db = getRealtimeDb();
    db.ref(path).off();
  }
};
