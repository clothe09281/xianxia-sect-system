import { Link } from "react-router-dom";

export default function DemoHome() {
  return (
    <div style={{ maxWidth: 960, margin: "60px auto", color: "#fff", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>宗門修仙名錄（DEMO）</h1>
      <div style={{ opacity: 0.85, marginBottom: 18 }}>
        🧪 Demo 模式：不需登入、不會寫入任何後台資料（純展示 UI / 流程）
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link className="rpg-btn" to="/dashboard">進入老師頁 Demo</Link>
        <Link className="rpg-btn" to="/student">進入學生頁 Demo</Link>
      </div>

      <div style={{ height: 24 }} />
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        小提醒：你可以把這個 Demo 網址丟給朋友，他們直接看得到目前進度。
      </div>
    </div>
  );
}