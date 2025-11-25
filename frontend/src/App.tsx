import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./pages/Login";
import DashboardNew from "./pages/DashboardNew";
import Faculty from "./pages/Faculty";
import Students from "./pages/Students";
import Subjects from "./pages/Subjects";
import Sessions from "./pages/Sessions_New";
import DoorControlEnhanced from "./pages/DoorControlEnhanced";
import Security from "./pages/Security";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Attendance from "./pages/Attendance";

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<DashboardNew />} />
        <Route path="/faculty" element={<Faculty />} />
        <Route path="/students" element={<Students />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/door-control" element={<DoorControlEnhanced />} />
        <Route path="/security" element={<Security />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
