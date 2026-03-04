import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";
//藏寶閣
import TreasureShop from "../components/TreasureShop";
import { SHOP_ITEMS } from "../data/shopItems"; // 你的資料檔
// 背包行囊
import BackpackModal from "../components/BackpackModal";

// ✅ 靈獸蛋（背包 item 定義）
const EGG_REWARD = {
  id: "pet_egg_001",
  name: "靈獸蛋",
  category: "pet",                 // 會進到背包「靈寵」分類
  icon: "/merchandise/egg_001.png" // ✅ 你放 public/merchandise/ 底下的圖片
};

function HPBar({ now, max }) {
  const safeMax = Math.max(1, Number(max ?? 100));
  const safeNow = Math.max(0, Math.min(safeMax, Number(now ?? safeMax)));
  const pct = Math.max(0, Math.min(100, (safeNow / safeMax) * 100));

  return (
    <div style={{ width: 320 }}>
      <div
        style={{
          height: 14,
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(218,185,120,0.6)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(180deg, #ff4d4d, #ffa94d)",
          }}
        />
      </div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>
        HP：{safeNow} / {safeMax}
      </div>
    </div>
  );
}

/** ✅ 通用 Modal：置中 + 背景變暗 + 點背景關閉（跟老師頁同款） */
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

export default function StudentPage() {
  const [msg, setMsg] = useState("");
  const [meIndex, setMeIndex] = useState(null); // users/{uid}
  const [student, setStudent] = useState(null); // classes/{classId}/students/{studentId}
  const [studentPath, setStudentPath] = useState(null); // { classId, studentId }

  // ===== 學生成就/稱號彈窗 =====
  const [openAchModal, setOpenAchModal] = useState(false);
  const [achievements, setAchievements] = useState([]);

  // ===== 藏寶閣彈窗（學生頁）=====
const [openTreasure, setOpenTreasure] = useState(false);

  // ===== 背包彈窗 + 背包資料 =====
const [openBag, setOpenBag] = useState(false);
const [bagItems, setBagItems] = useState([]);

  // ✅ 新增：靈寵 / 神兵 / 行囊 / 藏寶閣 / 時裝 彈窗
const [openPetModal, setOpenPetModal] = useState(false);
const [openWeaponModal, setOpenWeaponModal] = useState(false);
const [openFashionModal, setOpenFashionModal] = useState(false);

// ✅ Lv5 獎勵彈窗（只給學生）
const [openEggModal, setOpenEggModal] = useState(false);
const eggRewardRunningRef = useRef(false);

  const navigate = useNavigate();

  // 方便用
  const classId = studentPath?.classId || null;
  const studentId = studentPath?.studentId || null;

  // ✅ 登入 + 監聽自己的 student doc
  useEffect(() => {
    let unsubStudent = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setMsg("");
      setStudent(null);
      setMeIndex(null);
      setStudentPath(null);

      if (!u) {
        navigate("/student-login");
        return;
      }

      // 讀 users/{uid}
      const usnap = await getDoc(doc(db, "users", u.uid));
      if (!usnap.exists()) {
        setMsg("尚未建立學生索引（users/{uid}）。請回學生登入頁完成「註冊/認領」。");
        return;
      }

      const ud = usnap.data();
      setMeIndex(ud);

      if (ud.role !== "student") {
        setMsg("此帳號不是學生身分。請用學生帳號登入。");
        return;
      }

      if (!ud.classId || !ud.studentId) {
        setMsg("尚未加入班級（缺 classId / studentId）。請回學生登入頁完成「註冊/認領」。");
        return;
      }

      const cid = ud.classId;
      const sid = ud.studentId;

      setStudentPath({ classId: cid, studentId: sid });

      const sRef = doc(db, "classes", cid, "students", sid);

      unsubStudent = onSnapshot(
        sRef,
        (s) => {
          if (!s.exists()) {
            setMsg("找不到你的弟子資料。請請老師確認是否刪除了該弟子。");
            setStudent(null);
            return;
          }
          const sd = s.data();

          // 額外保護：確認這筆真的是你認領的
          if (sd.authUid && sd.authUid !== u.uid) {
            setMsg("此弟子已被其他帳號認領（authUid 不符）。請回去重新認領。");
            setStudent(null);
            return;
          }

          setStudent({ id: s.id, ...sd });
        },
        (err) => setMsg(err?.message || "讀取弟子資料失敗")
      );
    });

    return () => {
      unsubAuth();
      if (unsubStudent) unsubStudent();
    };
  }, [navigate]);

  // ✅ 讀取本班 achievements：classes/{classId}/achievements
  useEffect(() => {
    if (!classId) return;

    const qA = query(
      collection(db, "classes", classId, "achievements"),
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(
      qA,
      (snap) => setAchievements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("student achievements listen error:", err)
    );

    return () => unsub();
  }, [classId]);

 // ✅ 監聽背包：classes/{classId}/students/{studentId}/inventory
useEffect(() => {
  if (!studentPath?.classId || !studentPath?.studentId) return;

  const invCol = collection(
    db,
    "classes",
    studentPath.classId,
    "students",
    studentPath.studentId,
    "inventory"
  );

  const unsub = onSnapshot(
    invCol,
    (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,                         // itemId（docId）
          name: data.name || "",
          category: data.category || "card", // pet/weapon/card/equip/fashion
          icon: data.icon || "",
          qty: Number(data.qty || 0),
        };
      });

      setBagItems(arr.filter((x) => x.qty > 0));
    },
    (err) => console.error("inventory listen error:", err)
  );

  return () => unsub();
}, [studentPath?.classId, studentPath?.studentId]);

