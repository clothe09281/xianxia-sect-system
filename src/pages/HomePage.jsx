import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import bg from "../assets/bg-marble.jpg";

export default function HomePage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "#fff",
        position: "relative",
      }}
    >
      {/* 遮罩 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
        }}
      />

      {/* 內容區 */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: "all 1.2s ease",
        }}
      >

      <h1 style={{ fontSize: 100,
            fontWeight: 800,
            background: "linear-gradient(180deg,#FFD700,#C8A951)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: 4,
            marginBottom: 10, }}>宗門修仙名錄</h1>
      <p style={{ opacity: 0.85, marginBottom: 40 }}>
        RPG 化班級經營系統
      </p>

      <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
        <button
          className="rpg-btn"
          onClick={() => navigate("/login")}
        >
          🧑‍🏫 我是師尊
        </button>

        <button
          className="rpg-btn"
          onClick={() => navigate("/student-login")}
        >
          🧑‍🎓 我是弟子
        </button>
      </div>
    </div>
    </div>
  );
}