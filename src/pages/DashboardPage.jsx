import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  runTransaction,
} from "firebase/firestore";
import { 
  calcLevelFromXp, 
  calcStudentTotalPower 
} from "../utils/studentStats";
import {
  createChallengeSession,
  abortChallengeSession,
  recordChallengeAnswer,
  completeChallengeSession
} from "../services/challengeService";
import{
  seedDefaultMonsters
}from "../services/monsterService";

// 🏮 藏寶閣商品
import TreasureShop from "../components/TreasureShop";
import { SHOP_ITEMS } from "../data/shopItems"; // 你的資料檔

import Papa from "papaparse";

/** ✅ 通用 Modal：置中 + 背景變暗 + 點背景關閉 */
function Modal({ open, title, onClose, children, width = 860 ,closeOnBackdrop = true}) {
  if (!open) return null;
  return (
    <div
      onMouseDown={
        closeOnBackdrop
          ? onClose
          : undefined
      }
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

function HPBar({ now, max , width = 260}) {
  const safeMax = Math.max(1, Number(max ?? 100));
  const safeNow = Math.max(0, Math.min(safeMax, Number(now ?? safeMax)));
  const pct = Math.max(0, Math.min(100, (safeNow / safeMax) * 100));
  const isDanger = safeNow / safeMax <= 0.2;

  return (
    <div className={isDanger ? "hp-danger" : ""} style={{ width: "100%", maxWidth: width }}>
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
  const [monsters, setMonsters] = useState([]);
  const [monstersLoaded, setMonstersLoaded] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState("");

  const [battle, setBattle] = useState(null);
  const [showBattle, setShowBattle] = useState(false);

  // 目前 checkbox 勾選的學生
  const [raidParticipants, setRaidParticipants] = useState([]);

  // Firestore 中這一次歷練的 session id
  const [challengeSessionId, setChallengeSessionId] = useState(null);

  // 整場歷練中每位學生的答題紀錄
  const [battleRecords, setBattleRecords] = useState({});

  const [isResolvingAnswer, setIsResolvingAnswer] = useState(false);

  // 稱號彈窗
  const [openTitles, setOpenTitles] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [targetStudentId, setTargetStudentId] = useState(null);
  const [targetStudentName, setTargetStudentName] = useState("");
  const [targetUnlockedAchIds, setTargetUnlockedAchIds] = useState(new Set());

  const navigate = useNavigate();

  //戰力榜
  const powerRankList = [...students]
  .filter((s) => s && s.name)
  .sort((a, b) => getStudentDisplayPower(b) - getStudentDisplayPower(a));


  // ===== 成就CSV匯入 =====
  const [openImportAch, setOpenImportAch] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [importing, setImporting] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

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

  useEffect(() => {
    if (!classId) return;

    const monstersRef = collection(
      db,
      "classes",
      classId,
      "monsters"
    );

    const monstersQuery = query(
      monstersRef,
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(
      monstersQuery,
      (snap) => {
        const list = snap.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((monster) => monster.isActive !== false);

        setMonsters(list);
        setMonstersLoaded(true);

        setSelectedMonsterId((current) => {
          if (current) return current;
          return list[0]?.id || "";
        });
      },
      (err) => {
        console.error("monsters listen error:", err);
        setMonstersLoaded(true);
      }
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

  // ===============================
  // 修為增減（答對 / 答錯）
  // - xp / cp 同步增減
  // - level 由 xp 直接推算，只升不降
  // - 升級時每級 hpMax +5，並回滿血
  // ===============================
  async function addXP(id, v) {
    const studentRef = doc(db, "classes", classId, "students", id);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(studentRef);
        if (!snap.exists()) throw new Error("找不到學生資料");

        const s = snap.data() || {};
        const delta = Number(v || 0);

        const oldXp = Number(s.xp || 0);
        const oldCp = Number(s.cp || 0);
        const oldLevel = Number(s.level || 1);
        const oldHpMax = Number(s.hpMax || 100);

        const nextXp = Math.max(0, oldXp + delta);
        const nextCp = Math.max(0, oldCp + delta);

        // 已升過的等級不因修為下降而降級
        const nextLevel = Math.max(oldLevel, calcLevelFromXp(nextXp));
        const levelGain = nextLevel - oldLevel;

        const patch = {
          xp: nextXp,
          cp: nextCp,
          updatedAt: serverTimestamp(),
        };

        if (levelGain > 0) {
          const nextHpMax = oldHpMax + levelGain * 5;
          patch.level = nextLevel;
          patch.hpMax = nextHpMax;
          patch.hpNow = nextHpMax;
        }

        tx.update(studentRef, patch);
      });
    } catch (e) {
      console.error("addXP error:", e);
      alert("修為更新失敗");
    }
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

  // ===== 歷練 =====
  function openRaidModal() {
    setOpenRaid(true);
    setShowBattle(false);
    setBattle(null);
    setRaidParticipants([]);
  }

  function resetRaidState() {
    setShowBattle(false);
    setBattle(null);
    setRaidParticipants([]);
    setBattleRecords({});
    setChallengeSessionId(null);
  }
  // ===============================
  // 🎲 基本機率判定
  // ===============================
  function rollDrop(rate) {
    return Math.random() < rate;
  }

  async function closeRaidModal() {
    // 正在寫入答題資料時先不要關閉
    if (isResolvingAnswer) {
      alert("答題結果處理中，請稍候");
      return;
    }

    // 沒有進行中的歷練，直接關閉
    if (!challengeSessionId) {
      resetRaidState();
      setOpenRaid(false);
      return;
    }

    // 已經建立 session，代表目前有一場歷練正在進行
    const ok = window.confirm(
      "目前歷練尚未結算，關閉後本場歷練將標記為「中止」。確定要離開嗎？"
    );

    if (!ok) return;

    try {
      await abortChallengeSession({
        classId,
        sessionId: challengeSessionId,
      });

      resetRaidState();
      setOpenRaid(false);
    } catch (e) {
      console.error("closeRaidModal error:", e);
      alert("中止歷練失敗，請稍後再試");
    }
  }

  function toggleRaidParticipant(studentDocId) {
    setRaidParticipants((prev) =>
      prev.includes(studentDocId) ? prev.filter((id) => id !== studentDocId) : [...prev, studentDocId]
    );
  }

  async function startRaid() {
    const monster = monsters.find(
      (m) => m.id === selectedMonsterId
    );

    if (!monster) {
      alert("找不到怪物");
      return;
    }

    if (!classId || !user?.uid) {
      alert("班級資料尚未載入完成");
      return;
    }

    try {
      const sessionId = await createChallengeSession({
        classId,
        monster,
        teacherUid: user.uid,
      });

      setChallengeSessionId(sessionId);

      setBattle({
        monster,
        hp: monster.maxHp,
      });

      setShowBattle(true);

      // 這一題目前勾選誰
      setRaidParticipants([]);

      // 新副本清空戰鬥紀錄
      setBattleRecords({});
    } catch (e) {
      console.error("startRaid error:", e);
      alert("建立歷練紀錄失敗");
    }
  }

  function buildNextBattleRecords(records, studentIds, result) {
    const next = { ...records };

    studentIds.forEach((studentId) => {
      const previous = next[studentId] || {
        correctCount: 0,
        wrongCount: 0,
      };

      next[studentId] = {
        correctCount:
          previous.correctCount +
          (result === "correct" ? 1 : 0),

        wrongCount:
          previous.wrongCount +
          (result === "wrong" ? 1 : 0),
      };
    });

    return next;
  }

  async function answerCorrect() {
    if (isResolvingAnswer) return;

    if (!battle || (battle.hp ?? 0) <= 0) {
      return;
    }

    if (raidParticipants.length === 0) {
      alert("請先勾選答題學生");
      return;
    }

    if (!challengeSessionId) {
      alert("歷練場次尚未建立");
      return;
    }

    const selectedStudents = raidParticipants
      .map((studentId) =>
        students.find((student) => student.id === studentId)
      )
      .filter(Boolean);

    if (selectedStudents.length === 0) {
      alert("找不到已勾選的學生資料");
      return;
    }

    // 一個學生造成 10 點傷害
    const damage = selectedStudents.length * 10;

    const nextHp = Math.max(
      0,
      Number(battle.hp ?? 0) - damage
    );

    const nextRecords = buildNextBattleRecords(
      battleRecords,
      raidParticipants,
      "correct"
    );

    try {
      setIsResolvingAnswer(true);

      await recordChallengeAnswer({
        classId,
        sessionId: challengeSessionId,
        students: selectedStudents,
        result: "correct",

        // 曾經參與過的人數
        participantCount: Object.keys(nextRecords).length,
      });

      // Firestore 成功後才更新畫面
      setBattle((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          hp: nextHp,
        };
      });

      setBattleRecords(nextRecords);
    } catch (e) {
      console.error("answerCorrect error:", e);
      alert(e?.message || "答對紀錄更新失敗");
    } finally {
      setIsResolvingAnswer(false);
    }
  }

  async function answerWrong() {
    if (isResolvingAnswer) return;

    if (!battle || (battle.hp ?? 0) <= 0) {
      return;
    }

    if (raidParticipants.length === 0) {
      alert("請先勾選答題學生");
      return;
    }

    if (!challengeSessionId) {
      alert("歷練場次尚未建立");
      return;
    }

    const selectedStudents = raidParticipants
      .map((studentId) =>
        students.find((student) => student.id === studentId)
      )
      .filter(Boolean);

    if (selectedStudents.length === 0) {
      alert("找不到已勾選的學生資料");
      return;
    }

    const nextRecords = buildNextBattleRecords(
      battleRecords,
      raidParticipants,
      "wrong"
    );

    try {
      setIsResolvingAnswer(true);

      await recordChallengeAnswer({
        classId,
        sessionId: challengeSessionId,
        students: selectedStudents,
        result: "wrong",
        participantCount: Object.keys(nextRecords).length,
      });

      setBattleRecords(nextRecords);

    } catch (e) {
      console.error("answerWrong error:", e);
      alert(e?.message || "答錯紀錄更新失敗");
    } finally {
      setIsResolvingAnswer(false);
    }
  }

  // ===============================
  // 🎁 發放歷練獎勵
  // 參與答題的弟子：
  // - 妖丹基礎獎勵 100
  // - 神兵特效可影響妖丹收益 / 掉寶收益
  // - 50% 隕鐵結晶
  // - 40% 鍛兵石
  // - 3% 玄鐵（稀有掉落）
  // ===============================
  async function handlePracticeRewards(participants = []) {
    if (!Array.isArray(participants) || participants.length === 0) {
      alert("沒有可發放獎勵的弟子");
      return;
    }

    const monster = battle?.monster;
    if (!monster) {
      alert("找不到本次歷練怪物資料");
      return;
    }

    try {
      for (const stu of participants) {
        const { classId, studentId, name } = stu;

        if (!classId || !studentId) {
          console.warn("缺少 classId 或 studentId：", stu);
          continue;
        }

        await runTransaction(db, async (tx) => {
          const studentRef = doc(db, "classes", classId, "students", studentId);

          const meteorRef = doc(
            db,
            "classes",
            classId,
            "students",
            studentId,
            "inventory",
            "mat_meteor_crystal"
          );

          const forgeRef = doc(
            db,
            "classes",
            classId,
            "students",
            studentId,
            "inventory",
            "mat_forge_stone"
          );

          const blackIronRef = doc(
            db,
            "classes",
            classId,
            "students",
            studentId,
            "inventory",
            "mat_black_iron"
          );

          // 1) 先讀學生目前值
          const studentSnap = await tx.get(studentRef);
          if (!studentSnap.exists()) throw new Error("找不到學生資料");

          const studentData = studentSnap.data() || {};
          const oldXp = Number(studentData.xp || 0);
          const oldCp = Number(studentData.cp || 0);
          const oldLevel = Number(studentData.level || 1);
          const oldHpMax = Number(studentData.hpMax || 100);
          const coinNow = Number(studentData.coin || 0);

          const nextXp = Math.max(0, oldXp + Number(monster.xpReward || 0));
          const nextCp = Math.max(0, oldCp + Number(monster.cpReward || 0));
          const nextCoin = Math.max(0, coinNow + Number(monster.coinReward || 0));
          const nextLevel = Math.max(oldLevel, calcLevelFromXp(nextXp));
          const levelGain = nextLevel - oldLevel;

          // 加成系統暫停：掉落率固定
          const meteorRate = 0.5;
          const forgeRate = 0.4;
          const blackIronRate = 0.03;

          const dropMeteor = rollDrop(meteorRate);
          const dropForge = rollDrop(forgeRate);
          const dropBlackIron = rollDrop(blackIronRate);

          console.log("掉落判定", {
            name,
            classId,
            studentId,
            monster: monster.name,
            xpReward: monster.xpReward,
            cpReward: monster.cpReward,
            coinReward: monster.coinReward,
            meteorRate,
            forgeRate,
            blackIronRate,
            dropMeteor,
            dropForge,
            dropBlackIron,
          });

          // 2) 只有真的掉落時才讀素材文件
          let meteorSnap = null;
          let forgeSnap = null;
          let blackIronSnap = null;

          if (dropMeteor) meteorSnap = await tx.get(meteorRef);
          if (dropForge) forgeSnap = await tx.get(forgeRef);
          if (dropBlackIron) blackIronSnap = await tx.get(blackIronRef);

          // 3) 一次寫回學生核心數值
          const studentPatch = {
            xp: nextXp,
            cp: nextCp,
            coin: nextCoin,
            updatedAt: serverTimestamp(),
          };

          if (levelGain > 0) {
            const nextHpMax = oldHpMax + levelGain * 5;
            studentPatch.level = nextLevel;
            studentPatch.hpMax = nextHpMax;
            studentPatch.hpNow = nextHpMax;
          }

          tx.update(studentRef, studentPatch);

          if (dropMeteor) {
            if (!meteorSnap.exists()) {
              tx.set(meteorRef, {
                itemId: "mat_meteor_crystal",
                name: "隕鐵結晶",
                category: "weapon",
                itemType: "material",
                icon: "/merchandise/mat_meteor_crystal.png",
                qty: 1,
                acquiredAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              const qtyNow = Number(meteorSnap.data()?.qty || 0);
              tx.update(meteorRef, {
                qty: qtyNow + 1,
                updatedAt: serverTimestamp(),
              });
            }
          }

          if (dropForge) {
            if (!forgeSnap.exists()) {
              tx.set(forgeRef, {
                itemId: "mat_forge_stone",
                name: "鍛兵石",
                category: "weapon",
                itemType: "material",
                icon: "/merchandise/mat_forge_stone.png",
                qty: 1,
                acquiredAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              const qtyNow = Number(forgeSnap.data()?.qty || 0);
              tx.update(forgeRef, {
                qty: qtyNow + 1,
                updatedAt: serverTimestamp(),
              });
            }
          }

          if (dropBlackIron) {
            if (!blackIronSnap.exists()) {
              tx.set(blackIronRef, {
                itemId: "mat_black_iron",
                name: "玄鐵",
                category: "weapon",
                itemType: "material",
                icon: "/merchandise/mat_black_iron.png",
                qty: 1,
                acquiredAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              const qtyNow = Number(blackIronSnap.data()?.qty || 0);
              tx.update(blackIronRef, {
                qty: qtyNow + 1,
                updatedAt: serverTimestamp(),
              });
            }
          }
        });
      }

      // =========================
      // 完成本次歷練紀錄
      // =========================
      if (challengeSessionId) {
        await completeChallengeSession({
          classId,
          sessionId: challengeSessionId,
          participantCount: participants.length,
        });
      }

      // =========================
      // 清除本場前端狀態
      // =========================
      resetRaidState();

      alert("🏆 歷練結算完成！");
    } catch (e) {
      console.error("handlePracticeRewards error:", e);
      alert(e?.message || "發放獎勵失敗");
    }
  }

  async function settleRaid() {
    if (!battle) return;

    if ((battle.hp ?? 0) > 0) {
      alert("尚未擊敗怪物");
      return;
    }

    const participantIds = Object.keys(battleRecords);

    if (participantIds.length === 0) {
      alert("本場沒有參與學生");
      return;
    }

    const participants = participantIds
      .map((studentId) => {
        const student = students.find(
          (s) => s.id === studentId
        );

        if (!student) return null;

        return {
          classId,
          studentId: student.id,
          name: student.name,
        };
      })
      .filter(Boolean);

    await handlePracticeRewards(participants);
  }

  async function resetCurrentRaid() {
    if (isResolvingAnswer) {
      alert("答題結果處理中，請稍候");
      return;
    }

    if (challengeSessionId) {
      const ok = window.confirm(
        "目前歷練尚未結算，重新選擇怪物會中止本場歷練。確定要繼續嗎？"
      );

      if (!ok) return;

      try {
        await abortChallengeSession({
          classId,
          sessionId: challengeSessionId,
        });
      } catch (e) {
        console.error("resetCurrentRaid error:", e);
        alert("中止歷練失敗");
        return;
      }
    }

    resetRaidState();

    // 不關 Modal
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
      alert(`匯入完成 ✅ 共 ${csvRows.length} 筆成就已寫入 `);
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

  // ✅ 數字優先排序（0,01,02...10...；沒有數字的放後面）
  const sortedStudents = useMemo(() => {
    const getNum = (name) => {
      const m = String(name || "").trim().match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : 9999;
    };

    return [...students].sort((a, b) => {
      const an = getNum(a.name);
      const bn = getNum(b.name);
      if (an !== bn) return an - bn;

      // 數字相同或都沒數字：再用名字排序（穩定）
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
    });
  }, [students]);

  const battleRecordList = useMemo(() => {
    return sortedStudents
      .filter((student) => battleRecords[student.id])
      .map((student) => {
        const record = battleRecords[student.id];

        return {
          studentId: student.id,
          name: student.name || student.id,

          level: Number(student.level ?? 1),
          hpNow: Number(student.hpNow ?? 100),
          hpMax: Number(student.hpMax ?? 100),

          correctCount: Number(record.correctCount ?? 0),
          wrongCount: Number(record.wrongCount ?? 0),
        };
      });
  }, [sortedStudents, battleRecords]);

  // achievements 排序：優先用 threshold（若有），沒有就不排序
  const achievementsSorted = useMemo(() => {
    const arr = [...achievements];
    arr.sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999));
    return arr;
  }, [achievements]);

  // ===============================
  // 老師頁顯示 / 排序用總戰力
  // 核心規則：cp + currentPetPower + currentWeaponPower
  // ===============================
  function getStudentDisplayPower(s) {
    return calcStudentTotalPower(s);
  }

  // ===============================
  // 老師模式：手動增加妖丹
  // =============================== 
  function askCoinAmount() {
    const input = window.prompt("請輸入要增加的妖丹數量：");

    if (input === null) return null;

    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("請輸入大於 0 的有效數字");
      return null;
    }

    return amount;
  }
  
  async function handleAddCoin(studentId) {
    const amount = askCoinAmount();

    if (amount === null) return;

    await addCoin(studentId, amount);
  }

  async function addCoinToSelectedStudents() {
    if (selectedStudentIds.size === 0) {
      alert("請先選擇學生");
      return;
    }

    const amount = askCoinAmount();

    if (amount === null) return;

    await Promise.all(
      [...selectedStudentIds].map((id) =>
        addCoin(id, amount)
      )
    );
  }

  // 單一學生勾選 / 取消
  function toggleStudentSelection(id) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  // 全選 / 全取消
  function toggleSelectAllStudents() {
    const allSelected =
      sortedStudents.length > 0 &&
      sortedStudents.every((s) => selectedStudentIds.has(s.id));

    if (allSelected) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(
        new Set(sortedStudents.map((s) => s.id))
      );
    }
  }

  async function addXPToSelectedStudents(v) {
    if (selectedStudentIds.size === 0) {
      alert("請先選擇學生");
      return;
    }

    try {
      await Promise.all(
        [...selectedStudentIds].map((id) => addXP(id, v))
      );
    } catch (e) {
      console.error("多人修為更新失敗:", e);
      alert("部分學生修為更新失敗");
    }
  }

  return (
    <div style={{ width: "min(1400px, 96vw)", margin: "40px auto", fontFamily: "sans-serif" }}>
      <a
        className="feedback-link"
        href="https://glorious-supernova-db3.notion.site/3ea287a1b24e80608ed2c6da85c796ce?pvs=105"
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 意見回饋
      </a>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        
        <div>
          <h2 style={{ margin: 0 }}>宗門名錄（老師模式）</h2>
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            班級代碼：<b>{classCode || "（載入中）"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="rpg-btn" onClick={openRaidModal}>修仙歷練</button>
          <button className="rpg-btn" onClick={() => setOpenRank(true)}>戰力榜</button>
          <button className="rpg-btn" onClick={() => setOpenTreasure(true)}>藏寶閣</button>
          <button className="rpg-btn" onClick={() => setOpenImportAch(true)}>📥 匯入成就</button>
          <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
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
        <button className="rpg-btn sm" onClick={() => addXPToSelectedStudents(10)}>✅ 答對</button>
        <button className="rpg-btn sm" onClick={addCoinToSelectedStudents}>妖丹</button>
      </div>

      {/* 主畫面 table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th style={{ padding: 10 }}>
              <input
                type="checkbox"
                checked={
                  sortedStudents.length > 0 &&
                  sortedStudents.every((s) =>
                    selectedStudentIds.has(s.id)
                  )
                }
                onChange={toggleSelectAllStudents}
              />
            </th>
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
          {sortedStudents.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td align="center">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.has(s.id)}
                  onChange={() => toggleStudentSelection(s.id)}
                />
              </td>
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
              <td align="center"><div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{Number(s.xp ?? 0)}</div></td>
              <td align="center"><div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{Number(s.coin ?? 0)}</div></td>
              <td align="center"><div style={{ fontSize: 18, fontWeight: 800, color: "#ff884d" }}>{getStudentDisplayPower(s)}</div></td>
              <td align="center">
                <button className="rpg-btn sm" onClick={() => addXP(s.id, 10)}>✅ 答對</button>{" "}
                <button className="rpg-btn sm" onClick={() => addXP(s.id, -5)}>❌ 答錯</button>{" "}
                <button className="rpg-btn sm" onClick={() => handleAddCoin(s.id)}>妖丹</button>{" "}
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
      <Modal 
        open={openRaid}
        title="⚔️ 歷練視窗"
        onClose={closeRaidModal}
        width={1564}
        closeOnBackdrop={false}
      >
        {/* 上方工具列 */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            paddingBottom: 30,
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ opacity: 0.9 }}>👹 選擇怪物：</div>

          {monstersLoaded && monsters.length === 0 ? (
            <button
              className="rpg-btn"
              onClick={async () => {
                try {
                  await seedDefaultMonsters(classId);
                  alert("怪物資料建立完成");
                } catch (e) {
                  console.error("seedDefaultMonsters error:", e);
                  alert("建立預設怪物失敗");
                }
              }}
            >
              建立預設怪物
            </button>
          ) : (
            <select
              value={selectedMonsterId}
              onChange={(e) =>
                setSelectedMonsterId(e.target.value)
              }
              disabled={monsters.length === 0}
              style={{
                padding: 8,
                minWidth: 220,
              }}
            >
              {monsters.map((monster) => (
                <option
                  key={monster.id}
                  value={monster.id}
                >
                  {monster.name}
                  （HP {monster.maxHp}）
                </option>
              ))}
            </select>
          )}
          {!showBattle ? (
            <button className="rpg-btn" onClick={startRaid}>開始歷練</button>
          ) : (
            <button
              className="rpg-btn"
              onClick={resetCurrentRaid}
            >
              重新選怪物
            </button>
          )}

          <div
            style={{
              marginLeft: "auto",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            本場參與：
            <strong style={{ marginLeft: 4 }}>
              {battleRecordList.length}
            </strong>
            人
          </div>
        </div>

        <div style={{ height: 30 }} />

        {/* ================= 作戰畫面 ================= */}
        {showBattle && battle?.monster ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.15fr 1fr",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {/* ================= 左：怪物狀態 ================= */}
            <div
              style={{
                padding: 18,
                border: "1px solid rgba(218,185,120,0.25)",
                borderRadius: 12,
                minHeight: 500,
              }}
            >
              <div>
                {/* 怪物名稱 */}
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  👹 {battle.monster.name}
                </div>

                {/* 怪物血量 */}
                <HPBar
                  now={battle.hp ?? 0}
                  max={battle.monster.maxHp ?? 100}
                />
                
                {/* 怪物圖片 */}
                <div
                  style={{
                    marginTop: 25,
                    height: 330,

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",

                    borderRadius: 12,

                    background:
                      "rgba(255,255,255,0.025)",
                  }}
                >
                  <img
                    src={battle.monster.imagePath}
                    alt={battle.monster.name}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ================= 中：學生選擇 + 答題操作 ================= */}
            <div
              style={{
                padding: 18,
                border: "1px solid rgba(218,185,120,0.25)",
                borderRadius: 12,
                minHeight: 500,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                }}
              >
                🧑 弟子參戰名單
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                勾選本次作答的弟子，可一次選擇多人
              </div>
              
              {/* =================學生checkbox================= */}
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  maxHeight: 370,
                  overflow: "auto",
                  paddingRight: 6,
                }}
              >
                {sortedStudents.map((student) => {
                  const checked = raidParticipants.includes(student.id);

                  return (
                    <label
                      key={student.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: checked
                          ? "rgba(255,215,0,0.08)"
                          : "rgba(255,255,255,0.025)",
                        border: checked
                          ? "1px solid rgba(218,185,120,0.55)"
                          : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleRaidParticipant(student.id)
                        }
                      />

                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                        }}
                      >
                        {student.name}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* =================答題操作================= */}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    opacity: 0.8,
                    marginBottom: 12,
                  }}
                >
                  已選擇{" "}
                  <strong>
                    {raidParticipants.length}
                  </strong>{" "}
                  位弟子
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  <button
                    className="rpg-btn"
                    onClick={answerCorrect}
                    disabled={
                      isResolvingAnswer ||
                      raidParticipants.length === 0
                    }
                    style={{
                      minWidth: 130,
                      fontSize: 18,
                      padding: "12px 20px",
                    }}
                  >
                    ✅ 答對
                  </button>

                  <button
                    className="rpg-btn danger"
                    onClick={answerWrong}
                    disabled={
                      isResolvingAnswer ||
                      raidParticipants.length === 0
                    }
                    style={{
                      minWidth: 130,
                      fontSize: 18,
                      padding: "12px 20px",
                    }}
                  >
                    ❌ 答錯
                  </button>
                </div>

                {raidParticipants.length > 1 && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 10,

                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    答對將造成{" "}
                    <strong>
                      {raidParticipants.length * 10}
                    </strong>{" "}
                    點傷害
                  </div>
                )}
              </div>
            </div>

            {/* ================= 右：戰鬥紀錄 ================= */}
            <div
              style={{
                padding: 18,
                border: "1px solid rgba(218,185,120,0.25)",
                borderRadius: 12,
                minHeight: 500,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 70px 70px",
                  alignItems: "center",
                  columnGap: 8,
                  paddingBottom: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  ⚔️ 戰鬥紀錄
                </div>

                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  ⭕ 答對
                </div>

                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  ❌ 答錯
                </div>
              </div>

              {/* =================戰鬥紀錄列表================= */}

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: 385,
                  overflow: "auto",
                  paddingRight: 4,
                }}
              >
                {battleRecordList.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      opacity: 0.6,
                    }}
                  >
                    尚無戰鬥紀錄
                  </div>
                ) : (
                  battleRecordList.map((record) => (
                    <div
                      key={record.studentId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 55px 55px",
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.035)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >

                      {/* 學生資料 */}
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center"}}>
                          <strong> {record.name} </strong>
                          <span style={{ fontSize: 12, opacity: 0.7 }}> Lv {record.level} </span>
                        </div>
                        <HPBar now={record.hpNow} max={record.hpMax} width={180}/>
                      </div>

                      {/* 答對 */}
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#8ce99a",
                        }}
                      >
                        {record.correctCount}
                      </div>

                      {/* 答錯 */}
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#ff8787",
                        }}
                      >
                        {record.wrongCount}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* =================結算================= */}

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {(battle.hp ?? 0) <= 0 ? (
                  <>
                    <div
                      style={{
                        textAlign: "center",
                        marginBottom: 10,
                        color: "#ffd43b",
                        fontWeight: 700,
                      }}
                    >
                      🎉 {battle.monster.name} 已擊敗！
                    </div>

                    <button
                      className="rpg-btn"
                      style={{
                        width: "100%",
                        padding: 13,
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                      onClick={settleRaid}
                    >
                      🏆 結算
                    </button>
                  </>
                ) : (
                  <button
                    className="rpg-btn"
                    disabled
                    style={{
                      width: "100%",
                      opacity: 0.4,
                    }}
                  >
                    🏆 擊敗怪物後結算
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            選擇怪物後按「開始歷練」
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
            {powerRankList.map((s, idx) => {
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
                        textShadow: "0 0 6px rgba(255,215,0,0.6)",
                      }}
                    >
                      {idx + 1}
                    </div>
                  </td>

                  {/* 弟子 */}
                  <td style={{ padding: 12 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
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

                      {s.activeTitle ? (
                        <span
                          style={{
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
                      ) : null}
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
                      {getStudentDisplayPower(s)}
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
          <div style={{ opacity: 0.9 }}>目前 成就系統 尚無資料（請先匯入/建立）。</div>
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
        title="📥 一鍵匯入 成就系統（CSV）"
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
          2) 上傳 資料 後會預覽筆數<br />
          3) 按「一鍵匯入」<br />
          4) 完成
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