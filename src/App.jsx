import { Routes, Route, Navigate } from "react-router-dom";
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/student-login" element={<StudentLoginPage />} />
  <Route path="/student" element={<StudentPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
</Routes>

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
