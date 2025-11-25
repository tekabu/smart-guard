import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ref, onValue, off, set, remove } from "firebase/database";
import { toast } from "react-toastify";
import mqtt, { type MqttClient } from "mqtt";
// Assume other imports (auth, getRealtimeDb, Sidebar, etc.) are defined outside this file
// Note: We need React for ChangeEvent typing
import React from 'react'; 
import { auth, getRealtimeDb } from "../firebase";
import Sidebar from "../components/Sidebar";
import EnrollmentScanner from "../components/EnrollmentScanner";
import ScheduleManager from "../components/ScheduleManager";
import { useEnrollmentListener } from "../hooks/useEnrollmentListener";

interface Faculty {
  id: string;
  name: string;
  department: string;
  cardId: string;
  fingerprintId: string;
  email: string;
  phone: string;
  clearance: boolean;
  active: boolean;
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

const MQTT_BROKER_URL = "mqtt://broker.emqx.io:1883";
const MQTT_REGISTER_CARD_TOPIC = "smartguard/register/card";
const MQTT_REGISTER_CARD_SUCCESS_TOPIC = "smartguard/register/card/success";
const MQTT_REGISTER_FINGERPRINT_TOPIC = "smartguard/register/fingerprint";
const MQTT_REGISTER_FINGERPRINT_SUCCESS_TOPIC = "smartguard/register/fingerprint/success";

const createUuid = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function Faculty() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<Faculty[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterClearance, setFilterClearance] = useState<"all" | "cleared" | "pending">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [adminName, setAdminName] = useState("Admin");
  
  const [newFaculty, setNewFaculty] = useState({
    name: "",
    department: "",
    cardId: "",
    fingerprintId: "",
    email: "",
    phone: "",
    clearance: false,
    active: true,
    schedule: {} as Record<string, string>,
  });

  const [isMqttCardRegistering, setIsMqttCardRegistering] = useState(false);
  const [isMqttFingerprintRegistering, setIsMqttFingerprintRegistering] = useState(false);
  const mqttCardClientRef = useRef<MqttClient | null>(null);
  const mqttFingerprintClientRef = useRef<MqttClient | null>(null);
  const pendingCardReferenceRef = useRef<string | null>(null);
  const pendingFingerprintReferenceRef = useRef<string | null>(null);

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
    const facultyRef = ref(db, "users/faculty");

