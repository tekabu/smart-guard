import { useState, useEffect } from "react";
import { api, ApiError } from "../utils/api";

interface OTPGeneratorProps {
  sessionId: string;
  sessionName: string;
  onClose: () => void;
}

export default function OTPGenerator({ sessionId, sessionName, onClose }: OTPGeneratorProps) {
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [expiryTime, setExpiryTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const generateOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await api.generateOTP(sessionId);
      setOtp(response.otp);
      // OTP expires in 30 minutes
      const expiry = Date.now() + (30 * 60 * 1000);
      setExpiryTime(expiry);
      setTimeRemaining(30 * 60);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to generate OTP';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateOTP();
  }, [sessionId]);

  useEffect(() => {
    if (expiryTime === 0) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(otp);
    alert("✅ OTP copied to clipboard!");
  };

  const handleRefresh = () => {
    if (confirm("Generate a new OTP? The current OTP will be invalidated.")) {
      generateOTP();
    }
  };

  const getExpiryColor = () => {
    if (timeRemaining > 600) return "text-green-600"; // > 10 min
    if (timeRemaining > 300) return "text-orange-600"; // > 5 min
    return "text-red-600"; // < 5 min
  };

  const getProgressPercentage = () => {
    return (timeRemaining / (30 * 60)) * 100;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">🔐 Session OTP</h3>
              <p className="text-sm opacity-90 mt-1">{sessionName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
              <p className="font-bold">❌ Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Generating OTP...</p>
            </div>
          ) : otp ? (
            <>
              {/* OTP Display */}
              <div className="mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border-2 border-blue-200 text-center">
                  <p className="text-sm text-gray-600 mb-2 font-medium">One-Time PIN</p>
                  <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 tracking-wider mb-4 font-mono">
                    {otp.split('').map((digit, i) => (
                      <span key={i} className="inline-block mx-1 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                        {digit}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-all font-medium shadow-md"
                  >
                    📋 Copy to Clipboard
                  </button>
                </div>
              </div>

              {/* Expiry Timer */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-700">Time Remaining</span>
                  <span className={`text-2xl font-bold font-mono ${getExpiryColor()}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${
                      timeRemaining > 600 ? "bg-green-500" :
                      timeRemaining > 300 ? "bg-orange-500" :
                      "bg-red-500"
                    }`}
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
                {timeRemaining === 0 && (
                  <p className="text-red-600 text-sm mt-2 font-bold">⚠️ OTP has expired. Please generate a new one.</p>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="text-xl mr-2">📱</span>
                  How to Use This OTP
                </h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">1.</span>
                    <span>Display this OTP on the TFT screen at the classroom entrance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">2.</span>
                    <span>Students can enter this PIN on the keypad to mark attendance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">3.</span>
                    <span>OTP is valid for 30 minutes from generation</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">4.</span>
                    <span>Each student can use the OTP only once per session</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-bold mr-2 text-blue-600">5.</span>
                    <span>Generate a new OTP if the current one expires</span>
                  </li>
                </ol>
              </div>

              {/* TFT Screen Simulation */}
              <div className="bg-black rounded-xl p-6 mb-6 border-4 border-gray-800 shadow-2xl">
                <div className="bg-blue-900 text-center py-2 rounded-t-lg mb-4">
                  <p className="text-blue-300 text-xs font-mono">SmartGuard TFT Display</p>
                </div>
                <div className="bg-gradient-to-b from-blue-400 to-blue-600 rounded-lg p-6 text-center">
                  <p className="text-white text-sm mb-2 font-bold">SESSION PIN</p>
                  <p className="text-white text-5xl font-bold font-mono tracking-widest mb-2">{otp}</p>
                  <p className="text-blue-100 text-xs">{sessionName}</p>
                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <p className="text-white text-xs">Expires in: {formatTime(timeRemaining)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-bold shadow-lg disabled:opacity-50"
                >
                  🔄 Generate New OTP
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all font-bold"
                >
                  Close
                </button>
              </div>

              {/* Security Notice */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-xs text-yellow-800">
                  <span className="font-bold">🔒 Security Notice:</span> Do not share this OTP outside the classroom. 
                  Each OTP is session-specific and expires automatically.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
