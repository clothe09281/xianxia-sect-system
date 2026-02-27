import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentLoginPage from "./pages/StudentLoginPage";
import StudentPage from "./pages/StudentPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/student-login" element={<StudentLoginPage />} />
      <Route path="/student" element={<StudentPage />} />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
