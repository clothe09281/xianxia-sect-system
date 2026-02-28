import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#1a1a1a,#0f0f0f)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 36 }}>宗門修仙名錄</h1>
      <p style={{ opacity: 0.8 }}>
        RPG 化班級經營系統
      </p>

      <div style={{ display: "flex", gap: 20 }}>
        <button
          className="rpg-btn"
          onClick={() => navigate("/login")}
        >
          🧑‍🏫 我是老師
        </button>

        <button
          className="rpg-btn"
          onClick={() => navigate("/student-login")}
        >
          🧑‍🎓 我是弟子
        </button>
      </div>
    </div>
  );
}