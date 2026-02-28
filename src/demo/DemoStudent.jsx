import { useMemo, useState } from "react";
import { demoAchievements, demoClassCode, demoStudents } from "./DemoData";

function Modal({ open, title, onClose, children, width = 860 }) {
  if (!open) return null;
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: `min(96vw, ${width}px)`,
          maxHeight: "88vh",
          overflow: "auto",
          background: "rgba(20,20,20,0.92)",
          color: "#fff",
          border: "1px solid rgba(218,185,120,0.35)",
          borderRadius: 10,
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button className="rpg-btn" onClick={onClose}>關閉</button>
        </div>
        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}

function HPBar({ now, max }) {
  const safeMax = Math.max(1, Number(max ?? 100));
  const safeNow = Math.max(0, Math.min(safeMax, Number(now ?? safeMax)));
  const pct = Math.max(0, Math.min(100, (safeNow / safeMax) * 100));
  return (
    <div style={{ width: 420 }}>
      <div style={{ height: 14, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(218,185,120,0.6)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(180deg, #ff4d4d, #ffa94d)" }} />
      </div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>HP：{safeNow} / {safeMax}</div>
    </div>
  );
}

export default function DemoStudent() {
  const [openAch, setOpenAch] = useState(false);
  const [me, setMe] = useState(() => ({ ...demoStudents[0] })); // 以第一位當 Demo 學生

  const achievementsSorted = useMemo(() => {
    const arr = [...demoAchievements];
    arr.sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999));
    return arr;
  }, []);

  function toggleEquip(title) {
    if (!title) return;
    const canEquip = (me.unlockedTitles || []).includes(title);
    if (!canEquip) return alert("Demo：此稱號尚未解鎖（可改假資料演示）");
    setMe((prev) => ({ ...prev, activeTitle: prev.activeTitle === title ? "" : title }));
  }

  return (
    <div style={{ width: "min(1200px, 96vw)", margin: "40px auto", fontFamily: "sans-serif", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>宗門弟子（DEMO）</h2>

        {/* ✅ 你想放到紅框的位置的按鈕列，這裡先示範在右上 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="rpg-btn" onClick={() => setOpenAch(true)}>🏅 成就稱號</button>
          <button className="rpg-btn">藏寶閣</button>
          <button className="rpg-btn">時裝</button>
          <button className="rpg-btn">登出</button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ padding: 18, border: "1px solid rgba(218,185,120,0.35)", borderRadius: 12, background: "rgba(20,20,20,0.85)" }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>
          {me.name}
          {me.activeTitle ? <span style={{ marginLeft: 10, fontSize: 14, color: "#ffd700" }}>{me.activeTitle}</span> : null}
          <span style={{ marginLeft: 12, fontSize: 14, opacity: 0.85 }}>Lv {me.level}</span>
        </div>

        <div style={{ height: 10 }} />
        <HPBar now={me.hpNow} max={me.hpMax} />

        <div style={{ height: 12 }} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", opacity: 0.9, fontSize: 20, fontWeight: 800 }}>
          <div>修為：{me.xp}</div>
          <div>戰力：{me.cp}</div>
          <div>妖丹：{me.coin}</div>
        </div>

        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>班級代碼：{demoClassCode}　|　弟子ID：{me.id}</div>
      </div>

      {/* ✅ 成就稱號彈窗（Demo） */}
      <Modal open={openAch} title={`🏅 成就稱號（目前：${me.activeTitle || "未配戴"}）`} onClose={() => setOpenAch(false)} width={980}>
        <div style={{ opacity: 0.85, marginBottom: 10 }}>
          🧪 Demo 模式：配戴只會改前端狀態，不會寫入後台
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.08)" }}>
              <th style={{ textAlign: "left", padding: 10 }}>成就條件</th>
              <th style={{ textAlign: "left", padding: 10 }}>成就名稱</th>
              <th style={{ textAlign: "left", padding: 10 }}>解鎖稱號</th>
              <th style={{ textAlign: "center", padding: 10, width: 220 }}>操作</th>
            </tr>
          </thead>

          <tbody>
            {achievementsSorted.map((a) => {
              const title = String(a.titleUnlock || "").trim();
              const unlocked = (me.unlockedTitles || []).includes(title);
              const isEquipped = title && me.activeTitle === title;

              return (
                <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <td style={{ padding: 10, opacity: title && unlocked ? 1 : 0.55 }}>{a.conditionText || "—"}</td>
                  <td style={{ padding: 10, fontWeight: 700, opacity: title && unlocked ? 1 : 0.55 }}>{a.name || "—"}</td>
                  <td style={{ padding: 10, fontWeight: 800, color: title ? "#FFD700" : "rgba(255,255,255,0.6)" }}>{title || "—"}</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    {title ? (
                      <button
                        className="rpg-btn sm"
                        onClick={() => toggleEquip(title)}
                        disabled={!unlocked}
                        style={{ opacity: unlocked ? 1 : 0.35, cursor: unlocked ? "pointer" : "not-allowed", filter: unlocked ? "none" : "grayscale(1)" }}
                      >
                        {isEquipped ? "取消配戴" : "配戴"}
                      </button>
                    ) : (
                      <span style={{ opacity: 0.6 }}>此成就不含稱號</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}