    const unsubscribe = onValue(facultyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const facultyList: Faculty[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            name: value.name || "Unknown",
            department: value.department || "N/A",
            cardId: key, // Use the key (RFID UID) as cardId
            fingerprintId: value.fprints ? Object.keys(value.fprints)[0] : "N/A",
            email: value.email || "N/A",
            phone: value.phone || "N/A",
            clearance: value.clearance || false,
            active: value.active !== false,
            lastAccess: value.lastAccess || "Never",
            attendanceRate: value.attendanceRate || 0,
            accessCount: value.accessCount || 0,
          }));
        setFaculty(facultyList);
        setFilteredFaculty(facultyList);
      } else {
        setFaculty([]);
        setFilteredFaculty([]);
      }
    });

    return () => off(facultyRef, "value", unsubscribe);
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
    return () => {
      [mqttCardClientRef, mqttFingerprintClientRef].forEach((clientRef) => {
        const client = clientRef.current;
        if (client) {
          client.end(true);
          clientRef.current = null;
        }
      });
      pendingCardReferenceRef.current = null;
      pendingFingerprintReferenceRef.current = null;
    };
  }, []);

  // Auto-fill RFID and Fingerprint from enrollment listener
  useEffect(() => {
    if (rfidUID && showAddModal) {
      setNewFaculty(prev => ({ ...prev, cardId: rfidUID }));
      toast.success(`✅ RFID Scanned: ${rfidUID}`);
    }
  }, [rfidUID, showAddModal]);

  useEffect(() => {
    if (fingerprintID && showAddModal) {
      setNewFaculty(prev => ({ ...prev, fingerprintId: fingerprintID }));
      toast.success(`✅ Fingerprint Enrolled: ${fingerprintID}`);
    }
  }, [fingerprintID, showAddModal]);

  useEffect(() => {
    let filtered = faculty;

    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
          f.department.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
          f.cardId.toLowerCase().startsWith(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((f) =>
        filterStatus === "active" ? f.active : !f.active
      );
    }

    if (filterClearance !== "all") {
      filtered = filtered.filter((f) =>
        filterClearance === "cleared" ? f.clearance : !f.clearance
      );
    }

    setFilteredFaculty(filtered);
  }, [searchTerm, filterStatus, filterClearance, faculty]);

  

  const handleAddFaculty = async () => {
    const db = getRealtimeDb();

    // 1. INPUT VALIDATION
    if (!newFaculty.name || !newFaculty.department || !newFaculty.cardId || !newFaculty.email || !newFaculty.phone) {
      toast.error("❌ Please fill in all required fields (Name, Dept, Card ID, Email, Phone).");
      return;
    }

    const cleanedPhone = newFaculty.phone.replace(/[\s-]/g, '');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newFaculty.email)) {
      toast.error("❌ Please enter a valid email address.");
      return;
    }

    // UPDATED: Relaxed Phone Regex to allow for various local/international formats
    const phoneRegex = /^\+?\d[\d\s-]{7,}\d$/; 
    if (!phoneRegex.test(cleanedPhone)) {
      toast.error("❌ Invalid phone number format. Must contain at least 8 digits.");
      return;
    }

    // CRITICAL FIX: Handle missing Fingerprint ID by providing a placeholder if enrollment was skipped.
    const finalFingerprintId = newFaculty.fingerprintId || 'FP_PENDING';
    
    // 2. DUPLICATION CHECK
    
    // Check for duplicate RFID in Faculty
    const existingRFID = faculty.find(f => f.cardId === newFaculty.cardId);
    if (existingRFID) {
      toast.error(`❌ RFID ${newFaculty.cardId} is already registered to Faculty: ${existingRFID.name}`);
      return;
    }

    // Check for duplicate Fingerprint in Faculty (only if a real fingerprint was provided)
    if (newFaculty.fingerprintId) {
        const existingFingerprint = faculty.find(f => f.fingerprintId === newFaculty.fingerprintId);
        if (existingFingerprint) {
          toast.error(`❌ Fingerprint ID ${newFaculty.fingerprintId} is already registered to Faculty: ${existingFingerprint.name}`);
          return;
        }
    }


    // Check for duplicate RFID/Fingerprint in Students database (Async check)
    try {
        const studentsRef = ref(db, "users/students");
        const studentsSnapshot = await new Promise<any>((resolve) => {
          onValue(studentsRef, (snapshot) => {
            resolve(snapshot.val());
          }, { onlyOnce: true });
        });

        if (studentsSnapshot) {
          const studentsList = Object.entries(studentsSnapshot);
          
          // Check RFID
          const studentWithRFID = studentsList.find(([key]) => key === newFaculty.cardId);
          if (studentWithRFID) {
            const studentData = studentWithRFID[1] as any;
            toast.error(`❌ RFID ${newFaculty.cardId} is already registered to Student: ${studentData.name}`);
            return;
          }

          // Check Fingerprint (only if a real FP was provided)
          if (newFaculty.fingerprintId) {
            const studentWithFingerprint = studentsList.find(([_, value]: [string, any]) => {
              return value.fprints && Object.keys(value.fprints).includes(newFaculty.fingerprintId);
            });
            if (studentWithFingerprint) {
              const studentData = studentWithFingerprint[1] as any;
              toast.error(`❌ Fingerprint ID ${newFaculty.fingerprintId} is already registered to Student: ${studentData.name}`);
              return;
            }
          }
        }
    } catch (error) {
        console.error("Error checking student database for duplicates:", error);
        // Continue operation even if student check fails due to database error
    }

    
    // 3. SAVE TO FIREBASE
    try {
      const rfidKey = newFaculty.cardId;
      const facultyRef = ref(db, `users/faculty/${rfidKey}`);

      // Create fingerprint object using the finalized ID
      const fprints: Record<string, boolean> = {};
      fprints[finalFingerprintId] = true;

      await set(facultyRef, {
        name: newFaculty.name,
        faculty_id: `FAC-${Date.now().toString().slice(-3)}`,
        department: newFaculty.department,
        email: newFaculty.email,
        phone: cleanedPhone, // Use cleaned phone number
        registered: true,
        fprints: fprints,
        schedule: newFaculty.schedule || {},
        clearance: newFaculty.clearance,
        active: newFaculty.active,
        role: "faculty",
        createdAt: new Date().toISOString(),
        lastAccess: "Never",
        attendanceRate: 0,
        accessCount: 0,
      });

      toast.success("✅ Faculty registered successfully! Card ID: " + rfidKey);
      
      await clearEnrollmentData();
      resetEnrollment();

      setShowAddModal(false);
      setNewFaculty({
        name: "",
        department: "",
        cardId: "",
        fingerprintId: "",
        email: "",
        phone: "",
        clearance: false,
        active: true,
        schedule: {},
      });
    } catch (error) {
      console.error("Error adding faculty:", error);
      toast.error("❌ Failed to register faculty. Please try again.");
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    const facultyToDelete = faculty.find(f => f.id === id);
    if (!facultyToDelete) return;

    if (confirm(`Are you sure you want to delete ${facultyToDelete.name}?\n\nThis will also delete their fingerprint from the sensor.`)) {
      try {
        const db = getRealtimeDb();
        
        // Get fingerprint IDs before deleting
        const facultyRef = ref(db, `users/faculty/${id}`);
        const facultySnapshot = await new Promise<any>((resolve) => {
          onValue(facultyRef, (snapshot) => {
            resolve(snapshot.val());
          }, { onlyOnce: true });
        });

        const fingerprintIds: string[] = [];
        if (facultySnapshot && facultySnapshot.fprints) {
          fingerprintIds.push(...Object.keys(facultySnapshot.fprints));
        }

        // Send delete command to hardware for each fingerprint
        if (fingerprintIds.length > 0) {
          for (const fpId of fingerprintIds) {
            const deleteCommandRef = ref(db, `/hardware/commands/delete_fingerprint`);
            await set(deleteCommandRef, {
              fingerprintId: fpId,
              userId: id,
              userName: facultyToDelete.name,
              userType: 'faculty',
              timestamp: Date.now(),
              status: 'pending'
            });
            
            // Log the deletion command
            await set(ref(db, `/smartguard/logs/system/${Date.now()}`), {
              action: 'DELETE_FINGERPRINT_COMMAND',
              fingerprintId: fpId,
              userId: id,
              userName: facultyToDelete.name,
              userType: 'faculty',
              timestamp: new Date().toISOString()
            });
          }
          
          toast.info(`🔄 Deleting ${fingerprintIds.length} fingerprint(s) from sensor...`);
        }

        // Delete from Firebase
        await remove(facultyRef);
        
        toast.success(`✅ Faculty deleted successfully${fingerprintIds.length > 0 ? ' (fingerprints will be removed from sensor)' : ''}`);
      } catch (error) {
        console.error("Error deleting faculty:", error);
        toast.error("❌ Failed to delete faculty");
      }
    }
  };

  const handleToggleClearance = async (id: string, currentStatus: boolean) => {
    try {
      const db = getRealtimeDb();
      const facultyRef = ref(db, `users/faculty/${id}/clearance`);
      await set(facultyRef, !currentStatus);
      toast.success(`✅ Clearance ${!currentStatus ? 'granted' : 'revoked'}`);
    } catch (error) {
      console.error("Error toggling clearance:", error);
      toast.error("❌ Failed to update clearance");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const db = getRealtimeDb();
      const facultyRef = ref(db, `users/faculty/${id}/active`);
      await set(facultyRef, !currentStatus);
      toast.success(`✅ Status updated to ${!currentStatus ? 'active' : 'inactive'}`);
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("❌ Failed to update status");
    }
  };

  const startMqttRegistration = ({
    requestTopic,
    responseTopic,
    responseKey,
    pendingRef,
    clientRef,
    setRegistering,
    onSuccess,
    waitingMessage,
    successMessage,
    alreadyMessage,
    subscribeErrorMessage,
    publishErrorMessage,
  }: {
    requestTopic: string;
    responseTopic: string;
    responseKey: "card_id" | "fingerprint_id";
    pendingRef: React.MutableRefObject<string | null>;
    clientRef: React.MutableRefObject<MqttClient | null>;
    setRegistering: React.Dispatch<React.SetStateAction<boolean>>;
    onSuccess: (value: string) => void;
    waitingMessage: string;
    successMessage: (value: string) => string;
    alreadyMessage: string;
    subscribeErrorMessage: string;
    publishErrorMessage: string;
  }) => {
    if (pendingRef.current) {
      toast.info(alreadyMessage);
      return;
    }

    const reference = createUuid();
    pendingRef.current = reference;
    setRegistering(true);

    const client = mqtt.connect(MQTT_BROKER_URL, {
      connectTimeout: 5000,
      keepalive: 30,
      reconnectPeriod: 0,
    });
    clientRef.current = client;

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      if (pendingRef.current === reference) {
        pendingRef.current = null;
      }
      setRegistering(false);
      client.removeAllListeners();
      client.end(true);
    };

    client.on("connect", () => {
      client.subscribe(responseTopic, { qos: 1 }, (err) => {
        if (err) {
          console.error("Failed to subscribe to MQTT success topic", err);
          cleanup();
          toast.error(subscribeErrorMessage);
          return;
        }
        client.publish(
          requestTopic,
          JSON.stringify({ reference }),
          { qos: 1 },
          (publishErr) => {
            if (publishErr) {
              console.error("Failed to publish MQTT registration request", publishErr);
              cleanup();
              toast.error(publishErrorMessage);
              return;
            }
            toast.info(waitingMessage);
          }
        );
      });
    });

    client.on("message", (topic, payload) => {
      if (topic !== responseTopic) return;
      try {
        const parsed = JSON.parse(payload.toString());
        const value = parsed?.[responseKey];
        if (
          parsed?.reference === reference &&
          value &&
          typeof value === "string"
        ) {
          onSuccess(value);
          toast.success(successMessage(value));
          cleanup();
        }
      } catch (error) {
        console.error("Failed to parse MQTT payload", error);
      }
    });

    client.on("error", (error) => {
      console.error("MQTT registration error", error);
      cleanup();
      toast.error("❌ MQTT connection error. Please try again.");
    });
  };

  const startMqttCardRegistration = () => {
    startMqttRegistration({
      requestTopic: MQTT_REGISTER_CARD_TOPIC,
      responseTopic: MQTT_REGISTER_CARD_SUCCESS_TOPIC,
      responseKey: "card_id",
      pendingRef: pendingCardReferenceRef,
      clientRef: mqttCardClientRef,
      setRegistering: setIsMqttCardRegistering,
      onSuccess: (cardId) => setNewFaculty((prev) => ({ ...prev, cardId })),
      waitingMessage: '🔄 Waiting for RFID card data via MQTT...',
      successMessage: (cardId) => `✅ RFID ${cardId} received via MQTT.`,
      alreadyMessage: "✅ RFID registration already in progress. Please wait.",
      subscribeErrorMessage: "❌ Failed to subscribe to RFID confirmation topic.",
      publishErrorMessage: "❌ Failed to publish RFID registration request.",
    });
  };

  const startMqttFingerprintRegistration = () => {
    startMqttRegistration({
      requestTopic: MQTT_REGISTER_FINGERPRINT_TOPIC,
      responseTopic: MQTT_REGISTER_FINGERPRINT_SUCCESS_TOPIC,
      responseKey: "fingerprint_id",
      pendingRef: pendingFingerprintReferenceRef,
      clientRef: mqttFingerprintClientRef,
      setRegistering: setIsMqttFingerprintRegistering,
      onSuccess: (fingerprintId) => setNewFaculty((prev) => ({ ...prev, fingerprintId })),
      waitingMessage: '🔄 Waiting for fingerprint data via MQTT...',
      successMessage: (fingerprintId) => `✅ Fingerprint ${fingerprintId} received via MQTT.`,
      alreadyMessage: "✅ Fingerprint registration already in progress. Please wait.",
      subscribeErrorMessage: "❌ Failed to subscribe to fingerprint confirmation topic.",
      publishErrorMessage: "❌ Failed to publish fingerprint registration request.",
    });
  };

  const handleStartRFIDScan = async () => {
    // --- DEBUG LOG ADDED HERE ---
    console.log("--- DEBUG: Attempting to start RFID scan. Check Firebase path /hardware/enrollment/rfid_scan for 'true' ---");
    try {
      await startRFIDScan('faculty');
      startMqttCardRegistration();
      toast.info("📡 Waiting for RFID scan... Please tap your card");
    } catch (error) {
      console.error("Error starting RFID scan:", error);
      toast.error("❌ Failed to start RFID scan");
    }
  };

  const handleStartFingerprintEnroll = async () => {
    try {
      await startFingerprintEnroll('faculty');
      startMqttFingerprintRegistration();
      toast.info("👆 Waiting for fingerprint... Please place your finger on the sensor");
    } catch (error) {
      console.error("Error starting fingerprint enrollment:", error);
      toast.error("❌ Failed to start fingerprint enrollment");
    }
  };

  const handleModalClose = async () => {
    try {
      // Clear enrollment data from Firebase
      await clearEnrollmentData();
      // Reset local enrollment state
      resetEnrollment();
      // Close modal
      setShowAddModal(false);
      // Reset form
      setNewFaculty({
        name: "",
        department: "",
        cardId: "",
        fingerprintId: "",
        email: "",
        phone: "",
        clearance: false,
        active: true,
        schedule: {},
      });
    } catch (error) {
      console.error("Error closing modal:", error);
      setShowAddModal(false);
    }
  };

  const handleViewHistory = (facultyMember: Faculty) => {
    setSelectedFaculty(facultyMember);
    setShowHistoryModal(true);
  };

  const getFacultyLogs = () => {
    if (!selectedFaculty) return [];
    return accessLogs.filter((log) => log.user === selectedFaculty.name);
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
    total: faculty.length,
    active: faculty.filter((f) => f.active).length,
    cleared: faculty.filter((f) => f.clearance).length,
    pending: faculty.filter((f) => !f.clearance).length,
  };

  
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F9FC' }}>
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200/50 backdrop-blur-sm">
        <div className="px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* University Logo Placeholder */}
            <div className="w-12 h-12 bg-gradient-to-br from-[#3A57E8] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
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
                <div className="w-8 h-8 bg-gradient-to-br from-[#3A57E8] to-[#A78BFA] rounded-lg flex items-center justify-center">
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
          <Sidebar activePage="/faculty" />
        </div>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-linear-to-br from-[#3A57E8] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  Faculty Management
                </h2>
                <p className="text-gray-500 mt-2">
                  Manage faculty members, clearance, and access permissions
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-[#3A57E8] text-white rounded-xl hover:bg-[#2D4BD6] transition-all duration-200 font-medium shadow-lg shadow-[#3A57E8]/25 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Faculty
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Faculty" value={stats.total} icon="Users" color="#3A57E8" bgColor="#EEF2FF" />
            <StatCard title="Active" value={stats.active} icon="CheckCircle" color="#10B981" bgColor="#ECFDF5" />
            <StatCard title="Cleared" value={stats.cleared} icon="Shield" color="#A78BFA" bgColor="#F3E8FF" />
            <StatCard title="Pending Clearance" value={stats.pending} icon="Clock" color="#F59E0B" bgColor="#FFFBEB" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6 mb-8">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search faculty members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200 bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <select
                value={filterClearance}
                onChange={(e) => setFilterClearance(e.target.value as any)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200 bg-white"
              >
                <option value="all">All Clearance</option>
                <option value="cleared">Cleared</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Faculty Member
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Card ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Fingerprint
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Clearance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Last Access
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFaculty.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">No faculty members found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or add a new faculty member</p>
                      </td>
                    </tr>
                  ) : (
                    filteredFaculty.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-linear-to-br from-[#3A57E8] to-[#A78BFA] rounded-lg flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {f.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{f.name}</p>
                              <p className="text-sm text-gray-500">{f.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{f.department}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#3A57E8]/10 text-[#3A57E8]">
                            {f.cardId}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#A78BFA]/10 text-[#A78BFA]">
                            {f.fingerprintId}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleClearance(f.id, f.clearance)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200 ${
                              f.clearance
                                ? "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20"
                                : "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20"
                            }`}
                          >
                            {f.clearance ? "Cleared" : "Pending"}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleActive(f.id, f.active)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200 ${
                              f.active
                                ? "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20"
                                : "bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20"
                            }`}
                          >
                            {f.active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{f.lastAccess}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewHistory(f)}
                              className="p-2 text-gray-400 hover:text-[#3A57E8] hover:bg-[#3A57E8]/10 rounded-lg transition-all duration-200"
                              title="View History"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteFaculty(f.id)}
                              className="p-2 text-gray-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-all duration-200"
                              title="Delete Faculty"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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
            <div className="bg-linear-to-r from-[#3A57E8] to-[#A78BFA] text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Add New Faculty Member</h2>
              <p className="text-sm opacity-90 mt-1">All fields are required</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200"
                    placeholder="Prof. Juan Dela Cruz"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
                  <select
                    value={newFaculty.department}
                    onChange={(e) => setNewFaculty({ ...newFaculty, department: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200 bg-white"
                    required
                  >
                    <option value="">Select Department</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>
              </div>

              {/* RFID Enrollment Scanner */}
              <EnrollmentScanner
                type="rfid"
                mode="faculty"
                value={newFaculty.cardId}
                isScanning={isRFIDScanning || isMqttCardRegistering}
                onStartScan={handleStartRFIDScan}
                onValueChange={(value) => setNewFaculty({ ...newFaculty, cardId: value })}
                label="RFID Card ID"
                placeholder="Scan RFID or enter manually (e.g., F2FB8A41)"
              />

              {/* Fingerprint Enrollment Scanner */}
              <EnrollmentScanner
                type="fingerprint"
                mode="faculty"
                value={newFaculty.fingerprintId}
                isScanning={isFingerprintScanning || isMqttFingerprintRegistering}
                onStartScan={handleStartFingerprintEnroll}
                onValueChange={(value) => setNewFaculty({ ...newFaculty, fingerprintId: value })}
                label="Fingerprint Template ID"
                placeholder="Enroll fingerprint or enter manually (e.g., 12)"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={newFaculty.email}
                    onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200"
                    placeholder="faculty@cvsu.edu.ph"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={newFaculty.phone}
                    onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#3A57E8] focus:outline-none focus:ring-2 focus:ring-[#3A57E8]/20 transition-all duration-200"
                    placeholder="+63 912 345 6789"
                    required
                  />
                </div>
              </div>

              {/* Schedule Manager */}
              <ScheduleManager
                schedule={newFaculty.schedule}
                onChange={(schedule) => setNewFaculty({ ...newFaculty, schedule })}
              />

              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFaculty.clearance}
                    // FIX 1: Ensure onChange handler is clean and typed
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setNewFaculty({ ...newFaculty, clearance: e.target.checked })
                    }
                    className="w-5 h-5 text-[#3A57E8] rounded focus:ring-[#3A57E8] border-gray-300"
                  />
                  <span className="text-sm font-semibold text-gray-700">Grant Clearance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFaculty.active}
                    // FIX 2: Ensure onChange handler is clean and typed
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setNewFaculty({ ...newFaculty, active: e.target.checked })
                    }
                    className="w-5 h-5 text-[#3A57E8] rounded focus:ring-[#3A57E8] border-gray-300"
                  />
                  <span className="text-sm font-semibold text-gray-700">Active Status</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={handleModalClose}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFaculty}
                className="px-6 py-2 bg-[#3A57E8] text-white rounded-xl hover:bg-[#2D4BD6] transition-all font-medium shadow-lg shadow-[#3A57E8]/25"
              >
                Add Faculty
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistoryModal && selectedFaculty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-linear-to-r from-[#3A57E8] to-[#A78BFA] text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Access History - {selectedFaculty.name}</h2>
              <p className="text-sm opacity-90 mt-1">{selectedFaculty.department}</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#EEF2FF] rounded-xl p-4 border-2 border-[#3A57E8]/20">
                  <p className="text-sm text-[#3A57E8] font-semibold">Total Access</p>
                  <p className="text-3xl font-bold text-[#3A57E8]">{selectedFaculty.accessCount}</p>
                </div>
                <div className="bg-[#ECFDF5] rounded-xl p-4 border-2 border-[#10B981]/20">
                  <p className="text-sm text-[#10B981] font-semibold">Attendance Rate</p>
                  <p className="text-3xl font-bold text-[#10B981]">{selectedFaculty.attendanceRate}%</p>
                </div>
                <div className="bg-[#F3E8FF] rounded-xl p-4 border-2 border-[#A78BFA]/20">
                  <p className="text-sm text-[#A78BFA] font-semibold">Last Access</p>
                  <p className="text-lg font-bold text-[#A78BFA]">{selectedFaculty.lastAccess}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Result
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Door
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getFacultyLogs().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No access history found
                        </td>
                      </tr>
                    ) : (
                      getFacultyLogs().map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#3A57E8]/10 text-[#3A57E8]">
                              {log.method}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                log.result === "Granted"
                                  ? "bg-[#10B981]/10 text-[#10B981]"
                                  : "bg-[#EF4444]/10 text-[#EF4444]"
                              }`}
                            >
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
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
              >
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
  const getIcon = (iconName: string) => {
    const iconClass = "w-6 h-6";
    switch (iconName) {
      case "Users":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case "CheckCircle":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "Shield":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case "Clock":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={10} />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        );
      default:
        return <span className="text-2xl">📊</span>;
    }
  };

  return (
    <div
      className="rounded-2xl p-6 border border-gray-200/50"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
          style={{ backgroundColor: `${color}20` }}
        >
          <div style={{ color: color }}>
            {getIcon(icon)}
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-bold"
            style={{ color: color }}
          >
            {value}
          </div>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="w-full bg-gray-200/50 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min((value / 100) * 100, 85)}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
    </div>
  );
}
