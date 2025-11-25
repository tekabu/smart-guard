import { useState } from 'react';

interface EnrollmentScannerProps {
  type: 'rfid' | 'fingerprint';
  mode: 'faculty' | 'student';
  value: string;
  isScanning: boolean;
  onStartScan: () => void;
  onValueChange?: (value: string) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
}

/**
 * Reusable component for RFID and Fingerprint enrollment
 * Shows scan button, loading state, and manual input fallback
 */
export default function EnrollmentScanner({
  type,
  mode,
  value,
  isScanning,
  onStartScan,
  onValueChange,
  label,
  placeholder,
  disabled = false,
}: EnrollmentScannerProps) {
  const [manualEntry, setManualEntry] = useState(false);

  const icon = type === 'rfid' ? '📡' : '👆';
  const scanButtonText = type === 'rfid' ? 'Scan RFID' : 'Enroll Fingerprint';
  const scanningText = type === 'rfid' ? 'Scanning RFID...' : 'Enrolling Fingerprint...';

  const handleManualToggle = () => {
    setManualEntry(!manualEntry);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onValueChange) {
      onValueChange(e.target.value);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
      </label>
      
      <div className="flex gap-2">
        {/* Input Field */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            disabled={!manualEntry || isScanning || disabled}
            className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none transition-all ${
              value
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 focus:border-indigo-500'
            } ${!manualEntry || isScanning || disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder={placeholder}
          />
          
          {/* Success Indicator */}
          {value && !isScanning && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className="text-green-600 text-xl">✓</span>
            </div>
          )}

          {/* Scanning Animation */}
          {isScanning && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            </div>
          )}
        </div>

        {/* Scan Button */}
        <button
          type="button"
          onClick={onStartScan}
          disabled={isScanning || disabled}
          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
            isScanning
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : value
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-indigo-500 text-white hover:bg-indigo-600 hover:shadow-lg'
          }`}
        >
          <span className="text-lg">{icon}</span>
          <span className="hidden sm:inline">
            {isScanning ? scanningText : scanButtonText}
          </span>
        </button>
      </div>

      {/* Manual Entry Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleManualToggle}
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          {manualEntry ? '🔒 Lock field' : '✏️ Enter manually'}
        </button>
        
        {isScanning && (
          <span className="text-xs text-gray-600 animate-pulse">
            ⏳ Waiting for hardware response...
          </span>
        )}
      </div>

      {/* Scanning Status Card */}
      {isScanning && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {type === 'rfid' ? '📡 Scanning RFID Card...' : '👆 Enrolling Fingerprint...'}
              </p>
              <p className="text-xs text-blue-600">
                {type === 'rfid' 
                  ? 'Please tap your RFID card on the reader'
                  : 'Please place your finger on the sensor (3 times)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Card */}
      {value && !isScanning && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-800">
                {type === 'rfid' ? 'RFID Scanned Successfully!' : 'Fingerprint Enrolled Successfully!'}
              </p>
              <p className="text-xs text-green-600 font-mono">
                {type === 'rfid' ? `UID: ${value}` : `Template ID: ${value}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
