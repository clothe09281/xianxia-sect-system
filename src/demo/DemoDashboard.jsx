import { useState } from "react";
import { demoClassCode, demoStudents } from "./DemoData";

export default function DemoDashboard() {
  const [students, setStudents] = useState(() => demoStudents.map((s) => ({ ...s })));

  function fakeAddXP(id, v) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, xp: s.xp + v, cp: s.cp + v } : s))
    );
  }

  return (
    <div style={{ width: "min(1400px, 96vw)", margin: "40px auto", fontFamily: "sans-serif", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>宗門名錄（老師模式 DEMO）</h2>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            班級代碼：<b>{demoClassCode}</b>　<span style={{ marginLeft: 8, opacity: 0.85 }}>🧪 不寫入後台</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="rpg-btn">歷練</button>
          <button className="rpg-btn">戰力榜</button>
          <button className="rpg-btn">藏寶閣</button>
          <button className="rpg-btn">登出</button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th style={{ padding: 10, textAlign: "left" }}>弟子</th>
            <th>等級</th>
            <th>修為</th>
            <th>戰力</th>
            <th>操作（Demo）</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <td style={{ padding: 10, fontSize: 18, fontWeight: 800 }}>{s.name}</td>
              <td align="center">{s.level ?? 1}</td>
              <td align="center">{s.xp ?? 0}</td>
              <td align="center">{s.cp ?? 0}</td>
              <td align="center">
                <button className="rpg-btn sm" onClick={() => fakeAddXP(s.id, 10)}>✅ 答對</button>{" "}
                <button className="rpg-btn sm" onClick={() => fakeAddXP(s.id, -5)}>❌ 答錯</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}