import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  increment,
  serverTimestamp,
  getDoc,
  where,
  getDocs,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

// 👇👇👇 MONSTERS 放在這裡 👇👇👇
import banditImg from "../assets/monsters/monster_001.png";
import goblinImg from "../assets/monsters/monster_002.png";
import golemImg from "../assets/monsters/monster_003.png";
import cyclopsImg from "../assets/monsters/monster_004.png";
import tenguImg from "../assets/monsters/monster_005.png";

// 🏮 藏寶閣商品
import TreasureShop from "../components/TreasureShop";
import { SHOP_ITEMS } from "../data/shopItems"; // 你的資料檔

import Papa from "papaparse";

/** ✅ 通用 Modal：置中 + 背景變暗 + 點背景關閉 */
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

// ⚔️ 怪物名冊
const MONSTERS = [
  { id: "bandit", name: "山賊", hp: 30, xpWin: 12, cpWin: 6, coinWin: 5 , img: banditImg },
  { id: "goblin", name: "地精矮人", hp: 45, xpWin: 16, cpWin: 8, coinWin: 6 , img: goblinImg },
  { id: "golem", name: "機關傀儡", hp: 65, xpWin: 22, cpWin: 10, coinWin: 8 , img: golemImg },
  { id: "cyclops", name: "獨眼巨人", hp: 90, xpWin: 30, cpWin: 14, coinWin: 10 , img: cyclopsImg },
  { id: "tengu", name: "天狗", hp: 120, xpWin: 40, cpWin: 18, coinWin: 15 , img: tenguImg },
];