// ✅ Lv5（含以上）第一次登入/升級時：送靈獸蛋（只送一次）
// 規則：用 inventory/egg_001 是否存在判斷已領過
useEffect(() => {
  if (!studentPath?.classId || !studentPath?.studentId) return;
  if (!student) return;

  // 只要達到 Lv5
  const lv = Number(student.level || 0);
  if (lv < 5) return;

  // 避免 onSnapshot 連續觸發造成重複跑
  if (eggRewardRunningRef.current) return;
  eggRewardRunningRef.current = true;

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  // 你要把蛋圖放在 public/merchandise/egg_001.png
  const eggRef = doc(db, "classes", classId, "students", studentId, "inventory", "egg_001");

  (async () => {
    try {
      await runTransaction(db, async (tx) => {
        // ✅ 先讀（所有讀取都要在寫入之前）
        const eggSnap = await tx.get(eggRef);

        // 已領過：直接結束（不寫入）
        if (eggSnap.exists()) return;

        // ✅ 再寫（這裡才開始 set）
        tx.set(eggRef, {
          itemId: "egg_001",
          name: "靈獸蛋",
          category: "pet",                 // 你背包 Tabs 有 pet/weapon/card/equip/fashion
          icon: "/merchandise/egg_001.png", // ✅ public 路徑
          qty: 1,
          acquiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // ✅ 發送成功才跳視窗
      setOpenEggModal(true);
    } catch (e) {
      console.error("Lv5 egg reward error:", e);
      // 如果失敗，允許下次再嘗試
      eggRewardRunningRef.current = false;
    }
  })();
}, [student?.level, studentPath?.classId, studentPath?.studentId]);

  // ✅ 配戴稱號：只更新 activeTitle + updatedAt（符合 rules）
  async function equipTitle(title) {
    if (!classId || !studentId) return;

    const next = String(title || "").trim();
    const unlocked = Array.isArray(student?.unlockedTitles) ? student.unlockedTitles : [];

    if (next !== "" && !unlocked.includes(next)) {
      alert("此稱號尚未解鎖，不能配戴。");
      return;
    }

    await updateDoc(doc(db, "classes", classId, "students", studentId), {
      activeTitle: next,
      updatedAt: serverTimestamp(),
    });
  }

 // ✅ 藏寶閣：學生購買（扣妖丹 + 寫入 students/{id}/inventory/{itemId}）
async function handleStudentBuy({ tabKey, item, price }) {
  if (!studentPath?.classId || !studentPath?.studentId) {
    alert("尚未取得 studentPath");
    return;
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  // 1) 學生主檔
  const sRef = doc(db, "classes", classId, "students", studentId);

  // 2) 背包子集合：用 item.id 當 docId（重複購買就累加 qty）
  const invRef = doc(db, "classes", classId, "students", studentId, "inventory", item.id);

  // 3) 分類 mapping：你的商店 privilege → 背包 card
  const category =
    tabKey === "pet"
      ? "pet"
      : tabKey === "weapon"
      ? "weapon"
      : tabKey === "privilege"
      ? "card"
      : tabKey === "card"
      ? "card"
      : tabKey === "equip"
      ? "equip"
      : tabKey === "fashion"
      ? "fashion"
      : "card";

  try {
    await runTransaction(db, async (tx) => {
      // 先讀學生 coin
      const sSnap = await tx.get(sRef);
      if (!sSnap.exists()) throw new Error("找不到學生資料");

      const sData = sSnap.data() || {};
      const coinNow = Number(sData.coin || 0);
      const cost = Number(price || 0);

      if (cost <= 0) throw new Error("商品金額異常");
      if (coinNow < cost) throw new Error("妖丹不足，無法購買");

      // 再讀背包該 item（看看有沒有買過）
      const invSnap = await tx.get(invRef);

      // 扣妖丹
      tx.update(sRef, {
        coin: coinNow - cost,
        updatedAt: serverTimestamp(),
      });

      // 寫入/累加背包
      if (!invSnap.exists()) {
        const safeIcon = String(item.icon || "");
const iconToStore = safeIcon.startsWith("/") ? safeIcon : ""; // 只存 /merchandise/xxx.png 這種

tx.set(invRef, {
  itemId: item.id,
  name: item.name || "",
  category,
  icon: iconToStore,
  qty: 1,
  acquiredAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
      } else {
        const oldQty = Number(invSnap.data()?.qty || 0);
        tx.update(invRef, {
          qty: oldQty + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });

    alert(`✅ 購買成功：${item.name}（-${price} 妖丹）`);
  } catch (e) {
    alert(e?.message || "購買失敗");
  }
}


  if (msg) {
    return (
      <div style={{ maxWidth: 860, margin: "60px auto", fontFamily: "sans-serif", color: "#fff" }}>
        <h2>學生頁</h2>
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{msg}</div>
        <div style={{ height: 12 }} />
        <button className="rpg-btn" onClick={() => setOpenAchModal(true)}>🎖️ 成就稱號</button>{" "}
        <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ maxWidth: 860, margin: "60px auto", fontFamily: "sans-serif", color: "#fff" }}>
        <h2>學生頁</h2>
        <div style={{ opacity: 0.85 }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "60px auto", fontFamily: "sans-serif", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>宗門弟子</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="rpg-btn" onClick={() => setOpenFashionModal(true)}>👘 時裝</button>
          <button className="rpg-btn" onClick={() => setOpenTreasure(true)}>🏮 藏寶閣</button>
          <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
        </div>
      </div>

      {/* ✅ 成就稱號彈窗 */}
      <Modal
        open={openAchModal}
        title={`🎖️ 成就稱號（目前：${student?.activeTitle || "未配戴"}）`}
        onClose={() => setOpenAchModal(false)}
        width={980}
      >
        <div style={{ opacity: 0.9, marginBottom: 10 }}>
          ✅ 只有「已解鎖」的稱號才可配戴；配戴只會更新 <b>activeTitle</b>（符合 rules）
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
            {achievements.map((a) => {
              const title = String(a.titleUnlock || "").trim();

              const unlockedAchievements = Array.isArray(student?.unlockedAchievements)
                ? student.unlockedAchievements
                : [];

              // ✅ 兼容兩種格式：
              // 1) 只存 id： "o058_...."
              // 2) 存完整 key： "classes/{classId}/achievements/o058_...."
              const key = `classes/${classId}/achievements/${a.id}`;
              const unlocked = unlockedAchievements.includes(a.id) || unlockedAchievements.includes(key);

              const unlockedTitles = Array.isArray(student?.unlockedTitles) ? student.unlockedTitles : [];

              // ✅ 能配戴：成就已解鎖 + 有稱號 + 稱號已在 unlockedTitles
              const canEquip = unlocked && !!title && unlockedTitles.includes(title);

              const isEquipped = !!title && student?.activeTitle === title;

              return (
                <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <td style={{ padding: 10, opacity: unlocked ? 1 : 0.55 }}>
                    {a.conditionText || "—"}
                  </td>

                  <td style={{ padding: 10, fontWeight: 700, opacity: unlocked ? 1 : 0.55 }}>
                    {a.name || "—"} {!unlocked && <span style={{ marginLeft: 8, fontSize: 12 }}>（未解鎖）</span>}
                  </td>

                  <td style={{ padding: 10, fontWeight: 800, color: title ? "#FFD700" : "rgba(255,255,255,0.6)" }}>
                    {title || "—"}
                  </td>

                  <td style={{ padding: 10, textAlign: "center" }}>
                    {title ? (
                      <button
                        className="rpg-btn sm"
                        onClick={() => equipTitle(isEquipped ? "" : title)}
                        disabled={!canEquip}
                        style={{
                          opacity: canEquip ? 1 : 0.35,
                          cursor: canEquip ? "pointer" : "not-allowed",
                          filter: canEquip ? "none" : "grayscale(1)",
                        }}
                        title={
                          !unlocked
                            ? "未解鎖此成就"
                            : !unlockedTitles.includes(title)
                            ? "尚未解鎖此稱號"
                            : isEquipped
                            ? "點一下取消配戴"
                            : "配戴稱號"
                        }
                      >
                        {isEquipped ? "取消配戴" : "配戴"}
                      </button>
                    ) : (
                      <span style={{ opacity: 0.6 }}></span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>

      {/* ===================== Lv5 靈獸蛋獎勵彈窗（學生頁）===================== */}
<Modal
  open={openEggModal}
  onClose={() => setOpenEggModal(false)}
  title="🎉 恭喜獲得獎勵！"
  width={560}
>
  <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 14, alignItems: "center" }}>
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* ✅ 用 public/ 路徑 */}
      <img
        src="/merchandise/egg_001.png"
        alt="靈獸蛋"
        style={{ width: "86%", height: "86%", objectFit: "contain" }}
      />
    </div>

    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#ffcc66" }}>
        恭喜獲得：靈獸蛋
      </div>

      <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.6 }}>
        你已達到 <b>Lv 5</b>，宗門特別贈送靈獸蛋一顆！<br />
        已自動放入你的 <b>行囊</b> 中。
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        （每個帳號限領一次）
      </div>
    </div>
  </div>

  <div style={{ height: 14 }} />

  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
    <button className="rpg-btn" onClick={() => setOpenEggModal(false)}>
      ✅ 收下 !
    </button>
  </div>
</Modal>

      {/* ✅ 靈寵彈窗 */}
      <Modal open={openPetModal} title="🐾 靈寵" onClose={() => setOpenPetModal(false)} width={820}>
        <div style={{ opacity: 0.9 }}>
           這裡之後放「靈寵列表 / 裝備 / 升級」等內容（目前先占位）。
        </div>
      </Modal>

      {/* ✅ 神兵彈窗 */}
      <Modal open={openWeaponModal} title="⚔️ 神兵" onClose={() => setOpenWeaponModal(false)} width={820}>
         <div style={{ opacity: 0.9 }}>
           這裡之後放「神兵列表 / 強化 / 佩戴」等內容（目前先占位）。
         </div>
      </Modal>

      {/* ✅ 背包彈窗 */}
      <BackpackModal
  open={openBag}
  onClose={() => setOpenBag(false)}
  items={bagItems}
  slotsPerTab={24}
/>

      {/* ✅ 藏寶閣彈窗 */}
      <TreasureShop
  open={openTreasure}
  onClose={() => setOpenTreasure(false)}
  mode="student"
  items={SHOP_ITEMS}
  coin={student?.coin ?? 0} // ✅ 建議保留，才能判斷買不買得起 & 顯示妖丹
  onBuy={handleStudentBuy}
/>

      {/* ✅ 時裝彈窗 */}
      <Modal open={openFashionModal} title="👘 時裝" onClose={() => setOpenFashionModal(false)} width={820}>
        <div style={{ opacity: 0.9 }}>
           這裡之後放「時裝清單 / 試穿 / 套用外觀」等內容（目前先占位）。
        </div>
      </Modal>

      {/* ✅ 弟子資訊卡 */}
      <div
        style={{
          marginTop: 14,
          padding: 18,
          border: "1px solid rgba(218,185,120,0.35)",
          borderRadius: 12,
          background: "rgba(20,20,20,0.85)",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 800 }}>
          {student.name}
          {student.activeTitle ? (
            <span style={{ marginLeft: 10, fontSize: 18, opacity: 10, color: "#ffd700" }}>
              {student.activeTitle}
            </span>
          ) : null}
          <span style={{ fontSize: 14, opacity: 0.85, marginLeft: 10 }}>
            Lv {student.level ?? 1}
          </span>
        </div>

        <div style={{ height: 10 }} />
        <HPBar now={student.hpNow ?? 100} max={student.hpMax ?? 100} />

        <div style={{ height: 12 }} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", opacity: 0.9 }}>
          <div  style={{ fontSize: 20, fontWeight: 800 }}>修為：{student.xp ?? 0}</div>
          <div  style={{ fontSize: 20, fontWeight: 800 }}>戰力：{student.cp ?? 0}</div>
          <div  style={{ fontSize: 20, fontWeight: 800 }}>妖丹：{student.coin ?? 0}</div>
        </div>

        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          班級代碼：{meIndex?.classCode || "—"}　|　弟子ID：{meIndex?.studentId || "—"}
        </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap"  }}>
         <button className="rpg-btn" onClick={() => setOpenAchModal(true)}>🎖️ 成就稱號</button>
         <button className="rpg-btn" onClick={() => setOpenPetModal(true)}>🐾 靈寵</button>
         <button className="rpg-btn" onClick={() => setOpenWeaponModal(true)}>⚔️ 神兵</button>
         <button className="rpg-btn" onClick={() => setOpenBag(true)}>🎒 行囊</button>
        </div>
    </div>
  );
}