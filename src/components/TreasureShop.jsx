import { useMemo, useState } from "react";

/**
 * TreasureShop.jsx
 * - 共用「藏寶閣」彈窗元件：老師頁/學生頁都可用
 * - 你目前的 shopItems 形式：一條 SHOP_ITEMS 陣列，每筆含 tab: "pet" | "weapon" | "privilege"
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - width?: number (default 980)
 * - title?: string (default "🏮 藏寶閣（妖丹兌換）")
 * - items: Array<Item>   ✅ 直接傳 SHOP_ITEMS 進來
 * - onBuy?: (item) => Promise<void> | void  (可選，點購買時呼叫)
 *
 * Item:
 * {
 *   id: string,
 *   tab: "pet" | "weapon" | "privilege",
 *   name: string,
 *   desc?: string,
 *   price: number,
 *   icon?: string, // import 圖片後的路徑
 * }
 */

/** ✅ 通用 Modal：置中 + 背景變暗 + 點背景關閉 */
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <button className="rpg-btn" onClick={onClose}>
            關閉
          </button>
        </div>

        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}

const TABS = [
  { key: "pet", label: "靈寵", icon: "🐾" },
  { key: "weapon", label: "神兵", icon: "⚔️" },
  { key: "privilege", label: "特權卡片", icon: "🎫" },
];

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="rpg-btn sm"
      style={{
        opacity: active ? 1 : 0.6,
        filter: active ? "none" : "grayscale(0.7)",
        border: active ? "1px solid rgba(218,185,120,0.85)" : undefined,
        boxShadow: active ? "0 0 0 2px rgba(218,185,120,0.12)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export default function TreasureShop({
  open,
  onClose,
  width = 980,
  title = "🏮 藏寶閣（妖丹兌換）",
  items = [],
  onBuy,
}) {
  const [tab, setTab] = useState("pet");

  // ✅ 只吃你現在的 SHOP_ITEMS（陣列），用 tab 篩選
  const tabItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr.filter((x) => x?.tab === tab);
  }, [items, tab]);

  async function handleBuy(payload) {
  if (onBuy) return onBuy(payload);
  alert("未提供 onBuy，僅展示");
}

  return (
    <Modal open={open} title={title} onClose={onClose} width={width}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </TabButton>
        ))}
      </div>

      <div style={{ height: 12 }} />

      {/* Items */}
      {tabItems.length === 0 ? (
        <div
          style={{
            padding: 14,
            border: "1px dashed rgba(255,255,255,0.25)",
            borderRadius: 10,
            opacity: 0.85,
          }}
        >
          此分頁目前尚無商品（請確認 SHOP_ITEMS 內的 tab 是否為：pet / weapon / privilege）。
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {tabItems.map((it) => (
            <div
              key={it.id}
              style={{
                border: "1px solid rgba(218,185,120,0.25)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(0,0,0,0.25)",
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              {/* 左：圖片 icon */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                {it.icon ? (
                  <img
                    src={it.icon} 
                    alt={it.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ fontSize: 22, opacity: 0.7 }}>✨</div>
                )}
              </div>

              {/* 中：資訊 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, lineHeight: 1.5 }}>
  {tab === "weapon" && (
    <div style={{ marginTop: 4, color: "#f5d27a" }}>
      等級需求：Lv.{Number(it.requiredLevel || 1)}
    </div>
  )}

  <div>{it.desc || "—"}</div>
</div>

                <div style={{ marginTop: 8, fontWeight: 900 }}>
                  💰 妖丹：<span style={{ color: "#FFD700" }}>{Number(it.price || 0)}</span>
                </div>
              </div>

              {/* 右：按鈕 */}
              <button
  className="rpg-btn sm"
  onClick={() => handleBuy({ tabKey: tab, item: it, price: it.price })}
>
  購買
</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}