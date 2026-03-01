import { useMemo, useState } from "react";

/** ✅ 通用 Modal（跟你老師頁同款） */
function Modal({ open, title, onClose, children, width = 980 }) {
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
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <button className="rpg-btn" onClick={onClose}>關閉</button>
        </div>
        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}

const TABS = [
  { key: "pet", label: "靈寵" },
  { key: "weapon", label: "神兵" },
  { key: "card", label: "卡片" },
  { key: "equip", label: "裝備" },
  { key: "fashion", label: "時裝" },
];

function TabBtn({ active, onClick, children }) {
  return (
    <button
      className="rpg-btn sm"
      onClick={onClick}
      style={{
        opacity: active ? 1 : 0.55,
        filter: active ? "none" : "grayscale(1)",
        border: active ? "1px solid rgba(218,185,120,0.85)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

/**
 * BackpackModal
 * Props:
 * - open / onClose
 * - items: Array<{ id,name,category,icon,qty }>
 * - slotsPerTab?: number (每個分類要顯示幾格，預設 24)
 */
export default function BackpackModal({
  open,
  onClose,
  items = [],
  slotsPerTab = 24,
  width = 980,
}) {
  const [tab, setTab] = useState("pet");

  const tabItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr.filter((x) => x?.category === tab);
  }, [items, tab]);

  // ✅ 生成固定格數（空格補滿）
  const slots = useMemo(() => {
    const filled = tabItems.slice(0, slotsPerTab);
    const emptyCount = Math.max(0, slotsPerTab - filled.length);
    return [...filled, ...Array.from({ length: emptyCount }, () => null)];
  }, [tabItems, slotsPerTab]);

  return (
    <Modal open={open} onClose={onClose} title="🎒 行囊（背包）" width={width}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {TABS.map((t) => (
          <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </TabBtn>
        ))}

        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.85 }}>
          此分類：{tabItems.length} / {slotsPerTab}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)", // 6格一排
          gap: 10,
        }}
      >
        {slots.map((it, idx) => (
          <div
            key={it?.id ? it.id : `empty-${idx}`}
            style={{
              height: 86,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
            title={it ? `${it.name} x${it.qty ?? 1}` : "空格"}
          >
            {!it ? (
              <div style={{ opacity: 0.25, fontSize: 12 }}>空</div>
            ) : (
              <>
                {it.icon ? (
                  <img
                    src={it.icon}
                    alt={it.name}
                    style={{ width: "82%", height: "82%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ fontSize: 26, opacity: 0.8 }}>✨</div>
                )}

                {/* 右下角數量 */}
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 6,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#ffcc66",
                    textShadow: "0 2px 6px rgba(0,0,0,0.6)",
                  }}
                >
                  x{it.qty ?? 1}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 10 }} />
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        （目前先做展示）之後如果要「點格子 → 顯示詳情/使用/裝備」，我再幫你加第二層彈窗。
      </div>
    </Modal>
  );
}