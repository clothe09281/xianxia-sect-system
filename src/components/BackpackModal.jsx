import { useMemo, useState } from "react";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { calcWeaponPower, calcWeaponXpBonus } from "../data/weapons";

/** ✅ 通用 Modal */
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
 * - slotsPerTab?: number
 * - onUseItem?: (item) => void
 */
export default function BackpackModal({
  open,
  onClose,
  items = [],
  slotsPerTab = 24,
  width = 980,
  onUseItem,
  student,        // ✅ 新增
  studentPath,    // ✅ 新增
}) {
  const [tab, setTab] = useState("pet");
  const [selectedItem, setSelectedItem] = useState(null);

  function sumEquippedWeaponPower(equippedWeapons = []) {
  return equippedWeapons.reduce((sum, w) => {
    return sum + Number(w?.power || 0);
  }, 0);
}

function sumEquippedWeaponXpBonus(equippedWeapons = []) {
  return equippedWeapons.reduce((sum, w) => {
    return sum + Number(w?.xpBonus || 0);
  }, 0);
}

  const tabItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr.filter((x) => x?.category === tab);
  }, [items, tab]);

  const slots = useMemo(() => {
    const filled = tabItems.slice(0, slotsPerTab);
    const emptyCount = Math.max(0, slotsPerTab - filled.length);
    return [...filled, ...Array.from({ length: emptyCount }, () => null)];
  }, [tabItems, slotsPerTab]);

  async function equipWeapon(item) {
  if (!studentPath?.classId || !studentPath?.studentId) return alert("尚未取得 studentPath");
  if (!student) return alert("尚未取得學生資料");

  const myLv = Number(student.level || 1);
  const needLv = Number(item.requiredLevel || 1);

  if (myLv < 20) {
    return alert("需達 Lv20 才能開啟神兵系統");
  }

  if (myLv < needLv) {
    return alert(`此神兵需弟子 Lv.${needLv} 才能裝備`);
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  const studentRef = doc(db, "classes", classId, "students", studentId);
  const weaponRef = doc(db, "classes", classId, "students", studentId, "inventory", item.id);

  try {
    await runTransaction(db, async (tx) => {
      const sSnap = await tx.get(studentRef);
      const wSnap = await tx.get(weaponRef);

      if (!sSnap.exists()) throw new Error("找不到學生資料");
      if (!wSnap.exists()) throw new Error("找不到神兵資料");

      const sData = sSnap.data() || {};
      const weaponData = wSnap.data() || {};

      const equippedWeapons = Array.isArray(sData.equippedWeapons)
        ? [...sData.equippedWeapons]
        : [];

      // 已經裝過同一把，不重複裝
      const alreadyEquipped = equippedWeapons.some((w) => w.weaponId === item.id);
      if (alreadyEquipped) {
        throw new Error("此神兵已裝備");
      }

      // 最多 3 把
      if (equippedWeapons.length >= 3) {
        throw new Error("最多只能裝備 3 把神兵，請先卸下其他神兵");
      }

      const nextWeaponEntry = {
        weaponId: item.id,
        name: item.name || "",
        icon: item.icon || "",
        power: calcWeaponPower(weaponData),
        xpBonus: calcWeaponXpBonus(weaponData),
      };

      const nextEquippedWeapons = [...equippedWeapons, nextWeaponEntry];

      const totalWeaponPower = sumEquippedWeaponPower(nextEquippedWeapons);
      const totalWeaponXpBonus = sumEquippedWeaponXpBonus(nextEquippedWeapons);

      tx.update(studentRef, {
        weaponSystemUnlocked: true,
        weaponSystemUnlockedAt: sData.weaponSystemUnlockedAt || serverTimestamp(),
        equippedWeapons: nextEquippedWeapons,
        currentWeaponId: nextEquippedWeapons[0]?.weaponId || "",
        currentWeaponName: nextEquippedWeapons.map((w) => w.name).join("、"),
        currentWeaponIcon: nextEquippedWeapons[0]?.icon || "",
        currentWeaponPower: totalWeaponPower,
        currentWeaponXpBonus: totalWeaponXpBonus,
        updatedAt: serverTimestamp(),
      });

      tx.update(weaponRef, {
        equipped: true,
        updatedAt: serverTimestamp(),
      });
    });

    alert(`✅ 已裝備神兵：${item.name}`);
    setSelectedItem(null);
  } catch (e) {
    console.error("equipWeapon error:", e);
    alert(e?.message || "裝備失敗");
  }
}

  return (
    <Modal open={open} onClose={onClose} title="🎒 行囊（背包）" width={width}>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
        }}
      >
        {slots.map((it, idx) => {
          const src =
            it && typeof it.icon === "string" && it.icon.startsWith("/")
              ? it.icon
              : "";

          return (
            <div
  key={it?.id ? it.id : `empty-${idx}`}
  onClick={() => {
    if (it) setSelectedItem(it);
  }}
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
    cursor: it ? "pointer" : "default",
  }}
  title={it ? `${it.name} x${it.qty ?? 1}` : "空格"}
>
              {!it ? (
                <div style={{ opacity: 0.2, fontSize: 12 }}>空</div>
              ) : (
                <>
                  {src ? (
                    <img
                      src={src}
                      alt={it.name}
                      style={{
                        width: "82%",
                        height: "82%",
                        objectFit: "contain",
                      }}
                      onError={(e) => {
                        console.log("❌ 背包圖片載入失敗：", src, it);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 26, opacity: 0.8 }}>✨</div>
                  )}

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
  {it?.category === "weapon" && it?.equipped ? "已裝備" : `x${it?.qty ?? 1}`}
</div>

                  {/* ✅ 靈獸蛋可使用 */}
                  {it.id === "egg_001" && !it.activated && typeof onUseItem === "function" && (
                    <button
                      className="rpg-btn sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseItem(it);
                      }}
                      style={{
                        position: "absolute",
                        left: 6,
                        bottom: 6,
                        fontSize: 11,
                        padding: "2px 8px",
                      }}
                    >
                      使用
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ height: 10 }} />
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        靈獸蛋可在背包中點選「使用」，用來正式開啟靈獸系統。
      </div>

      {/* ===================== 道具詳情視窗 ===================== */}
<Modal
  open={!!selectedItem}
  onClose={() => setSelectedItem(null)}
  title={selectedItem ? `物品詳情｜${selectedItem.name}` : "物品詳情"}
  width={560}
>
  {!selectedItem ? null : selectedItem.category === "weapon" ? (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 16, alignItems: "center" }}>
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={selectedItem.icon}
            alt={selectedItem.name}
            style={{ width: "82%", height: "82%", objectFit: "contain" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedItem.name}</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            等級需求：Lv.{Number(selectedItem.requiredLevel || 1)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            狀態：{selectedItem.equipped ? "已裝備" : "未裝備"}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div
  style={{
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    padding: 12,
    lineHeight: 1.9,
  }}
>
  <div><b>❤️ 基礎血量：</b>{Number(selectedItem.baseHp || 0)}</div>
  <div><b>⚔️ 基礎攻擊：</b>{Number(selectedItem.baseAtk || 0)}</div>
  <div><b>💨 基礎速度：</b>{Number(selectedItem.baseSpd || 0)}</div>
  <div><b>✨ 神兵戰力：</b>{calcWeaponPower(selectedItem)}</div>
  <div><b>📘 修為加成：</b>{calcWeaponXpBonus(selectedItem)}</div>
</div>

      <div style={{ height: 14 }} />

      <div
        style={{
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          技能：{selectedItem.skillName || "未命名技能"}
        </div>
        <div style={{ opacity: 0.85, lineHeight: 1.7 }}>
          {selectedItem.skillDesc || "尚無技能說明"}
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="rpg-btn" onClick={() => setSelectedItem(null)}>
          關閉
        </button>

        <button
  className="rpg-btn"
  onClick={() => equipWeapon(selectedItem)}
  disabled={
    selectedItem.equipped ||
    Number(student?.level || 1) < 20 ||
    Number(student?.level || 1) < Number(selectedItem.requiredLevel || 1) ||
    (Array.isArray(student?.equippedWeapons) && student.equippedWeapons.length >= 3)
  }
  style={{
    opacity:
      selectedItem.equipped ||
      Number(student?.level || 1) < 20 ||
      Number(student?.level || 1) < Number(selectedItem.requiredLevel || 1) ||
      (Array.isArray(student?.equippedWeapons) && student.equippedWeapons.length >= 3)
        ? 0.5
        : 1,
    cursor:
      selectedItem.equipped ||
      Number(student?.level || 1) < 20 ||
      Number(student?.level || 1) < Number(selectedItem.requiredLevel || 1) ||
      (Array.isArray(student?.equippedWeapons) && student.equippedWeapons.length >= 3)
        ? "not-allowed"
        : "pointer",
  }}
>
  {selectedItem.equipped ? "已裝備" : "⚔️ 裝備"}
</button>
      </div>
    </div>
  ) : (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 16, alignItems: "center" }}>
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={selectedItem.icon}
            alt={selectedItem.name}
            style={{ width: "82%", height: "82%", objectFit: "contain" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedItem.name}</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            數量：x{Number(selectedItem.qty || 1)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            類型：{selectedItem.category || "未知"}
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="rpg-btn" onClick={() => setSelectedItem(null)}>
          關閉
        </button>

        {selectedItem.id === "egg_001" && (
          <button
            className="rpg-btn"
            onClick={() => {
              onUseItem?.(selectedItem);
              setSelectedItem(null);
            }}
          >
            使用
          </button>
        )}
      </div>
    </div>
  )}
</Modal>

    </Modal>
  );
}