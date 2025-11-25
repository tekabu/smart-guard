import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { getRealtimeDb, realtimeDbHelpers } from "./realtimeDb.js";
import * as security from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../smartguard-system-firebase-adminsdk-fbsvc-396e05aedd.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smartguard-system-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// Users (Faculty/Students)
app.get("/api/users", async (req, res) => {
  try {
    const { role } = req.query;
    let query: any = db.collection("users");
    if (role) {
      query = query.where("role", "==", role);
    }
    const snapshot = await query.get();
    const users = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const user = req.body;
    const docRef = await db.collection("users").add(user);
    res.json({ id: docRef.id, ...user });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    await db.collection("users").doc(userId).update(updates);
    res.json({ success: true, message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await db.collection("users").doc(userId).delete();
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const snapshot = await db.collection("sessions").get();
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const session = req.body;
    const docRef = await db.collection("sessions").add(session);
    res.json({ id: docRef.id, ...session });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    await db.collection("sessions").doc(sessionId).update(updates);
    res.json({ success: true, message: "Session updated successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Devices
app.get("/api/devices", async (req, res) => {
  try {
    const snapshot = await db.collection("devices").get();
    const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/devices", async (req, res) => {
  try {
    const device = req.body;
    const docRef = await db.collection("devices").add(device);
    res.json({ id: docRef.id, ...device });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/devices/:id/command", async (req, res) => {
  try {
    const { id } = req.params;
    const { command, mode } = req.body;
    
    const deviceRef = db.collection("devices").doc(id);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Update device status based on command
    if (command === "lock") {
      await deviceRef.update({ status: "locked", lastSeen: new Date().toLocaleTimeString() });
    } else if (command === "unlock") {
      await deviceRef.update({ status: "unlocked", lastSeen: new Date().toLocaleTimeString() });
    } else if (command === "set_access_mode" && mode) {
      await deviceRef.update({ accessMode: mode, lastSeen: new Date().toLocaleTimeString() });
    } else if (command === "disable") {
      await deviceRef.update({ online: false, lastSeen: new Date().toLocaleTimeString() });
    } else if (command === "enable") {
      await deviceRef.update({ online: true, lastSeen: new Date().toLocaleTimeString() });
    }

    // Log the command
    await db.collection("accessLogs").add({
      timestamp: new Date().toLocaleString(),
      user: "Admin",
      method: "Manual",
      result: "Granted",
      door: deviceDoc.data()?.name || "Unknown",
      description: `Admin ${command} command`,
    });

    res.json({ success: true, message: `Command ${command} executed` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Access Logs
app.get("/api/access-logs", async (req, res) => {
  try {
    const snapshot = await db.collection("accessLogs")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    const logs = snapshot.docs.map(doc => doc.data());
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Security
app.get("/api/security/unauthorized-attempts", async (req, res) => {
  try {
    const snapshot = await db.collection("accessLogs").get();
    const attempts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((log: any) => log.result === "Denied")
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 20);
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/security/emergency-unlock", async (req, res) => {
  try {
    const { admin, reason, duration } = req.body;
    const unlockId = await security.triggerEmergencyUnlock(
      admin || "Admin",
      reason || "Emergency situation",
      duration || 300
    );
    
    // Also unlock in Firestore for compatibility
    const devicesSnapshot = await db.collection("devices").get();
    const updatePromises = devicesSnapshot.docs.map(doc => 
      doc.ref.update({ status: "unlocked", lastSeen: new Date().toLocaleTimeString() })
    );
    await Promise.all(updatePromises);
    
    res.json({ success: true, unlockId, message: "Emergency unlock activated for all doors" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/security/block-user", async (req, res) => {
  try {
    const { userId, blockedBy, reason, blockType, duration } = req.body;
    const blockId = await security.blockUser(
      userId,
      blockedBy || "Admin",
      reason || "Security violation",
      blockType || "permanent",
      duration
    );
    res.json({ success: true, blockId, message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Enhanced Security Endpoints
app.get("/api/security/blocked-users", async (req, res) => {
  try {
    const blockedUsers = await security.getBlockedUsers();
    res.json(blockedUsers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/security/unblock-user", async (req, res) => {
  try {
    const { userId, unblockedBy, reason } = req.body;
    await security.unblockUser(
      userId,
      unblockedBy || "Admin",
      reason || "Block lifted"
    );
    res.json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Audit Logs
app.get("/api/audit-logs", async (req, res) => {
  try {
    const { limit, type, user, startDate, endDate } = req.query;
    const logs = await security.getAuditLogs(
      parseInt(limit as string) || 100,
      { type, user, startDate, endDate } as any
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/audit-logs/export", async (req, res) => {
  try {
    const filters = req.body;
    const csv = await security.exportAuditLogs(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reports
app.post("/api/reports/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { dateRange } = req.body;
    // In a real implementation, generate PDF and upload to Firebase Storage
    // For now, return mock download URL
    res.json({ downloadUrl: `https://example.com/reports/${type}-report.pdf` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Settings
app.post("/api/settings/backup", async (req, res) => {
  try {
    // Export all data to JSON
    const collections = ["users", "devices", "accessLogs", "sessions"];
    const backup: any = {};
    for (const col of collections) {
      const snapshot = await db.collection(col).get();
      backup[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    // In a real implementation, upload to Firebase Storage
    res.json({ downloadUrl: "https://example.com/backup/smartguard-backup.json", backup });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// REALTIME DATABASE ENDPOINTS (IoT Integration)
// ============================================

// Realtime Device Status (for Arduino/ESP8266)
app.get("/api/realtime/devices", async (req, res) => {
  try {
    const rtdb = getRealtimeDb();
    const snapshot = await rtdb.ref('devices').once('value');
    const devices: any[] = [];
    snapshot.forEach((child: any) => {
      devices.push({ id: child.key, ...child.val() });
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/realtime/devices/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await realtimeDbHelpers.getDeviceStatus(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({ id: deviceId, ...device });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/realtime/devices/:deviceId/lock", async (req, res) => {
  try {
    const { deviceId } = req.params;
    await realtimeDbHelpers.setDeviceLockStatus(deviceId, true);
    
    // Also log to access logs
    await realtimeDbHelpers.addAccessLog({
      userId: "admin",
      userName: "Admin",
      method: "Manual",
      result: "Granted",
      door: deviceId,
      deviceId,
      description: "Admin lock command"
    });
    
    res.json({ success: true, message: "Device locked" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/realtime/devices/:deviceId/unlock", async (req, res) => {
  try {
    const { deviceId } = req.params;
    await realtimeDbHelpers.setDeviceLockStatus(deviceId, false);
    
    // Also log to access logs
    await realtimeDbHelpers.addAccessLog({
      userId: "admin",
      userName: "Admin",
      method: "Manual",
      result: "Granted",
      door: deviceId,
      deviceId,
      description: "Admin unlock command"
    });
    
    res.json({ success: true, message: "Device unlocked" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Realtime Access Logs
app.get("/api/realtime/access-logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await realtimeDbHelpers.getRecentAccessLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/realtime/access-logs", async (req, res) => {
  try {
    const logData = req.body;
    const logId = await realtimeDbHelpers.addAccessLog(logData);
    res.json({ success: true, id: logId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Attendance Management
app.get("/api/attendance/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const attendance = await realtimeDbHelpers.getSessionAttendance(sessionId);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/attendance/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, studentName, status, method } = req.body;
    
    await realtimeDbHelpers.markAttendance(sessionId, studentId, {
      studentId,
      studentName,
      status: status || "present",
      method: method || "RFID"
    });
    
    res.json({ success: true, message: "Attendance marked" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Session Management with OTP
app.post("/api/sessions/:sessionId/generate-otp", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const otp = await realtimeDbHelpers.generateSessionOTP(sessionId);
    res.json({ success: true, otp });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/sessions/:sessionId/validate-otp", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { otp } = req.body;
    const isValid = await realtimeDbHelpers.validateOTP(sessionId, otp);
    res.json({ valid: isValid });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/sessions/:sessionId/end", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await realtimeDbHelpers.endSession(sessionId);
    res.json({ success: true, message: "Session ended" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Faculty Exits
app.get("/api/faculty-exits", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const exits = await realtimeDbHelpers.getFacultyExits(limit);
    res.json(exits);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/faculty-exits", async (req, res) => {
  try {
    const exitData = req.body;
    const exitId = await realtimeDbHelpers.addFacultyExit(exitData);
    res.json({ success: true, id: exitId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/faculty-exits/:exitId/reason", async (req, res) => {
  try {
    const { exitId } = req.params;
    const { reason, clearedBy } = req.body;
    await realtimeDbHelpers.updateFacultyExitReason(exitId, reason, clearedBy || "Admin");
    res.json({ success: true, message: "Exit reason updated" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// System Status
app.get("/api/system-status", async (req, res) => {
  try {
    const status = await realtimeDbHelpers.getSystemStatus();
    res.json(status || {
      wifiConnected: true,
      firebaseConnected: true,
      activeDevices: 0,
      systemHealth: "healthy"
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/system-status", async (req, res) => {
  try {
    const statusData = req.body;
    await realtimeDbHelpers.updateSystemStatus(statusData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// EEPROM Management
app.get("/api/eeprom/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const eepromData = await realtimeDbHelpers.getEEPROMBackup(deviceId);
    res.json(eepromData || { rfidIds: [], fingerprintIds: [], capacity: 1000, used: 0 });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/eeprom/:deviceId/backup", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const eepromData = req.body;
    await realtimeDbHelpers.backupEEPROM(deviceId, eepromData);
    res.json({ success: true, message: "EEPROM backed up successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Schedules Management
app.get("/api/schedules", async (req, res) => {
  try {
    const snapshot = await db.collection("schedules").get();
    const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/schedules", async (req, res) => {
  try {
    const schedule = req.body;
    const docRef = await db.collection("schedules").add(schedule);
    res.json({ id: docRef.id, ...schedule });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/schedules/:scheduleId", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;
    await db.collection("schedules").doc(scheduleId).update(updates);
    res.json({ success: true, message: "Schedule updated successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete("/api/schedules/:scheduleId", async (req, res) => {
  try {
    const { scheduleId } = req.params;
    await db.collection("schedules").doc(scheduleId).delete();
    res.json({ success: true, message: "Schedule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Clearance Management
app.get("/api/clearance", async (req, res) => {
  try {
    const { facultyId } = req.query;
    let query: any = db.collection("clearance");
    if (facultyId) {
      query = query.where("facultyId", "==", facultyId);
    }
    const snapshot = await query.get();
    const clearances = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(clearances);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/clearance", async (req, res) => {
  try {
    const clearanceData = req.body;
    const docRef = await db.collection("clearance").add({
      ...clearanceData,
      createdAt: new Date().toISOString(),
      status: "pending"
    });
    res.json({ id: docRef.id, ...clearanceData });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/clearance/:clearanceId", async (req, res) => {
  try {
    const { clearanceId } = req.params;
    const updates = req.body;
    await db.collection("clearance").doc(clearanceId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: "Clearance updated successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Firestore: Connected`);
  console.log(`Realtime Database: Connected`);
});
