import admin from "firebase-admin";
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

async function seedData() {
  console.log("Seeding data...");

  // Seed Devices
  const devices = [
    {
      name: "SmartGuard_01",
      location: "Front Door",
      status: "locked",
      lastSeen: "09:31 AM",
      online: true,
      accessMode: "both",
      facultyWindow: 15,
    },
    {
      name: "SmartGuard_02",
      location: "Back Door",
      status: "locked",
      lastSeen: "09:35 AM",
      online: true,
      accessMode: "rfid",
      facultyWindow: 10,
    },
    {
      name: "SmartGuard_03",
      location: "Faculty Exit",
      status: "unlocked",
      lastSeen: "09:20 AM",
      online: false,
      accessMode: "fingerprint",
      facultyWindow: 20,
    },
  ];

  for (const device of devices) {
    await db.collection("devices").add(device);
  }
  console.log("✓ Devices seeded");

  // Seed Access Logs
  const logs = [
    {
      timestamp: "2025-01-11 09:31",
      user: "Prof. Santos",
      method: "Fingerprint",
      result: "Granted",
      door: "Front Door",
      description: "Faculty Entry",
    },
    {
      timestamp: "2025-01-11 09:45",
      user: "Student 123",
      method: "RFID",
      result: "Granted",
      door: "Front Door",
      description: "Attendance",
    },
    {
      timestamp: "2025-01-11 09:47",
      user: "Unknown",
      method: "RFID",
      result: "Denied",
      door: "Front Door",
      description: "Unauthorized",
    },
    {
      timestamp: "2025-01-11 09:50",
      user: "Prof. Cruz",
      method: "RFID",
      result: "Granted",
      door: "Back Door",
      description: "Faculty Entry",
    },
    {
      timestamp: "2025-01-11 09:55",
      user: "Student 456",
      method: "Fingerprint",
      result: "Granted",
      door: "Front Door",
      description: "Attendance",
    },
  ];

  for (const log of logs) {
    await db.collection("accessLogs").add(log);
  }
  console.log("✓ Access logs seeded");

  // Seed Faculty
  const faculty = [
    {
      name: "Prof. Santos",
      department: "Computer Science",
      cardId: "FAC001",
      fingerprintId: "FP001",
      clearance: true,
      active: true,
      role: "faculty",
    },
    {
      name: "Prof. Cruz",
      department: "Engineering",
      cardId: "FAC002",
      fingerprintId: "FP002",
      clearance: false,
      active: true,
      role: "faculty",
    },
    {
      name: "Prof. Reyes",
      department: "Mathematics",
      cardId: "FAC003",
      fingerprintId: "FP003",
      clearance: true,
      active: true,
      role: "faculty",
    },
  ];

  for (const f of faculty) {
    await db.collection("users").add(f);
  }
  console.log("✓ Faculty seeded");

  // Seed Students
  const students = [
    {
      name: "Juan Dela Cruz",
      course: "BSCS",
      cardId: "STU001",
      active: true,
      role: "student",
    },
    {
      name: "Maria Santos",
      course: "BSIT",
      cardId: "STU002",
      active: true,
      role: "student",
    },
    {
      name: "Pedro Garcia",
      course: "BSCE",
      cardId: "STU003",
      active: true,
      role: "student",
    },
  ];

  for (const s of students) {
    await db.collection("users").add(s);
  }
  console.log("✓ Students seeded");

  // Seed Sessions
  const sessions = [
    {
      faculty: "Prof. Santos",
      room: "305",
      status: "Active",
      started: "09:00 AM",
      ended: "",
      attendance: 24,
    },
    {
      faculty: "Prof. Cruz",
      room: "302",
      status: "Ended",
      started: "08:00 AM",
      ended: "09:00 AM",
      attendance: 32,
    },
    {
      faculty: "Prof. Reyes",
      room: "401",
      status: "Active",
      started: "09:30 AM",
      ended: "",
      attendance: 18,
    },
  ];

  for (const session of sessions) {
    await db.collection("sessions").add(session);
  }
  console.log("✓ Sessions seeded");

  console.log("\n✅ All data seeded successfully!");
  process.exit(0);
}

seedData().catch((error) => {
  console.error("Error seeding data:", error);
  process.exit(1);
});
