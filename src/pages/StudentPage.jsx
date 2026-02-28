import { useEffect, useState } from "react";
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
} from "firebase/firestore";

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

  // ✅ 新增：靈寵 / 神兵 / 行囊 / 藏寶閣 / 時裝 彈窗
const [openPetModal, setOpenPetModal] = useState(false);
const [openWeaponModal, setOpenWeaponModal] = useState(false);
const [openBagModal, setOpenBagModal] = useState(false);
const [openTreasureModal, setOpenTreasureModal] = useState(false);
const [openFashionModal, setOpenFashionModal] = useState(false);

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
          <button className="rpg-btn" onClick={() => setOpenTreasureModal(true)}>🏮 藏寶閣</button>
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
      <Modal open={openBagModal} title="🎒 行囊" onClose={() => setOpenBagModal(false)} width={820}>
         <div style={{ opacity: 0.9 }}>
           這裡之後放「道具、材料、消耗品」等內容（目前先占位）。
         </div>
      </Modal>

      {/* ✅ 藏寶閣彈窗 */}
      <Modal open={openTreasureModal} title="🏮 藏寶閣" onClose={() => setOpenTreasureModal(false)} width={820}>
         <div style={{ opacity: 0.9 }}>
           這裡之後放「妖丹兌換、商城」等內容（目前先占位）。
         </div>
      </Modal>

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
         <button className="rpg-btn" onClick={() => setOpenBagModal(true)}>🎒 行囊</button>
        </div>
    </div>
  );
}