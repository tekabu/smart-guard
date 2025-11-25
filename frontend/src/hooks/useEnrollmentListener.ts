import { useEffect, useState } from 'react';
import { ref, onValue, off, set } from 'firebase/database';
import { getRealtimeDb } from '../firebase';

interface EnrollmentData {
  rfid: string;
  fingerprint: string;
  mode: 'faculty' | 'student' | 'idle';
  status: 'scanning' | 'success' | 'error' | 'idle';
  timestamp: number;
}

interface UseEnrollmentListenerReturn {
  rfidUID: string;
  fingerprintID: string;
  enrollmentMode: string;
  enrollmentStatus: string;
  isRFIDScanning: boolean;
  isFingerprintScanning: boolean;
  startRFIDScan: (mode: 'faculty' | 'student') => Promise<void>;
  startFingerprintEnroll: (mode: 'faculty' | 'student') => Promise<void>;
  clearEnrollmentData: () => Promise<void>;
  resetEnrollment: () => void;
  stopScanning: () => Promise<void>;
}

/**
 * Custom hook to listen to Firebase enrollment data in real-time
 * Monitors /enrollment/temp/ for RFID and Fingerprint updates from hardware
 */
export const useEnrollmentListener = (): UseEnrollmentListenerReturn => {
  const [rfidUID, setRfidUID] = useState<string>('');
  const [fingerprintID, setFingerprintID] = useState<string>('');
  const [enrollmentMode, setEnrollmentMode] = useState<string>('idle');
  const [enrollmentStatus, setEnrollmentStatus] = useState<string>('idle');
  const [isRFIDScanning, setIsRFIDScanning] = useState<boolean>(false);
  const [isFingerprintScanning, setIsFingerprintScanning] = useState<boolean>(false);

  useEffect(() => {
    const db = getRealtimeDb();
    const enrollmentRef = ref(db, 'enrollment/temp');

    // Listen for real-time updates from hardware
    const unsubscribe = onValue(enrollmentRef, (snapshot) => {
      const data = snapshot.val() as EnrollmentData | null;
      
      console.log('📡 Firebase enrollment data received:', data);
      
      if (data) {
        // Update RFID if available and stop RFID scanning
        if (data.rfid && data.rfid !== rfidUID && data.rfid !== '') {
          console.log('✅ RFID detected:', data.rfid);
          setRfidUID(data.rfid);
          setIsRFIDScanning(false); // Stop RFID loading immediately
        }

        // Update Fingerprint if available and stop fingerprint scanning
        // Check both 'fingerprint' and 'fingerprintId' fields for compatibility
        const fpValue = data.fingerprint || (data as any).fingerprintId || (data as any).fingerprint_id || (data as any).fprint;
        
        console.log('🔍 Checking fingerprint value:', {
          fingerprint: data.fingerprint,
          fingerprintId: (data as any).fingerprintId,
          fingerprint_id: (data as any).fingerprint_id,
          fprint: (data as any).fprint,
          fpValue: fpValue,
          currentFingerprintID: fingerprintID
        });
        
        if (fpValue && fpValue !== fingerprintID && fpValue !== '' && fpValue !== '0' && fpValue !== 'null') {
          console.log('✅ Fingerprint detected:', fpValue);
          setFingerprintID(String(fpValue));
          setIsFingerprintScanning(false); // Stop fingerprint loading immediately
          
          // Auto-stop scanning to prevent loop
          stopScanning();
        }

        // Update mode and status
        if (data.mode) {
          setEnrollmentMode(data.mode);
        }

        if (data.status) {
          setEnrollmentStatus(data.status);
          console.log('📊 Status updated:', data.status);
        }
      }
    });

    // Cleanup listener on unmount
    return () => {
      off(enrollmentRef, 'value', unsubscribe);
    };
  }, [rfidUID, fingerprintID]);

  /**
   * Start RFID scanning mode
   * Sets Firebase enrollment mode to trigger hardware scan
   */
  const startRFIDScan = async (mode: 'faculty' | 'student') => {
    const db = getRealtimeDb();
    const enrollmentRef = ref(db, 'enrollment/temp');

    try {
      setIsRFIDScanning(true);
      await set(enrollmentRef, {
        mode,
        status: 'scanning_rfid',
        rfid: '',
        fingerprint: fingerprintID || '',
        timestamp: Date.now(),
      });
      console.log(`🔍 RFID scan started for ${mode}`);
    } catch (error) {
      console.error('❌ Error starting RFID scan:', error);
      setIsRFIDScanning(false);
      throw error;
    }
  };

  /**
   * Start fingerprint enrollment mode
   * Sets Firebase enrollment mode to trigger hardware enrollment
   */
  const startFingerprintEnroll = async (mode: 'faculty' | 'student') => {
    const db = getRealtimeDb();
    const enrollmentRef = ref(db, 'enrollment/temp');

    try {
      setIsFingerprintScanning(true);
      await set(enrollmentRef, {
        mode,
        status: 'scanning_fingerprint_back', // Use back door fingerprint for testing
        rfid: rfidUID || '',
        fingerprint: '',
        timestamp: Date.now(),
      });
      console.log(`👆 Fingerprint enrollment started for ${mode} (using back door sensor)`);
    } catch (error) {
      console.error('❌ Error starting fingerprint enrollment:', error);
      setIsFingerprintScanning(false);
      throw error;
    }
  };

  /**
   * Clear enrollment data from Firebase
   */
  const clearEnrollmentData = async () => {
    const db = getRealtimeDb();
    const enrollmentRef = ref(db, 'enrollment/temp');

    try {
      await set(enrollmentRef, {
        mode: 'idle',
        status: 'idle',
        rfid: '',
        fingerprint: '',
        timestamp: Date.now(),
      });
      console.log('🧹 Enrollment data cleared');
    } catch (error) {
      console.error('❌ Error clearing enrollment data:', error);
      throw error;
    }
  };

  /**
   * Stop scanning and reset status to idle
   */
  const stopScanning = async () => {
    const db = getRealtimeDb();
    const statusRef = ref(db, 'enrollment/temp/status');

    try {
      await set(statusRef, 'idle');
      console.log('🛑 Scanning stopped, status set to idle');
    } catch (error) {
      console.error('❌ Error stopping scan:', error);
    }
  };

  /**
   * Reset local state
   */
  const resetEnrollment = () => {
    setRfidUID('');
    setFingerprintID('');
    setEnrollmentMode('idle');
    setEnrollmentStatus('idle');
    setIsRFIDScanning(false);
    setIsFingerprintScanning(false);
  };

  return {
    rfidUID,
    fingerprintID,
    enrollmentMode,
    enrollmentStatus,
    isRFIDScanning,
    isFingerprintScanning,
    startRFIDScan,
    startFingerprintEnroll,
    clearEnrollmentData,
    resetEnrollment,
    stopScanning,
  };
};
