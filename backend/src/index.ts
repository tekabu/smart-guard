import admin from "firebase-admin";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../smartguard-system-firebase-adminsdk-fbsvc-396e05aedd.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// Users (Faculty/Students)
app.get("/api/users", async (req, res) => {
  const { role } = req.query;
  let query: any = db.collection("users");
  if (role) {
    query = query.where("role", "==", role);
  }
  const snapshot = await query.get();
  const users = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  res.json(users);
});

app.post("/api/users", async (req, res) => {
  const user = req.body;
  const docRef = await db.collection("users").add(user);
  res.json({ id: docRef.id, ...user });
});

// Sessions
app.get("/api/sessions", async (req, res) => {
  const snapshot = await db.collection("sessions").get();
  const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(sessions);
});

app.post("/api/sessions", async (req, res) => {
  const session = req.body;
  const docRef = await db.collection("sessions").add(session);
  res.json({ id: docRef.id, ...session });
});

// Devices
app.get("/api/devices", async (req, res) => {
  const snapshot = await db.collection("devices").get();
  const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(devices);
});

app.post("/api/devices", async (req, res) => {
  const device = req.body;
  const docRef = await db.collection("devices").add(device);
  res.json({ id: docRef.id, ...device });
});

app.post("/api/devices/:id/command", async (req, res) => {
  const { id } = req.params;
  const { command, mode } = req.body;
  // In a real implementation, this would send command to device via MQTT or similar
  await db.collection("deviceCommands").add({
    deviceId: id,
    command,
    mode,
    timestamp: new Date(),
  });
  res.json({ success: true });
});

// Access Logs
app.get("/api/access-logs", async (req, res) => {
  const snapshot = await db.collection("accessLogs")
    .orderBy("timestamp", "desc")
    .limit(10)
    .get();
  const logs = snapshot.docs.map(doc => doc.data());
  res.json(logs);
});

// Security
app.get("/api/security/unauthorized-attempts", async (req, res) => {
  const snapshot = await db.collection("accessLogs")
    .where("result", "==", "Denied")
    .orderBy("timestamp", "desc")
    .limit(20)
    .get();
  const attempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(attempts);
});

app.post("/api/security/emergency-unlock", async (req, res) => {
  const { door } = req.body;
  // Send emergency unlock command
  await db.collection("accessLogs").add({
    timestamp: new Date().toISOString(),
    user: "EMERGENCY",
    method: "EMERGENCY",
    result: "Granted",
    door,
    description: "Emergency unlock activated",
  });
  res.json({ success: true });
});

// Reports
app.post("/api/reports/:type", async (req, res) => {
  const { type } = req.params;
  const { dateRange } = req.body;
  // In a real implementation, generate PDF and upload to Firebase Storage
  // For now, return mock download URL
  res.json({ downloadUrl: `https://example.com/reports/${type}-report.pdf` });
});

// Settings
app.post("/api/settings/backup", async (req, res) => {
  // Export all data to JSON
  const collections = ["users", "devices", "accessLogs", "sessions"];
  const backup: any = {};
  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    backup[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  // In a real implementation, upload to Firebase Storage
  res.json({ downloadUrl: "https://example.com/backup/smartguard-backup.json" });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