function HPBar({ now, max }) {
  const safeMax = Math.max(1, Number(max ?? 100));
  const safeNow = Math.max(0, Math.min(safeMax, Number(now ?? safeMax)));
  const pct = Math.max(0, Math.min(100, (safeNow / safeMax) * 100));
  const isDanger = safeNow / safeMax <= 0.2;

  return (
    <div className={isDanger ? "hp-danger" : ""} style={{ width: 260 }}>
      <div style={{ height: 14, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(218,185,120,0.6)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(180deg, #ff4d4d, #ffa94d)" }} />
      </div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>HP：{safeNow} / {safeMax}</div>
    </div>
  );
}


// ✅ 用 users/{uid} 判斷老師
async function ensureTeacherRole(user) {
  const uref = doc(db, "users", user.uid);
  const usnap = await getDoc(uref);
  if (!usnap.exists() || usnap.data()?.role !== "teacher") {
    throw new Error("此帳號非老師身分（users/{uid}.role != teacher）");
  }
}

// ✅ 找老師的 class（取第一個）
async function getMyClass(teacherUid) {
  const q1 = query(collection(db, "classes"), where("teacherUid", "==", teacherUid));
  const snap = await getDocs(q1);
  if (snap.empty) throw new Error("找不到你的班級（classes 中沒有 teacherUid == 你）");
  const c = snap.docs[0];
  return { classId: c.id, code: c.data().code };
}

// ✅ 乾淨化弟子 docId
function normalizeStudentId(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\/\\#?\[\]]/g, "");
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);

  const [classId, setClassId] = useState(null);
  const [classCode, setClassCode] = useState("");

  const [students, setStudents] = useState([]);
  const [name, setName] = useState("");

  // 彈窗
  const [openRaid, setOpenRaid] = useState(false);
  const [openRank, setOpenRank] = useState(false);
  const [openTreasure, setOpenTreasure] = useState(false);

  // 歷練
  const [selectedMonsterId, setSelectedMonsterId] = useState(MONSTERS[0].id);
  const [battle, setBattle] = useState(null);
  const [showBattle, setShowBattle] = useState(false);
  const [raidParticipants, setRaidParticipants] = useState([]);
  const [answererId, setAnswererId] = useState(null);

  // 稱號彈窗
  const [openTitles, setOpenTitles] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [targetStudentId, setTargetStudentId] = useState(null);
  const [targetStudentName, setTargetStudentName] = useState("");
  const [targetUnlockedAchIds, setTargetUnlockedAchIds] = useState(new Set());

  const navigate = useNavigate();

  // ===== 成就CSV匯入 =====
const [openImportAch, setOpenImportAch] = useState(false);
const [csvRows, setCsvRows] = useState([]);
const [csvError, setCsvError] = useState("");
const [importing, setImporting] = useState(false);

  // ✅ 登入狀態 + 抓 classId
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return navigate("/login");

      try {
        await ensureTeacherRole(u);
        const c = await getMyClass(u.uid);
        setClassId(c.classId);
        setClassCode(c.code);
      } catch (e) {
        alert(e.message);
        navigate("/login");
      }
    });
    return () => unsub();
  }, [navigate]);

  // ✅ 同步本班 students
  useEffect(() => {
    if (!classId) return;

    const ref = collection(db, "classes", classId, "students");
    const q1 = query(ref, orderBy("cp", "desc"));
    const unsub = onSnapshot(
      q1,
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("students listen error:", err)
    );

    return () => unsub();
  }, [classId]);

  // ✅ classes（班級底下清單）
  useEffect(() => {
  if (!classId) return;

  const qA = query(
    collection(db, "classes", classId, "achievements"),
    orderBy("order", "asc")
  );

  const unsub = onSnapshot(
    qA,
    (snap) => setAchievements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("achievements listen error:", err)
  );

  return () => unsub();
}, [classId]);

  // ✅ 更新學生（統一出口）
  async function patchStudent(studentDocId, data) {
    if (!classId) return;
    await updateDoc(doc(db, "classes", classId, "students", studentDocId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  // ✅ 老師新增弟子（docId=弟子名稱）
  async function addStudent() {
    if (!classId) return;

    const sid = normalizeStudentId(name);
    if (!sid) return;

    const sref = doc(db, "classes", classId, "students", sid);
    const existed = await getDoc(sref);
    if (existed.exists()) {
      alert("此弟子名稱已存在，請換一個名字（或確認是否已建立）");
      return;
    }

    await setDoc(sref, {
      name: sid,
      authUid: null,
      level: 1,
      xp: 0,
      coin: 0,
      cp: 0,
      hpMax: 100,
      hpNow: 100,
      unlockedTitles: [],
      unlockedAchievements: [],
      activeTitle: "",

      // ✅ 背包初始化（建議）
      inventory: {
  pet: {},
  weapon: {},
  privilege: {},
},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setName("");
  }

  async function addXP(id, v) {
    await patchStudent(id, { xp: increment(v), cp: increment(v) });
  }

  async function addCoin(id, v) {
    await patchStudent(id, { coin: increment(v) });
  }

  async function healStudentFull(studentId) {
    const s = students.find((x) => x.id === studentId);
    if (!s) return;
    await patchStudent(studentId, { hpNow: s.hpMax ?? 100 });
  }

  async function healAllStudentsFull() {
    const ok = window.confirm("確定要讓【全班學生】回滿血嗎？");
    if (!ok) return;
    for (const s of students) {
      await patchStudent(s.id, { hpNow: s.hpMax ?? 100 });
    }
  }

  async function applyLevelUp(studentId) {
    const s = students.find((x) => x.id === studentId);
    if (!s) return;

    const level = s.level ?? 1;
    const xp = s.xp ?? 0;

    if (xp < level * 100 || level >= 99) return;

    const newLevel = Math.min(99, level + 1);
    const newHpMax = (s.hpMax ?? 100) + 5;

    await patchStudent(studentId, { level: newLevel, hpMax: newHpMax, hpNow: newHpMax });
  }

  // ===== 歷練 =====
  function openRaidModal() {
    setOpenRaid(true);
    setShowBattle(false);
    setBattle(null);
    setRaidParticipants([]);
    setAnswererId(null);
  }

  function closeRaidModal() {
    setOpenRaid(false);
    setShowBattle(false);
    setBattle(null);
    setRaidParticipants([]);
    setAnswererId(null);
  }

  function toggleRaidParticipant(studentDocId) {
    setRaidParticipants((prev) =>
      prev.includes(studentDocId) ? prev.filter((id) => id !== studentDocId) : [...prev, studentDocId]
    );
  }

  function startRaid() {
    const monster = MONSTERS.find((m) => m.id === selectedMonsterId);
    if (!monster) return alert("找不到怪物");

    setBattle({ monster, hp: monster.hp });
    setShowBattle(true);
    setRaidParticipants([]);
    setAnswererId(null);
  }

  function answerCorrect() {
    setBattle((prev) => {
      if (!prev) return prev;
      return { ...prev, hp: Math.max(0, (prev.hp ?? 0) - 10) };
    });
  }

  async function answerWrong() {
    if (!answererId) return;
    await patchStudent(answererId, { hpNow: increment(-10) });
  }

  async function finishWin() {
    if (!battle?.monster) return;
    if (raidParticipants.length === 0) return alert("請先選參戰弟子");

    const m = battle.monster;
    for (const sid of raidParticipants) {
      await patchStudent(sid, {
        xp: increment(m.xpWin),
        cp: increment(m.cpWin),
        coin: increment(m.coinWin),
        hpNow: increment(5),
      });
      await applyLevelUp(sid);
    }

    setShowBattle(false);
    setBattle(null);
    setRaidParticipants([]);
    setAnswererId(null);
    alert("已發放獎勵 ✅");
  }

  function normHeader(h) {
  return String(h || "").trim().replace(/\s+/g, "");
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

// 讀CSV（上傳檔案後解析）
async function handleCSVFile(file) {
  setCsvError("");
  setCsvRows([]);

  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      try {
        // 先把 header 正規化（避免有空白/全形）
        const raw = res.data || [];
        const normalized = raw
          .map((r) => {
            const out = {};
            Object.keys(r || {}).forEach((k) => {
              out[normHeader(k)] = r[k];
            });
            return out;
          })
          .filter((r) => Object.values(r).some((v) => String(v || "").trim() !== ""));

        // 轉成我們要的格式（支援多種欄名）
        const mapped = normalized.map((r, idx) => {
          const conditionText = String(
            pick(r, ["成就條件", "條件", "conditionText", "ConditionText"])
          ).trim();

          const name = String(
            pick(r, ["成就名稱", "名稱", "name", "Name"])
          ).trim();

          const titleUnlock = String(
            pick(r, ["解鎖稱號", "稱號", "titleUnlock", "TitleUnlock"])
          ).trim();

          const metric = String(
            pick(r, ["metric", "Metric", "指標"])
          ).trim() || "custom";

          const thresholdRaw = pick(r, ["threshold", "Threshold", "門檻", "次數"]);
          const threshold = Number(thresholdRaw || 0) || 0;

          if (!name) {
          return null; // ✅ 只要求成就名稱必填
          }

          return {
           _row: idx + 2,
           order: idx, // ✅ 0,1,2... 照CSV順序
           conditionText,
           name,
           titleUnlock, // ✅ 允許空字串
           metric,
           threshold,
           };
        }).filter(Boolean);

        if (mapped.length === 0) {
          setCsvError("CSV 解析成功，但找不到有效資料（請確認欄位：成就名稱、解鎖稱號）。");
          return;
        }

        setCsvRows(mapped);
      } catch (e) {
        setCsvError(e?.message || "CSV 解析失敗");
      }
    },
    error: (err) => setCsvError(err?.message || "CSV 解析失敗"),
  });
}

// 一鍵匯入：全部寫入 achievements

async function importAchievementsToFirestore() {
  if (csvRows.length === 0) return alert("請先選擇 CSV 檔案");
  if (!user?.uid) return alert("請先登入老師帳號");
  setImporting(true);

  try {
    // ✅ 用 batch 一次寫入（比較穩）
    const batch = writeBatch(db);

    // docId 不再依賴 titleUnlock（空白也能匯）
    const makeId = (a) => {
  const safeName = String(a.name || "")
    .trim()
    .replace(/[\/\\#?\[\]]/g, "")
    .slice(0, 60);

  // ✅ 用 order + name 當 docId，不靠 titleUnlock（可空）
  return `o${String(a.order ?? 0).padStart(3, "0")}_${safeName}` || `ach_${Date.now()}`;
};

    csvRows.forEach((a) => {
      const id = makeId(a);
      const ref = doc(db, "classes", classId, "achievements", id);

      batch.set(ref, {
      order: a.order ?? 0,             // ✅ 重要：照檔案順序
      conditionText: a.conditionText || "",
      name: a.name,
      titleUnlock: a.titleUnlock || "", // ✅ 可空
      metric: a.metric || "custom",
      threshold: Number(a.threshold || 0),

      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    }, { merge: true });
    });

    await batch.commit();
    alert(`匯入完成 ✅ 共 ${csvRows.length} 筆成就已寫入 achievements`);
    setOpenImportAch(false);
    setCsvRows([]);
  } catch (e) {
    console.error(e);
    alert(e?.message || "匯入失敗");
  } finally {
    setImporting(false);
  }
}

// ✅ 授予成就、稱號（彈窗按鈕用）
async function grantAchievementToTarget(a) {
  if (!classId) return alert("classId 尚未載入");
  if (!targetStudentId) return alert("尚未指定要發成就的弟子");

  const achievementId = a?.id; // ✅ classes/{classId}/achievements/{achievementId}
  if (!achievementId) return alert("成就資料缺少 id");

  const title = String(a?.titleUnlock || "").trim(); // ✅ 可空白

  const patch = {
    unlockedAchievements: arrayUnion(achievementId), // ✅ 只存 docId（最穩）
    updatedAt: serverTimestamp(),
  };

  if (title) patch.unlockedTitles = arrayUnion(title);

  await updateDoc(doc(db, "classes", classId, "students", targetStudentId), patch);

  // ✅ 立刻更新本地狀態：按鈕馬上變暗（不用等 onSnapshot）
  setTargetUnlockedAchIds((prev) => new Set([...prev, achievementId]));

  alert(
    title
      ? `✅ 已發放成就「${a.name || "（未命名）"}」，並解鎖稱號：${title}`
      : `✅ 已發放成就「${a.name || "（未命名）"}」（此成就不含可配戴稱號）`
  );
}

  // achievements 排序：優先用 threshold（若有），沒有就不排序
  const achievementsSorted = useMemo(() => {
  const arr = [...achievements];
  arr.sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999));
  return arr;
}, [achievements]);

  const top3 = useMemo(() => students.slice(0, 3), [students]);

  return (
    <div style={{ width: "min(1400px, 96vw)", margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>宗門名錄（老師模式）</h2>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            班級代碼：<b>{classCode || "（載入中）"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="rpg-btn" onClick={openRaidModal}>歷練</button>
          <button className="rpg-btn" onClick={() => setOpenRank(true)}>戰力榜</button>
          <button className="rpg-btn" onClick={() => setOpenTreasure(true)}>藏寶閣</button>
          <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
          <button className="rpg-btn" onClick={() => setOpenImportAch(true)}>📥 匯入成就</button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* 新增弟子 */}
      <div style={{ display: "flex", gap: 10, margin: "18px 0", alignItems: "center" }}>
        <input
          style={{ flex: 1, padding: 10 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新增弟子姓名（例如：花前）"
        />
        <button className="rpg-btn sm" onClick={addStudent}>新增弟子</button>
        <button className="rpg-btn sm" onClick={healAllStudentsFull}>🔥 全班滿血</button>
      </div>

      {/* 主畫面 table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th style={{ padding: 10, textAlign: "left" }}>弟子</th>
            <th>等級</th>
            <th>血量</th>
            <th>修為</th>
            <th>妖丹</th>
            <th>戰力</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 10 }}>
              <div style={{
               fontSize: 20,
               fontWeight: 700,
               letterSpacing: 1,
               color: "#fff"
              }}>
              {s.name}
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                  {s.authUid ? "（已認領）" : "（未認領）"}
                </span>
                {!!s.activeTitle && (
              <div style={{
               marginTop: 6,
               fontSize: 14,
               fontWeight: 600,
               color: "#ffd700",
               background: "rgba(255,215,0,0.1)",
               padding: "2px 8px",
               borderRadius: 6,
               display: "inline-block"
              }}>稱號：{s.activeTitle}
              </div>
              )}
              </div>
              </td>
              <td align="center"><div style={{ fontSize: 18, fontWeight: 700, color: "#ffcc66" }}>{s.level ?? 1}</div></td>
              <td align="center"><HPBar now={Math.max(0, s.hpNow ?? 100)} max={s.hpMax ?? 100} /></td>
              <td align="center"><div style={{ fontSize: 18, fontWeight: 600 }}>{s.xp ?? 0}</div></td>
              <td align="center"><div style={{ fontSize: 18, fontWeight: 600 }}>{s.coin ?? 0}</div></td>
              <td align="center"><div style={{ fontSize: 20, fontWeight: 800, color: "#ff884d" }}>{s.cp ?? 0}</div></td>
              <td align="center">
                <button className="rpg-btn sm" onClick={() => addXP(s.id, 10)}>✅ 答對</button>{" "}
                <button className="rpg-btn sm" onClick={() => addXP(s.id, -5)}>❌ 答錯</button>{" "}
                <button className="rpg-btn sm" onClick={() => addCoin(s.id, 10)}>妖丹</button>{" "}
                <button className="rpg-btn sm" onClick={() => healStudentFull(s.id)}>回血</button>{" "}
                <button
                  className="rpg-btn sm"
                  onClick={() => {
  setTargetStudentId(s.id);
  setTargetStudentName(s.name || s.id);
  setTargetUnlockedAchIds(new Set(s.unlockedAchievements || []));
  setOpenTitles(true);
}}
                >
                  🎁 成就
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

{/* ===================== 歷練彈窗 ===================== */}
<Modal open={openRaid} title="⚔️ 歷練視窗" onClose={closeRaidModal} width={980}>
  {/* 上方工具列 */}
  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <div style={{ opacity: 0.9 }}>👹 選擇怪物：</div>

    <select
      value={selectedMonsterId}
      onChange={(e) => setSelectedMonsterId(e.target.value)}
      style={{ padding: 8 }}
    >
      {MONSTERS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}（HP {m.hp}）
        </option>
      ))}
    </select>

    {!showBattle ? (
      <button className="rpg-btn" onClick={startRaid}>開始歷練</button>
    ) : (
      <button
        className="rpg-btn"
        onClick={() => {
          setShowBattle(false);
          setBattle(null);
          setRaidParticipants([]);
          setAnswererId(null);
        }}
      >
        重新選怪物
      </button>
    )}
  </div>

  <div style={{ height: 14 }} />

  {/* 作戰畫面 */}
  {showBattle && battle?.monster ? (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* 左側：怪物資訊 + 圖片 */}
      <div
        style={{
          padding: 14,
          border: "1px solid rgba(218,185,120,0.25)",
          borderRadius: 10,
          display: "grid",
          gridTemplateColumns: "1fr 260px", // ✅ 右側留給圖片（你紅框的區域）
          gap: 14,
          alignItems: "center",
        }}
      >
        {/* 左：怪物資訊 */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>👹 {battle.monster.name}</div>
          <div style={{ marginTop: 10 }}>
            <HPBar now={battle.hp ?? 0} max={battle.monster.hp ?? 100} />
          </div>

          {!answererId && (
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>請先指定答題者</div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(battle.hp ?? 0) > 0 ? (
              <>
                <button className="rpg-btn" onClick={answerCorrect} disabled={!answererId}>✅ 答對</button>
                <button className="rpg-btn danger" onClick={answerWrong} disabled={!answererId}>❌ 答錯</button>
              </>
            ) : (
              <button className="rpg-btn" onClick={finishWin}>🎉 勝利！領取獎勵</button>
            )}
          </div>
        </div>

        {/* 右：怪物圖片（紅框位置） */}
        <div
          style={{
            width: 260,
            height: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
          }}
        >
          <img
            src={battle.monster.img}
            alt={battle.monster.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      {/* 右側：選參戰弟子 */}
      <div style={{ padding: 14, border: "1px solid rgba(218,185,120,0.25)", borderRadius: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>🧑‍🎓 選參戰弟子</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>參戰名單（勾選）</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {students.map((s) => {
              const checked = raidParticipants.includes(s.id);
              return (
                <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleRaidParticipant(s.id)} />
                  {s.name}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>參戰列表（指定答題者）</div>

          {raidParticipants.length === 0 ? (
            <div style={{ opacity: 0.8, fontSize: 13 }}>尚未選擇參戰弟子</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {raidParticipants.map((sid) => {
                const s = students.find((x) => x.id === sid);
                if (!s) return null;

                return (
                  <div
                    key={sid}
                    style={{
                      padding: 10,
                      border: answererId === sid
                        ? "1px solid rgba(218,185,120,0.85)"
                        : "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name="answerer"
                          checked={answererId === sid}
                          onChange={() => setAnswererId(sid)}
                        />
                        <strong>{s.name}</strong>
                      </label>
                      <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.85 }}>
                        Lv {s.level ?? 1}
                      </span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <HPBar now={Math.max(0, s.hpNow ?? 100)} max={s.hpMax ?? 100} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ opacity: 0.8, fontSize: 13 }}>
      流程：按「歷練」→ 選怪物 → 「開始歷練」→ 進作戰畫面 → 再選參戰弟子
    </div>
  )}
</Modal>

      {/* ===================== 戰力榜彈窗 ===================== */}
      <Modal open={openRank} title="🏆 戰力榜" onClose={() => setOpenRank(false)} width={820}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.08)" }}>
              <th style={{ textAlign: "left", padding: 10 }}>排名</th>
              <th style={{ textAlign: "left", padding: 10 }}>弟子</th>
              <th style={{ textAlign: "right", padding: 10 }}>戰力</th>
            </tr>
          </thead>
          <tbody>
  {students.map((s, idx) => {
    const isTop1 = idx === 0;
    const isTop2 = idx === 1;
    const isTop3 = idx === 2;

    return (
      <tr
        key={s.id}
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          background:
            isTop1
              ? "rgba(255,215,0,0.08)"
              : isTop2
              ? "rgba(192,192,192,0.08)"
              : isTop3
              ? "rgba(205,127,50,0.08)"
              : "transparent",
        }}
      >
        {/* 排名 */}
        <td style={{ padding: 12 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: isTop1
                ? "#FFD700"
                : isTop2
                ? "#C0C0C0"
                : isTop3
                ? "#CD7F32"
                : "#fff",
              textShadow: "0 0 6px rgba(255,215,0,0.6)"
            }}
          >
            {idx + 1}
          </div>
        </td>

        {/* 弟子 */}
        <td style={{ padding: 12 }}>
  {/* 名字 + 等級 同一行 */}
  <div
    style={{
      fontSize: 18,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    {s.name}

    <span
      style={{
        fontSize: 14,
        fontWeight: 600,
        background: "rgba(255,255,255,0.1)",
        padding: "2px 8px",
        borderRadius: 6,
      }}
    >
      Lv {s.level ?? 1}
    </span>

    <span
      style={{
        marginTop: 6,
        fontSize: 13,
        fontWeight: 600,
        color: "#FFD700",
        background: "rgba(255,215,0,0.08)",
        padding: "2px 8px",
        borderRadius: 6,
        display: "inline-block",
      }}
    >
      {s.activeTitle}
      </span>
  </div>
        </td>

        {/* 戰力 */}
        <td style={{ padding: 12, textAlign: "right" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: isTop1 ? "#ff884d" : "#ffcc66",
              letterSpacing: 1,
            }}
          >
            {s.cp ?? 0}
          </div>
        </td>
      </tr>
    );
  })}
</tbody>
        </table>
      </Modal>

      {/* ===================== 弟子發放稱號彈窗 ===================== */}
      <Modal
        open={openTitles}
        title={`🎖️ 發放稱號（目標：${targetStudentName || "未指定"}）`}
        onClose={() => setOpenTitles(false)}
        width={980}
      >
        {!targetStudentId ? (
          <div style={{ opacity: 0.9 }}>請先在弟子列表點「🎁 發稱號」指定目標弟子。</div>
        ) : achievementsSorted.length === 0 ? (
          <div style={{ opacity: 0.9 }}>目前 achievements 尚無資料（請先匯入/建立）。</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.08)" }}>
                <th style={{ textAlign: "left", padding: 10 }}>成就條件</th>
                <th style={{ textAlign: "left", padding: 10 }}>成就名稱</th>
                <th style={{ textAlign: "left", padding: 10 }}>解鎖稱號</th>
                <th style={{ textAlign: "center", padding: 10, width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
  {achievementsSorted.map((a) => {
    const alreadyGranted = targetUnlockedAchIds.has(a.id);

    return (
      <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <td style={{ padding: 10 }}>{a.conditionText || "—"}</td>
        <td style={{ padding: 10 }}>{a.name || "—"}</td>
        <td style={{ padding: 10, fontWeight: 700 }}>{a.titleUnlock || "—"}</td>

        <td style={{ padding: 10, textAlign: "center" }}>
          <button
            className="rpg-btn sm"
            onClick={() => grantAchievementToTarget(a)}
            disabled={alreadyGranted} // ✅ 已授予 → 不可再按（若你想可重複授予就拿掉）
            style={{
              opacity: alreadyGranted ? 0.35 : 1,
              filter: alreadyGranted ? "grayscale(1)" : "none",
              cursor: alreadyGranted ? "not-allowed" : "pointer",
            }}
            title={alreadyGranted ? "已授予過" : "授予此成就"}
          >
            {alreadyGranted ? "已授予" : "授予"}
          </button>
        </td>
      </tr>
    );
  })}
</tbody>
          </table>
        )}
      </Modal>

      {/* ===================== 藏寶閣彈窗 ===================== */}
      <TreasureShop
  open={openTreasure}
  onClose={() => setOpenTreasure(false)}
  mode="teacher"
  items={SHOP_ITEMS}
/>

      {/* ===================== 匯入成就彈窗 ===================== */}
      <Modal
  open={openImportAch}
  title="📥 一鍵匯入 achievements（CSV）"
  onClose={() => {
    if (!importing) {
      setOpenImportAch(false);
      setCsvRows([]);
      setCsvError("");
    }
  }}
  width={980}
>
  <div style={{ opacity: 0.9, lineHeight: 1.7 }}>
    1) 請先把 Excel 另存成「CSV UTF-8」<br />
    2) 上傳 CSV 後會預覽筆數<br />
    3) 按「一鍵匯入」會全部寫入 Firestore 的 achievements
  </div>

  <div style={{ height: 12 }} />

  <input
    type="file"
    accept=".csv,text/csv"
    disabled={importing}
    onChange={(e) => handleCSVFile(e.target.files?.[0])}
  />

  {csvError && (
    <>
      <div style={{ height: 10 }} />
      <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{csvError}</div>
    </>
  )}

  <div style={{ height: 12 }} />

  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <div>已解析：<b>{csvRows.length}</b> 筆</div>
    <button className="rpg-btn" disabled={importing || csvRows.length === 0} onClick={importAchievementsToFirestore}>
      {importing ? "匯入中..." : "🚀 一鍵匯入"}
    </button>
    <button
      className="rpg-btn"
      disabled={importing}
      onClick={() => {
        setCsvRows([]);
        setCsvError("");
      }}
    >
      清空
    </button>
  </div>

  {csvRows.length > 0 && (
    <>
      <div style={{ height: 14 }} />
      <div style={{ fontWeight: 700, marginBottom: 8 }}>預覽（前 8 筆）</div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.08)" }}>
            <th style={{ textAlign: "left", padding: 10 }}>成就條件</th>
            <th style={{ textAlign: "left", padding: 10 }}>成就名稱</th>
            <th style={{ textAlign: "left", padding: 10 }}>解鎖稱號</th>
            <th style={{ textAlign: "left", padding: 10 }}>metric</th>
            <th style={{ textAlign: "right", padding: 10 }}>threshold</th>
          </tr>
        </thead>
        <tbody>
          {csvRows.slice(0, 8).map((a) => (
            <tr key={`${a._row}-${a.titleUnlock}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <td style={{ padding: 10 }}>{a.conditionText || "—"}</td>
              <td style={{ padding: 10 }}>{a.name}</td>
              <td style={{ padding: 10, fontWeight: 700 }}>{a.titleUnlock}</td>
              <td style={{ padding: 10 }}>{a.metric}</td>
              <td style={{ padding: 10, textAlign: "right" }}>{a.threshold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )}
</Modal>
    </div>
  );
}