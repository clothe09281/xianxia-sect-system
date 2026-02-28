import { Routes, Route } from "react-router-dom";
import { DEMO_MODE } from "./demo/demoMode";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import StudentLoginPage from "./pages/StudentLoginPage";
import StudentPage from "./pages/StudentPage";
import DashboardPage from "./pages/DashboardPage";

// ✅ Demo 專用頁（下面 Step 3 會建立）
import DemoHome from "./demo/DemoHome";
import DemoDashboard from "./demo/DemoDashboard";
import DemoStudent from "./demo/DemoStudent";

export default function App() {
  if (DEMO_MODE) {
    // ✅ Demo 模式：完全不需要登入、完全不碰 Firebase
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DemoHome />} />
          <Route path="/dashboard" element={<DemoDashboard />} />
          <Route path="/student" element={<DemoStudent />} />

          {/* 任何其他路徑都導回 Demo 首頁 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
  
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/student-login" element={<StudentLoginPage />} />
      <Route path="/student" element={<StudentPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
