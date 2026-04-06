import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  setDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

import TreasureShop from "../components/TreasureShop";
import { SHOP_ITEMS } from "../data/shopItems";
import { PETS_MASTER, createPetDoc, calcPetPower } from "../data/pets";
import {
  WEAPONS_MASTER,
  calcWeaponPower,
  createWeaponInventoryDoc,
  calcFinalWeaponPower,
  calcFinalWeaponXpBonus,
  getWeaponIconByStage,
  EFFECT_QUALITY_LABEL,
  EFFECT_TYPE_LABEL,
  rollWeaponEffect,
  mergeWeaponEffects,
  calcPowerBoostExtra,
  calcCultivationBoostExtra,
  getEquippedWeaponEffectSummary,
} from "../data/weapons";
import BackpackModal from "../components/BackpackModal";
import PetHatchModal from "../components/PetHatchModal";

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
  const [meIndex, setMeIndex] = useState(null);
  const [student, setStudent] = useState(null);
  const [studentPath, setStudentPath] = useState(null);

  const [openAchModal, setOpenAchModal] = useState(false);
  const [achievements, setAchievements] = useState([]);

  const [openTreasure, setOpenTreasure] = useState(false);

  const [openBag, setOpenBag] = useState(false);
  const [bagItems, setBagItems] = useState([]);

  const [openPetModal, setOpenPetModal] = useState(false);
  const [openWeaponModal, setOpenWeaponModal] = useState(false);
  
  // ===============================
// 性別選擇
// ===============================
const [openGenderModal, setOpenGenderModal] = useState(false);

  const [openEggModal, setOpenEggModal] = useState(false);
  const eggRewardRunningRef = useRef(false);
  const eggModalShownRef = useRef(false);

  const [petList, setPetList] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [petTab, setPetTab] = useState("detail");

  const navigate = useNavigate();

  const classId = studentPath?.classId || null;
  const studentId = studentPath?.studentId || null;

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

      const usnap = await getDoc(doc(db, "users", u.uid));
      if (!usnap.exists()) {
        setMsg("尚未建立學生索引（users/{uid}）。請回學生登入頁完成註冊/認領。");
        return;
      }

      const ud = usnap.data();
      setMeIndex(ud);

      if (ud.role !== "student") {
        setMsg("此帳號不是學生身分。請用學生帳號登入。");
        return;
      }

      if (!ud.classId || !ud.studentId) {
        setMsg("尚未加入班級（缺 classId / studentId）。請回學生登入頁完成註冊/認領。");
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
    id: d.id,
    name: data.name || "",
    category: data.category || "card",
    itemType: data.itemType || "",
    icon: data.icon || "",
    qty: Number(data.qty || 0),

    // 靈獸蛋相關
    feedCount: Number(data.feedCount || 0),
    hatched: Boolean(data.hatched || false),
    hatchedTo: data.hatchedTo || "",
    activated: Boolean(data.activated || false),

    // 神兵 / 材料相關
    requiredLevel: Number(data.requiredLevel || 1),
    baseHp: Number(data.baseHp || 0),
    baseAtk: Number(data.baseAtk || 0),
    baseSpd: Number(data.baseSpd || 0),
    xpBonus: Number(data.xpBonus || 0),
    forgeLevel: Number(data.forgeLevel || 1),
    refineStage: Number(data.refineStage || 1),
    bonusPower: Number(data.bonusPower || 0),
    bonusXp: Number(data.bonusXp || 0),
    equipped: Boolean(data.equipped || false),
    extraEffects: Array.isArray(data.extraEffects) ? data.extraEffects : [],
    skillName: data.skillName || "",
    skillDesc: data.skillDesc || "",
  };
});

setBagItems(arr.filter((x) => x.qty > 0));

        setBagItems(arr.filter((x) => x.qty > 0));
      },
      (err) => console.error("inventory listen error:", err)
    );

    return () => unsub();
  }, [studentPath?.classId, studentPath?.studentId]);

  useEffect(() => {
    if (!studentPath?.classId || !studentPath?.studentId) return;

    const petCol = collection(
      db,
      "classes",
      studentPath.classId,
      "students",
      studentPath.studentId,
      "pets"
    );

    const unsub = onSnapshot(
      petCol,
      (snap) => {
        const arr = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            petId: data.petId || d.id,
            name: data.name || "",
            icon: data.icon || "",
            level: Number(data.level || 1),
            exp: Number(data.exp || 0),
            star: Number(data.star || 1),
            hp: Number(data.hp || 0),
            atk: Number(data.atk || 0),
            spd: Number(data.spd || 0),
            passive: data.passive || "",
            skillName: data.skillName || "",
            skillDesc: data.skillDesc || "",
            owned: Boolean(data.owned || false),
            equipped: Boolean(data.equipped || false),
          };
        });

        setPetList(arr);

        if (arr.length > 0) {
          setSelectedPetId((prev) => prev || arr[0].petId);
        } else {
          setSelectedPetId("");
        }
      },
      (err) => console.error("pets listen error:", err)
    );

    return () => unsub();
  }, [studentPath?.classId, studentPath?.studentId]);

  useEffect(() => {
    if (!studentPath?.classId || !studentPath?.studentId) return;
    if (!student) return;

    const lv = Number(student.level || 0);
    if (lv < 5) return;
    if (student.eggRewardClaimed) return;
    if (eggModalShownRef.current) return;
    if (eggRewardRunningRef.current) return;

    eggRewardRunningRef.current = true;
    eggModalShownRef.current = true;
    setOpenEggModal(true);
    eggRewardRunningRef.current = false;
  }, [student?.level, student?.eggRewardClaimed, studentPath?.classId, studentPath?.studentId]);

  // ===============================
// 第一次登入：若尚未選 gender，跳出性別選擇
// ===============================
useEffect(() => {
  if (!student) return;

  // gender 尚未設定時才開啟
  if (!student.gender) {
    setOpenGenderModal(true);
  } else {
    setOpenGenderModal(false);
  }
}, [student]);

  async function acceptEggReward() {
    if (!studentPath?.classId || !studentPath?.studentId) return;

    const sRef = doc(db, "classes", studentPath.classId, "students", studentPath.studentId);
    const eggRef = doc(db, "classes", studentPath.classId, "students", studentPath.studentId, "inventory", "egg_001");

    try {
      await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(sRef);
        const eggSnap = await tx.get(eggRef);

        if (!sSnap.exists()) throw new Error("找不到學生資料");

        const sData = sSnap.data() || {};
        if (sData.eggRewardClaimed) return;

        if (!eggSnap.exists()) {
          tx.set(eggRef, {
            itemId: "egg_001",
            name: "靈獸蛋",
            category: "pet",
            icon: "/merchandise/egg_001.png",
            qty: 1,
            feedCount: 0,
            hatched: false,
            acquiredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const oldQty = Number(eggSnap.data()?.qty || 0);
          tx.update(eggRef, {
            qty: oldQty + 1,
            updatedAt: serverTimestamp(),
          });
        }

        tx.update(sRef, {
          eggRewardClaimed: true,
          eggRewardClaimedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setOpenEggModal(false);
    } catch (e) {
      console.error("acceptEggReward error:", e);
      alert(e?.message || "收下失敗");
    }
  }

  async function handleUseItem(item) {
    if (!studentPath?.classId || !studentPath?.studentId) return;
    if (item.id !== "egg_001") return;

    const studentRef = doc(db, "classes", studentPath.classId, "students", studentPath.studentId);
    const eggRef = doc(db, "classes", studentPath.classId, "students", studentPath.studentId, "inventory", "egg_001");

    try {
      await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(studentRef);
        const eggSnap = await tx.get(eggRef);

        if (!sSnap.exists()) throw new Error("找不到學生資料");
        if (!eggSnap.exists()) throw new Error("找不到靈獸蛋");

        const sData = sSnap.data() || {};
        const eggData = eggSnap.data() || {};
        const eggQty = Number(eggData.qty || 0);

        if (sData.petSystemUnlocked) throw new Error("靈獸系統已開啟");
        if (eggQty <= 0) throw new Error("靈獸蛋數量不足");

        tx.update(eggRef, {
          activated: true,
          updatedAt: serverTimestamp(),
        });

        tx.update(studentRef, {
          petSystemUnlocked: true,
          petSystemUnlockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      alert("🎉 已使用靈獸蛋，靈獸系統正式開啟！");
      setOpenBag(false);
      setOpenPetModal(true);
    } catch (e) {
      console.error("handleUseItem error:", e);
      alert(e?.message || "使用失敗");
    }
  }

  // ===============================
// 第一次選擇性別（只能選一次）
// ===============================
async function chooseGender(genderValue) {
  if (!studentPath?.classId || !studentPath?.studentId) return;

  const sRef = doc(
    db,
    "classes",
    studentPath.classId,
    "students",
    studentPath.studentId
  );

  try {
    await updateDoc(sRef, {
      gender: genderValue, // "male" 或 "female"
      updatedAt: serverTimestamp(),
    });

    setOpenGenderModal(false);
  } catch (e) {
    console.error("chooseGender error:", e);
    alert(e?.message || "設定性別失敗");
  }
}

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

  async function handleStudentBuy({ tabKey, item, price }) {
    if (!studentPath?.classId || !studentPath?.studentId) {
      alert("尚未取得 studentPath");
      return;
    }

    const sRef = doc(db, "classes", studentPath.classId, "students", studentPath.studentId);
    const inventoryRef = doc(
      db,
      "classes",
      studentPath.classId,
      "students",
      studentPath.studentId,
      "inventory",
      item.id
    );

    const isPetItem = item.itemType === "pet";
const isPetShardItem = item.itemType === "pet_shard";
const isWeaponItem = item.itemType === "weapon";

    const category =
      item.id === "mat_lingbao_001" ||
      item.id === "mat_lingbao_002" ||
      item.id === "mat_lingbao_003"
        ? "pet"
        : tabKey === "pet"
        ? "pet"
        : tabKey === "weapon"
        ? "weapon"
        : tabKey === "privilege"
        ? "card"
        : "card";

    try {
      await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(sRef);
        if (!sSnap.exists()) throw new Error("找不到學生資料");

        const sData = sSnap.data() || {};
        const coinNow = Number(sData.coin || 0);
        const cost = Number(price || 0);

        if (cost <= 0) throw new Error("商品金額異常");
        if (coinNow < cost) throw new Error("妖丹不足，無法購買");

        // 1) 靈寵本體：直接進 pets
        if (isPetItem) {
          const petRef = doc(
            db,
            "classes",
            studentPath.classId,
            "students",
            studentPath.studentId,
            "pets",
            item.id
          );
          const petSnap = await tx.get(petRef);

          const master = PETS_MASTER[item.id];
          if (!master) throw new Error("找不到靈寵主資料");

          tx.update(sRef, {
            coin: coinNow - cost,
            updatedAt: serverTimestamp(),
          });

          if (!petSnap.exists()) {
            tx.set(petRef, {
              ...createPetDoc(master),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // 已有同隻 → 改給通用靈寵碎片
            const oldPetShard = Number(sData.petShard || 0);
            tx.update(sRef, {
              petShard: oldPetShard + 1,
              updatedAt: serverTimestamp(),
            });
          }

          return;
        }

        // 2) 通用靈寵碎片：直接加到 student.petShard
        if (isPetShardItem) {
          const oldPetShard = Number(sData.petShard || 0);

          tx.update(sRef, {
            coin: coinNow - cost,
            petShard: oldPetShard + 1,
            updatedAt: serverTimestamp(),
          });

          return;
        }

        // 3) 神兵 / 其他商品：進 inventory
const invSnap = await tx.get(inventoryRef);

tx.update(sRef, {
  coin: coinNow - cost,
  updatedAt: serverTimestamp(),
});

// ===============================
// 神兵：寫入完整基礎詳情到背包
// ===============================
if (isWeaponItem) {
  const master = WEAPONS_MASTER[item.id];
  if (!master) throw new Error("找不到神兵主資料");

  if (!invSnap.exists()) {
    tx.set(inventoryRef, {
      ...createWeaponInventoryDoc(master),
      acquiredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const oldQty = Number(invSnap.data()?.qty || 0);
    tx.update(inventoryRef, {
      qty: oldQty + 1,
      updatedAt: serverTimestamp(),
    });
  }

  return;
}

// ===============================
// 其他一般商品：進 inventory
// ===============================
if (!invSnap.exists()) {
  const safeIcon = String(item.icon || "");
  const iconToStore = safeIcon.startsWith("/") ? safeIcon : "";

  tx.set(inventoryRef, {
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
  tx.update(inventoryRef, {
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

  // ===============================
// 依照 inventory 裡的神兵資料，重算學生主檔的神兵摘要
// ===============================
function rebuildEquippedWeaponsSummaryFromInventory(inventoryDocs = [], oldEquippedWeapons = []) {
  const oldMap = new Map(
    (Array.isArray(oldEquippedWeapons) ? oldEquippedWeapons : []).map((w) => [w.weaponId, w])
  );

  const nextEquippedWeapons = inventoryDocs
  .filter((w) => Boolean(w?.equipped))
  .map((w) => ({
    weaponId: w.itemId || w.id || "",
    name: w.name || "",
    icon: getWeaponIconByStage(w.itemId || w.id || "", Number(w.refineStage || 1)),
    power: calcFinalWeaponPower(w),
    xpBonus: calcFinalWeaponXpBonus(w),
  }));

  const totalWeaponPower = nextEquippedWeapons.reduce(
    (sum, w) => sum + Number(w?.power || 0),
    0
  );

  const totalWeaponXpBonus = nextEquippedWeapons.reduce(
    (sum, w) => sum + Number(w?.xpBonus || 0),
    0
  );

  return {
    equippedWeapons: nextEquippedWeapons,
    currentWeaponPower: totalWeaponPower,
    currentWeaponXpBonus: totalWeaponXpBonus,
    currentWeaponId: nextEquippedWeapons[0]?.weaponId || "",
    currentWeaponName: nextEquippedWeapons.map((w) => w.name).join("、"),
    currentWeaponIcon: nextEquippedWeapons[0]?.icon || "",
  };
}

// ===============================
// 🔨 鍛造神兵
// 消耗：鍛兵石 x30、妖丹 300
// 效果：forgeLevel +1（最高30）、bonusPower +3、bonusXp +1
// ===============================
async function handleForgeWeapon() {
  if (!studentPath?.classId || !studentPath?.studentId) {
    alert("尚未取得 studentPath");
    return;
  }

  if (!selectedWeapon) {
    alert("請先選擇一把神兵");
    return;
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  const studentRef = doc(db, "classes", classId, "students", studentId);
  const weaponRef = doc(
    db,
    "classes",
    classId,
    "students",
    studentId,
    "inventory",
    selectedWeapon.id
  );
  const forgeStoneRef = doc(
    db,
    "classes",
    classId,
    "students",
    studentId,
    "inventory",
    "mat_forge_stone"
  );

  try {
    await runTransaction(db, async (tx) => {
      const studentSnap = await tx.get(studentRef);
      const weaponSnap = await tx.get(weaponRef);
      const forgeStoneSnap = await tx.get(forgeStoneRef);

      if (!studentSnap.exists()) throw new Error("找不到學生資料");
      if (!weaponSnap.exists()) throw new Error("找不到神兵資料");
      if (!forgeStoneSnap.exists()) throw new Error("鍛兵石不足");

      const studentData = studentSnap.data() || {};
      const weaponData = weaponSnap.data() || {};
      const forgeStoneData = forgeStoneSnap.data() || {};

      const coinNow = Number(studentData.coin || 0);
      const forgeStoneQtyNow = Number(forgeStoneData.qty || 0);
      const forgeLevelNow = Number(weaponData.forgeLevel || 1);
      const bonusPowerNow = Number(weaponData.bonusPower || 0);
      const bonusXpNow = Number(weaponData.bonusXp || 0);

      if (forgeLevelNow >= 30) throw new Error("此神兵已達鍛造最高等級（Lv30）");
      if (forgeStoneQtyNow < 30) throw new Error("鍛兵石不足（需 30 個）");
      if (coinNow < 300) throw new Error("妖丹不足（需 300）");

      const nextForgeLevel = forgeLevelNow + 1;
      const nextBonusPower = bonusPowerNow + 3;
      const nextBonusXp = bonusXpNow + 1;

      // 1) 扣學生妖丹
      tx.update(studentRef, {
        coin: coinNow - 300,
        updatedAt: serverTimestamp(),
      });

      // 2) 扣鍛兵石
      tx.update(forgeStoneRef, {
        qty: forgeStoneQtyNow - 30,
        updatedAt: serverTimestamp(),
      });

      // 3) 更新神兵本體
      tx.update(weaponRef, {
        forgeLevel: nextForgeLevel,
        bonusPower: nextBonusPower,
        bonusXp: nextBonusXp,
        updatedAt: serverTimestamp(),
      });

      // 4) 如果這把神兵有裝備，要同步重算學生主檔的裝備摘要
      if (Boolean(weaponData.equipped)) {
        // 這裡只靠目前 bagItems 會有舊資料，所以手動組一份 inventoryWeapons
        const inventoryWeapons = allWeapons.map((w) => {
          if (w.id === selectedWeapon.id) {
            return {
              ...w,
              itemId: w.id,
              forgeLevel: nextForgeLevel,
              bonusPower: nextBonusPower,
              bonusXp: nextBonusXp,
            };
          }
          return {
            ...w,
            itemId: w.id,
          };
        });

        const nextSummary = rebuildEquippedWeaponsSummaryFromInventory(
          inventoryWeapons,
          studentData.equippedWeapons || []
        );

        tx.update(studentRef, {
          equippedWeapons: nextSummary.equippedWeapons,
          currentWeaponPower: nextSummary.currentWeaponPower,
          currentWeaponXpBonus: nextSummary.currentWeaponXpBonus,
          currentWeaponId: nextSummary.currentWeaponId,
          currentWeaponName: nextSummary.currentWeaponName,
          currentWeaponIcon: nextSummary.currentWeaponIcon,
          updatedAt: serverTimestamp(),
        });
      }
    });

    alert(`🔨 鍛造成功！${selectedWeapon.name} 已提升至 Lv.${selectedWeaponForgeLevel + 1}`);
setSelectedWeaponId(selectedWeapon.id);
  } catch (e) {
    console.error("handleForgeWeapon error:", e);
    alert(e?.message || "鍛造失敗");
  }
}

// ===============================
// ✨ 精煉神兵
// 消耗：玄鐵 x10、妖丹 1000
// 效果：refineStage +1（最高3）
// 若已裝備，同步重算學生主檔神兵摘要
// ===============================
async function handleRefineWeapon() {
  if (!studentPath?.classId || !studentPath?.studentId) {
    alert("尚未取得 studentPath");
    return;
  }

  if (!selectedWeapon) {
    alert("請先選擇一把神兵");
    return;
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  const studentRef = doc(db, "classes", classId, "students", studentId);
  const weaponRef = doc(
    db,
    "classes",
    classId,
    "students",
    studentId,
    "inventory",
    selectedWeapon.id
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

  try {
    await runTransaction(db, async (tx) => {
      const studentSnap = await tx.get(studentRef);
      const weaponSnap = await tx.get(weaponRef);
      const blackIronSnap = await tx.get(blackIronRef);

      if (!studentSnap.exists()) throw new Error("找不到學生資料");
      if (!weaponSnap.exists()) throw new Error("找不到神兵資料");
      if (!blackIronSnap.exists()) throw new Error("玄鐵不足");

      const studentData = studentSnap.data() || {};
      const weaponData = weaponSnap.data() || {};
      const blackIronData = blackIronSnap.data() || {};

      const coinNow = Number(studentData.coin || 0);
      const blackIronQtyNow = Number(blackIronData.qty || 0);
      const refineStageNow = Number(weaponData.refineStage || 1);

      if (refineStageNow >= 3) throw new Error("此神兵已達最高精煉階級（3階）");
      if (blackIronQtyNow < 10) throw new Error("玄鐵不足（需 10 個）");
      if (coinNow < 1000) throw new Error("妖丹不足（需 1000）");

      const nextRefineStage = refineStageNow + 1;

      // 1) 扣學生妖丹
      tx.update(studentRef, {
        coin: coinNow - 1000,
        updatedAt: serverTimestamp(),
      });

      // 2) 扣玄鐵
      tx.update(blackIronRef, {
        qty: blackIronQtyNow - 10,
        updatedAt: serverTimestamp(),
      });

      // 3) 更新神兵本體
      tx.update(weaponRef, {
        refineStage: nextRefineStage,
        updatedAt: serverTimestamp(),
      });

      // 4) 如果這把神兵已裝備，同步重算學生主檔摘要
      if (Boolean(weaponData.equipped)) {
        const inventoryWeapons = allWeapons.map((w) => {
          if (w.id === selectedWeapon.id) {
            return {
              ...w,
              itemId: w.id,
              refineStage: nextRefineStage,
            };
          }
          return {
            ...w,
            itemId: w.id,
          };
        });

        const nextSummary = rebuildEquippedWeaponsSummaryFromInventory(
          inventoryWeapons,
          studentData.equippedWeapons || []
        );

        tx.update(studentRef, {
          equippedWeapons: nextSummary.equippedWeapons,
          currentWeaponPower: nextSummary.currentWeaponPower,
          currentWeaponXpBonus: nextSummary.currentWeaponXpBonus,
          currentWeaponId: nextSummary.currentWeaponId,
          currentWeaponName: nextSummary.currentWeaponName,
          currentWeaponIcon: nextSummary.currentWeaponIcon,
          updatedAt: serverTimestamp(),
        });
      }
    });

    alert(`✨ 精煉成功！${selectedWeapon.name} 已提升至 ${selectedWeaponRefineStage + 1} 階`);
  } catch (e) {
    console.error("handleRefineWeapon error:", e);
    alert(e?.message || "精煉失敗");
  }
}

// ===============================
// 🎲 洗練特效
// 消耗：玄鐵 x5、妖丹 300
// 效果：隨機產生 1 條特效，最多 2 條
// 自動刪除低品質、保留高品質
// 若已裝備，同步重算學生主檔神兵摘要
// ===============================
async function handleRollWeaponEffect() {
  if (!studentPath?.classId || !studentPath?.studentId) {
    alert("尚未取得 studentPath");
    return;
  }

  if (!selectedWeapon) {
    alert("請先選擇一把神兵");
    return;
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  const studentRef = doc(db, "classes", classId, "students", studentId);
  const weaponRef = doc(
    db,
    "classes",
    classId,
    "students",
    studentId,
    "inventory",
    selectedWeapon.id
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

  try {
    await runTransaction(db, async (tx) => {
      const studentSnap = await tx.get(studentRef);
      const weaponSnap = await tx.get(weaponRef);
      const blackIronSnap = await tx.get(blackIronRef);

      if (!studentSnap.exists()) throw new Error("找不到學生資料");
      if (!weaponSnap.exists()) throw new Error("找不到神兵資料");
      if (!blackIronSnap.exists()) throw new Error("玄鐵不足");

      const studentData = studentSnap.data() || {};
      const weaponData = weaponSnap.data() || {};
      const blackIronData = blackIronSnap.data() || {};

      const coinNow = Number(studentData.coin || 0);
      const blackIronQtyNow = Number(blackIronData.qty || 0);
      const oldEffects = Array.isArray(weaponData.extraEffects) ? weaponData.extraEffects : [];

      if (blackIronQtyNow < 5) throw new Error("玄鐵不足（需 5 個）");
      if (coinNow < 300) throw new Error("妖丹不足（需 300）");

      const newEffect = rollWeaponEffect();
      const nextEffects = mergeWeaponEffects(oldEffects, newEffect);

      // 1) 扣妖丹
      tx.update(studentRef, {
        coin: coinNow - 300,
        updatedAt: serverTimestamp(),
      });

      // 2) 扣玄鐵
      tx.update(blackIronRef, {
        qty: blackIronQtyNow - 5,
        updatedAt: serverTimestamp(),
      });

      // 3) 寫回神兵特效
      tx.update(weaponRef, {
        extraEffects: nextEffects,
        updatedAt: serverTimestamp(),
      });

      // 4) 如果這把神兵已裝備，同步刷新學生主檔摘要
      // 目前特效不直接影響 currentWeaponPower/currentWeaponXpBonus
      // 但保留同步流程，之後若特效要影響數值可直接擴充
      if (Boolean(weaponData.equipped)) {
        const inventoryWeapons = allWeapons.map((w) => {
          if (w.id === selectedWeapon.id) {
            return {
              ...w,
              itemId: w.id,
              extraEffects: nextEffects,
            };
          }
          return {
            ...w,
            itemId: w.id,
          };
        });

        const nextSummary = rebuildEquippedWeaponsSummaryFromInventory(
          inventoryWeapons,
          studentData.equippedWeapons || []
        );

        tx.update(studentRef, {
          equippedWeapons: nextSummary.equippedWeapons,
          currentWeaponPower: nextSummary.currentWeaponPower,
          currentWeaponXpBonus: nextSummary.currentWeaponXpBonus,
          currentWeaponId: nextSummary.currentWeaponId,
          currentWeaponName: nextSummary.currentWeaponName,
          currentWeaponIcon: nextSummary.currentWeaponIcon,
          updatedAt: serverTimestamp(),
        });
      }
    });

    alert("🎲 洗練成功！已獲得新的特殊效果");
  } catch (e) {
    console.error("handleRollWeaponEffect error:", e);
    alert(e?.message || "洗練失敗");
  }
}

// ===============================
// ⚗️ 融合玄鐵
// 消耗：隕鐵結晶 x25
// 產出：玄鐵 x1
// ===============================
async function handleMergeBlackIron() {
  if (!studentPath?.classId || !studentPath?.studentId) {
    alert("尚未取得 studentPath");
    return;
  }

  const classId = studentPath.classId;
  const studentId = studentPath.studentId;

  const meteorCrystalRef = doc(
    db,
    "classes",
    classId,
    "students",
    studentId,
    "inventory",
    "mat_meteor_crystal"
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

  try {
    await runTransaction(db, async (tx) => {
      const meteorSnap = await tx.get(meteorCrystalRef);
      const blackIronSnap = await tx.get(blackIronRef);

      if (!meteorSnap.exists()) throw new Error("隕鐵結晶不足");

      const meteorData = meteorSnap.data() || {};
      const meteorQtyNow = Number(meteorData.qty || 0);

      if (meteorQtyNow < 25) {
        throw new Error("隕鐵結晶不足（需 25 個）");
      }

      // 1) 扣除隕鐵結晶
      tx.update(meteorCrystalRef, {
        qty: meteorQtyNow - 25,
        updatedAt: serverTimestamp(),
      });

      // 2) 增加玄鐵
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
        const blackIronData = blackIronSnap.data() || {};
        const blackIronQtyNow = Number(blackIronData.qty || 0);

        tx.update(blackIronRef, {
          qty: blackIronQtyNow + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });

    alert("⚗️ 融合成功！獲得 1 個玄鐵");
  } catch (e) {
    console.error("handleMergeBlackIron error:", e);
    alert(e?.message || "融合失敗");
  }
}

  const selectedPet = useMemo(() => {
    return petList.find((p) => p.petId === selectedPetId) || petList[0] || null;
  }, [petList, selectedPetId]);

const [weaponTab, setWeaponTab] = useState("overview");
const [selectedWeaponId, setSelectedWeaponId] = useState("");
const [weaponSubTab, setWeaponSubTab] = useState("forge"); // forge / refine / merge / effect



// ===============================
// ⚔️ 背包神兵 / 神兵材料
// ===============================
const allWeapons = (Array.isArray(bagItems) ? bagItems : []).filter(
  (x) => x?.category === "weapon" && x?.itemType === "weapon"
);

const forgeStoneQty = Number(
  bagItems.find((x) => x?.id === "mat_forge_stone")?.qty || 0
);

const meteorCrystalQty = Number(
  bagItems.find((x) => x?.id === "mat_meteor_crystal")?.qty || 0
);

const blackIronQty = Number(
  bagItems.find((x) => x?.id === "mat_black_iron")?.qty || 0
);

// ===============================
// 目前已裝備神兵摘要（student 主檔）
// ===============================
const equippedWeapons = Array.isArray(student?.equippedWeapons)
  ? student.equippedWeapons
  : [];

// ===============================
// 目前已裝備武器（完整資料版，含 extraEffects）
// ===============================
const equippedWeaponIds = equippedWeapons.map((w) => w.weaponId);

const equippedWeaponDocs = allWeapons.filter((w) =>
  equippedWeaponIds.includes(w.id)
);

// ===============================
// ⚔️ 戰力 / 修為計算
// 總戰力 = 弟子戰力 + 靈寵戰力 + 神兵總戰力 + 特效戰力加成
// 最終修為 = 基礎修為 + 神兵修為加成 + 特效修為加成
// ===============================
const studentPower = Number(student?.cp || 0);
const petPower = Number(student?.currentPetPower || 0);
const weaponPower = Number(student?.currentWeaponPower || 0);

// 先算沒有特效前的總戰力
const rawTotalPower = studentPower + petPower + weaponPower;

// 特效戰力加成
const powerBoostExtra = calcPowerBoostExtra(rawTotalPower, equippedWeaponDocs);

// 最終總戰力
const totalPower = rawTotalPower + powerBoostExtra;

// 修為
const baseXp = Number(student?.xp || 0);
const weaponXpBonus = Number(student?.currentWeaponXpBonus || 0);

// 先算沒有特效前的修為
const rawTotalXp = baseXp + weaponXpBonus;

// 特效修為加成
const cultivationBoostExtra = calcCultivationBoostExtra(rawTotalXp, equippedWeaponDocs);

// 最終修為
const totalXp = rawTotalXp + cultivationBoostExtra;

// 特效摘要（顯示用）
const effectSummary = getEquippedWeaponEffectSummary(equippedWeaponDocs);

// ===============================
// 神兵選中資訊
// ===============================
const selectedWeapon =
  allWeapons.find((w) => w.id === selectedWeaponId) || null;

const selectedWeaponForgeLevel = selectedWeapon
  ? Number(selectedWeapon.forgeLevel || 1)
  : 1;

const selectedWeaponRefineStage = selectedWeapon
  ? Number(selectedWeapon.refineStage || 1)
  : 1;

const selectedWeaponBonusPower = selectedWeapon
  ? Number(selectedWeapon.bonusPower || 0)
  : 0;

const selectedWeaponBonusXp = selectedWeapon
  ? Number(selectedWeapon.bonusXp || 0)
  : 0;

const selectedWeaponEffects =
  selectedWeapon && Array.isArray(selectedWeapon.extraEffects)
    ? selectedWeapon.extraEffects
    : [];

const selectedWeaponDisplayIcon = selectedWeapon
  ? getWeaponIconByStage(selectedWeapon.id, selectedWeaponRefineStage)
  : "";

const selectedWeaponFinalPower = selectedWeapon
  ? calcFinalWeaponPower({
      ...selectedWeapon,
      forgeLevel: selectedWeaponForgeLevel,
      refineStage: selectedWeaponRefineStage,
      bonusPower: selectedWeaponBonusPower,
      bonusXp: selectedWeaponBonusXp,
    })
  : 0;

const selectedWeaponFinalXpBonus = selectedWeapon
  ? calcFinalWeaponXpBonus({
      ...selectedWeapon,
      forgeLevel: selectedWeaponForgeLevel,
      refineStage: selectedWeaponRefineStage,
      bonusPower: selectedWeaponBonusPower,
      bonusXp: selectedWeaponBonusXp,
    })
  : 0;

  // 預設選第一把神兵
useEffect(() => {
  if (!selectedWeaponId && allWeapons.length > 0) {
    setSelectedWeaponId(allWeapons[0].id);
  }
}, [allWeapons, selectedWeaponId]);

// ===============================
// 將學生頁最新最終修為 / 最終總戰力 回寫到 student 主檔
// 讓老師頁可即時直接顯示
// ===============================
useEffect(() => {
  if (!studentPath?.classId || !studentPath?.studentId) return;
  if (!student) return;

  const run = async () => {
    try {
      const studentRef = doc(
        db,
        "classes",
        studentPath.classId,
        "students",
        studentPath.studentId
      );

      // 避免無限回寫：只有數值不同才更新
      const prevFinalXp = Number(student?.finalXp || 0);
      const prevFinalPower = Number(student?.finalPower || 0);

      if (prevFinalXp === totalXp && prevFinalPower === totalPower) return;

      await updateDoc(studentRef, {
        finalXp: totalXp,
        finalPower: totalPower,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("sync final stats error:", e);
    }
  };

  run();
}, [
  student?.id,
  student?.finalXp,
  student?.finalPower,
  studentPath?.classId,
  studentPath?.studentId,
  totalXp,
  totalPower,
]);

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
          <button className="rpg-btn" onClick={() => setOpenTreasure(true)}>🏮 藏寶閣</button>
          <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
        </div>
      </div>

      <Modal
        open={openAchModal}
        title={`🎖️ 成就稱號（目前：${student?.activeTitle || "未配戴"}）`}
        onClose={() => setOpenAchModal(false)}
        width={980}
      >
        <div style={{ opacity: 0.9, marginBottom: 10 }}>
          ✅ 只有「已解鎖」的稱號才可配戴；配戴只會更新 <b>activeTitle</b>
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

              const key = `classes/${classId}/achievements/${a.id}`;
              const unlocked = unlockedAchievements.includes(a.id) || unlockedAchievements.includes(key);

              const unlockedTitles = Array.isArray(student?.unlockedTitles) ? student.unlockedTitles : [];
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
              按下「收下」後，靈獸蛋將放入你的 <b>行囊</b> 中。
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              （每個帳號限領一次）
            </div>
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="rpg-btn" onClick={acceptEggReward}>✅ 收下！</button>
        </div>
      </Modal>

      {/* ===================== 第一次登入性別選擇 ===================== */}
<Modal
  open={openGenderModal}
  title="請選擇你的弟子性別"
  onClose={() => {}}
  width={520}
>
  <div style={{ textAlign: "center", opacity: 0.9, marginBottom: 14 }}>
    此設定每個帳號只能選擇一次，之後不可更改。
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20,
      alignItems: "start",
    }}
  >
    {/* 男生 */}
    <div
      onClick={() => chooseGender("male")}
      style={{
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        padding: 16,
        textAlign: "center",
      }}
    >
      
      <div style={{ fontSize: 18, fontWeight: 900 }}>♂️ 男</div>
    </div>

    {/* 女生 */}
    <div
      onClick={() => chooseGender("female")}
      style={{
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        padding: 16,
        textAlign: "center",
      }}
    >
      
      <div style={{ fontSize: 18, fontWeight: 900 }}>♀️ 女</div>
    </div>
  </div>
</Modal>

      <PetHatchModal
        open={openPetModal}
        onClose={() => setOpenPetModal(false)}
        student={student}
        studentPath={studentPath}
        bagItems={bagItems}
        petList={petList}
        selectedPetId={selectedPetId}
        setSelectedPetId={setSelectedPetId}
        petTab={petTab}
        setPetTab={setPetTab}
      />

      <Modal open={openWeaponModal} title="⚔️ 神兵" onClose={() => setOpenWeaponModal(false)} width={1100}>
  {Number(student?.level || 1) < 20 ? (
    <div
      style={{
        padding: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        marginBottom: 12,
        lineHeight: 1.8,
      }}
    >
      🔒 神兵系統未解鎖<br />
      需要達到 <b>Lv 20</b> 才能開啟「神兵」系統。<br />
      目前等級：<b>Lv {Number(student?.level || 1)}</b>
    </div>
  ) : !student?.weaponSystemUnlocked ? (
    <div
      style={{
        padding: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        marginBottom: 12,
        lineHeight: 1.8,
      }}
    >
      ⚔️ 神兵系統待啟用<br />
      你已達到 <b>Lv 20</b>，但尚未啟用神兵系統。<br />
      請先前往 <b>藏寶閣</b> 購買神兵，並到 <b>行囊</b> 裝備神兵。
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 16,
        alignItems: "stretch",
        minHeight: 460,
      }}
    >
      {/* 左側直式選單 */}
      <div
  style={{
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,

    // ✅ 背景：圖案 + 漸層疊加
    backgroundImage: `
      linear-gradient(rgba(10,10,10,0.75), rgba(10,10,10,0.9)),
      url("/weapbg.png")
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",

    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",

    // ✅ 微光暈邊框
    boxShadow: "inset 0 0 20px rgba(255,200,120,0.15)",
  }}
>
        <div
  onClick={() => setWeaponTab("overview")}
  style={{
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    padding: "16px 10px",
    borderRadius: 12,

    background:
      weaponTab === "overview"
        ? "linear-gradient(180deg, #e0c28a, #7a5a36)"
        : "linear-gradient(180deg, rgba(30,30,30,0.92), rgba(12,12,12,0.95))",

    border:
      weaponTab === "overview"
        ? "1px solid rgba(255,220,150,0.75)"
        : "1px solid rgba(255,255,255,0.10)",

    boxShadow:
      weaponTab === "overview"
        ? "0 6px 16px rgba(255,200,120,0.32), inset 0 1px 0 rgba(255,255,255,0.35)"
        : "0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",

    transform: weaponTab === "overview" ? "translateY(-2px)" : "translateY(0)",
    transition: "all 0.22s ease",

    fontWeight: 900,
    letterSpacing: 2,
    cursor: "pointer",
    color: weaponTab === "overview" ? "#fffdf5" : "rgba(255,255,255,0.9)",
    userSelect: "none",
  }}
>
  神兵介面
</div>

        <div
  onClick={() => setWeaponTab("forge")}
  style={{
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    padding: "16px 10px",
    borderRadius: 12,

    background:
      weaponTab === "forge"
        ? "linear-gradient(180deg, #e0c28a, #7a5a36)"
        : "linear-gradient(180deg, rgba(30,30,30,0.92), rgba(12,12,12,0.95))",

    border:
      weaponTab === "forge"
        ? "1px solid rgba(255,220,150,0.75)"
        : "1px solid rgba(255,255,255,0.10)",

    boxShadow:
      weaponTab === "forge"
        ? "0 6px 16px rgba(255,200,120,0.32), inset 0 1px 0 rgba(255,255,255,0.35)"
        : "0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",

    transform: weaponTab === "forge" ? "translateY(-2px)" : "translateY(0)",
    transition: "all 0.22s ease",

    fontWeight: 900,
    letterSpacing: 2,
    cursor: "pointer",
    color: weaponTab === "forge" ? "#fffdf5" : "rgba(255,255,255,0.9)",
    userSelect: "none",
  }}
>
  鍛造
</div>

        <div
  onClick={() => setWeaponTab("refine")}
  style={{
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    padding: "16px 10px",
    borderRadius: 12,

    background:
      weaponTab === "refine"
        ? "linear-gradient(180deg, #e0c28a, #7a5a36)"
        : "linear-gradient(180deg, rgba(30,30,30,0.92), rgba(12,12,12,0.95))",

    border:
      weaponTab === "refine"
        ? "1px solid rgba(255,220,150,0.75)"
        : "1px solid rgba(255,255,255,0.10)",

    boxShadow:
      weaponTab === "refine"
        ? "0 6px 16px rgba(255,200,120,0.32), inset 0 1px 0 rgba(255,255,255,0.35)"
        : "0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",

    transform: weaponTab === "refine" ? "translateY(-2px)" : "translateY(0)",
    transition: "all 0.22s ease",

    fontWeight: 900,
    letterSpacing: 2,
    cursor: "pointer",
    color: weaponTab === "refine" ? "#fffdf5" : "rgba(255,255,255,0.9)",
    userSelect: "none",
  }}
>
  精煉
</div>
      </div>

      {/* 右側內容 */}
<div
  style={{
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    backgroundImage: `
      linear-gradient(rgba(12,12,12,0.78), rgba(12,12,12,0.88)),
      url("/background.jpg")
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    padding: 16,
    boxShadow: "inset 0 0 20px rgba(255,255,255,0.04), 0 8px 20px rgba(0,0,0,0.22)",
    overflow: "hidden",
    position: "relative",
  }}
>
  {/* ================= 神兵介面 ================= */}
  {weaponTab === "overview" && (
    <>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
        ⚔️ 神兵介面
      </div>

      {equippedWeapons.length > 0 ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {equippedWeapons.map((w, idx) => (
              <div
                key={`${w.weaponId}-${idx}`}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.18)",
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 86,
                    height: 86,
                    margin: "0 auto",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={w.icon}
                    alt={w.name}
                    style={{ width: "82%", height: "82%", objectFit: "contain" }}
                  />
                </div>

                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900 }}>
                  {w.name}
                </div>

                <div style={{ marginTop: 4, opacity: 0.82 }}>
                  戰力：{Number(w.power || 0)}
                </div>

                <div style={{ marginTop: 2, opacity: 0.82 }}>
                  修為：+{Number(w.xpBonus || 0)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 14 }} />

          <div
            style={{
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              padding: 12,
              lineHeight: 1.8,
              opacity: 0.9,
            }}
          >
            已裝備 <b>{equippedWeapons.length}</b> / 3 把神兵<br />
            神兵總戰力：<b>{weaponPower}</b><br />
            神兵修為加成：<b>+{weaponXpBonus}</b>
          </div>
        </>
      ) : (
        <div style={{ opacity: 0.75 }}>
          尚未裝備神兵，請先前往行囊裝備神兵。
        </div>
      )}
    </>
  )}

  {/* ================= 鍛造介面 ================= */}
  {weaponTab === "forge" && (
    <>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
        🔨 鍛造介面
      </div>

      {allWeapons.length === 0 ? (
        <div style={{ opacity: 0.75 }}>尚未擁有神兵，請先前往藏寶閣購買。</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
          {/* 左：神兵列表 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.18)",
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>神兵列表</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allWeapons.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWeaponId(w.id)}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 10,
                    cursor: "pointer",
                    border:
                      selectedWeaponId === w.id
                        ? "1px solid rgba(255,215,120,0.7)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background:
                      selectedWeaponId === w.id
                        ? "rgba(255,215,120,0.10)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={getWeaponIconByStage(w.id, Number(w.refineStage || 1))}
                      alt={w.name}
                      style={{ width: "82%", height: "82%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{w.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.78 }}>
                      Lv.{Number(w.forgeLevel || 1)} ｜ {Number(w.refineStage || 1)}階
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右：鍛造詳情 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.18)",
              padding: 14,
            }}
          >
            {!selectedWeapon ? (
              <div style={{ opacity: 0.75 }}>請先選擇一把神兵。</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 16, alignItems: "center" }}>
                  <div
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={selectedWeaponDisplayIcon}
                      alt={selectedWeapon.name}
                      style={{ width: "86%", height: "86%", objectFit: "contain" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedWeapon.name}</div>
                    <div style={{ marginTop: 6, opacity: 0.82 }}>
                      鍛造等級：Lv.{selectedWeaponForgeLevel} / 30
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.82 }}>
                      目前戰力：{selectedWeaponFinalPower}
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.82 }}>
                      目前修為：+{selectedWeaponFinalXpBonus}
                    </div>
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    padding: 12,
                    lineHeight: 1.9,
                  }}
                >
                  <div><b>鍛造材料消耗：</b>鍛兵石 ×30</div>
                  <div><b>妖丹消耗：</b>300</div>
                  <div><b>目前持有鍛兵石：</b>{forgeStoneQty}</div>
                  <div><b>目前妖丹：</b>{Number(student?.coin || 0)}</div>
                </div>

                <div style={{ height: 12 }} />

                <div
                  style={{
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    padding: 12,
                    lineHeight: 1.9,
                  }}
                >
                  <div><b>鍛造後預計提升：</b></div>
                  <div>戰力小幅提升</div>
                  <div>修為小幅提升</div>
                </div>

                <div style={{ height: 14 }} />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
  className="rpg-btn"
  onClick={handleForgeWeapon}
  disabled={
    !selectedWeapon ||
    selectedWeaponForgeLevel >= 30 ||
    forgeStoneQty < 30 ||
    Number(student?.coin || 0) < 300
  }
  style={{
    opacity:
      !selectedWeapon ||
      selectedWeaponForgeLevel >= 30 ||
      forgeStoneQty < 30 ||
      Number(student?.coin || 0) < 300
        ? 0.5
        : 1,
    cursor:
      !selectedWeapon ||
      selectedWeaponForgeLevel >= 30 ||
      forgeStoneQty < 30 ||
      Number(student?.coin || 0) < 300
        ? "not-allowed"
        : "pointer",
  }}
>
  🔨 開始鍛造
</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )}

  {/* ================= 精煉介面 ================= */}
  {weaponTab === "refine" && (
    <>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
        ✨ 精煉介面
      </div>

      {allWeapons.length === 0 ? (
        <div style={{ opacity: 0.75 }}>尚未擁有神兵，請先前往藏寶閣購買。</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
          {/* 左：神兵列表 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.18)",
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>神兵列表</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allWeapons.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWeaponId(w.id)}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 10,
                    cursor: "pointer",
                    border:
                      selectedWeaponId === w.id
                        ? "1px solid rgba(255,215,120,0.7)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background:
                      selectedWeaponId === w.id
                        ? "rgba(255,215,120,0.10)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={getWeaponIconByStage(w.id, Number(w.refineStage || 1))}
                      alt={w.name}
                      style={{ width: "82%", height: "82%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{w.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.78 }}>
                      {Number(w.refineStage || 1)}階
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右：精煉 / 融合 / 特效 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.18)",
              padding: 14,
            }}
          >
            {/* 內部分頁 */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button
                className="rpg-btn sm"
                onClick={() => setWeaponSubTab("refine")}
                style={{ opacity: weaponSubTab === "refine" ? 1 : 0.55 }}
              >
                精煉
              </button>

              <button
                className="rpg-btn sm"
                onClick={() => setWeaponSubTab("merge")}
                style={{ opacity: weaponSubTab === "merge" ? 1 : 0.55 }}
              >
                融合
              </button>

              <button
                className="rpg-btn sm"
                onClick={() => setWeaponSubTab("effect")}
                style={{ opacity: weaponSubTab === "effect" ? 1 : 0.55 }}
              >
                特效
              </button>
            </div>

            {!selectedWeapon ? (
              <div style={{ opacity: 0.75 }}>請先選擇一把神兵。</div>
            ) : (
              <>
                {/* ===== 精煉 ===== */}
                {weaponSubTab === "refine" && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                      神兵精煉
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 16, alignItems: "center" }}>
                      <div
                        style={{
                          width: 110,
                          height: 110,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={selectedWeaponDisplayIcon}
                          alt={selectedWeapon.name}
                          style={{ width: "86%", height: "86%", objectFit: "contain" }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedWeapon.name}</div>
                        <div style={{ marginTop: 6, opacity: 0.82 }}>
                          目前階級：{selectedWeaponRefineStage} 階 / 3 階
                        </div>
                        <div style={{ marginTop: 4, opacity: 0.82 }}>
                          精煉後圖片變化✨✨✨
                        </div>
                      </div>
                    </div>

                    <div style={{ height: 14 }} />

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        padding: 12,
                        lineHeight: 1.9,
                      }}
                    >
                      <div><b>精煉材料消耗：</b>玄鐵 ×10</div>
                      <div><b>妖丹消耗：</b>1000</div>
                      <div><b>目前持有玄鐵：</b>{blackIronQty}</div>
                      <div><b>目前妖丹：</b>{Number(student?.coin || 0)}</div>
                    </div>

                    <div style={{ height: 14 }} />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
  className="rpg-btn"
  onClick={handleRefineWeapon}
  disabled={
    !selectedWeapon ||
    selectedWeaponRefineStage >= 3 ||
    blackIronQty < 10 ||
    Number(student?.coin || 0) < 1000
  }
  style={{
    opacity:
      !selectedWeapon ||
      selectedWeaponRefineStage >= 3 ||
      blackIronQty < 10 ||
      Number(student?.coin || 0) < 1000
        ? 0.5
        : 1,
    cursor:
      !selectedWeapon ||
      selectedWeaponRefineStage >= 3 ||
      blackIronQty < 10 ||
      Number(student?.coin || 0) < 1000
        ? "not-allowed"
        : "pointer",
  }}
>
  ✨ 開始精煉
</button>
                    </div>
                  </>
                )}

                {/* ===== 融合 ===== */}
                {weaponSubTab === "merge" && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                      融合玄鐵
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        padding: 12,
                        lineHeight: 1.9,
                      }}
                    >
                      <div><b>融合規則：</b>25 個隕鐵結晶 → 1 個玄鐵</div>
                      <div><b>目前持有隕鐵結晶：</b>{meteorCrystalQty}</div>
                      <div><b>目前持有玄鐵：</b>{blackIronQty}</div>
                    </div>

                    <div style={{ height: 14 }} />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
  className="rpg-btn"
  onClick={handleMergeBlackIron}
  disabled={meteorCrystalQty < 25}
  style={{
    opacity: meteorCrystalQty < 25 ? 0.5 : 1,
    cursor: meteorCrystalQty < 25 ? "not-allowed" : "pointer",
  }}
>
  ⚗️ 開始融合
</button>
                    </div>
                  </>
                )}

                {/* ===== 特效 ===== */}
                {weaponSubTab === "effect" && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
                      特效洗練
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        padding: 12,
                        lineHeight: 1.9,
                      }}
                    >
                      <div><b>洗練消耗：</b>玄鐵 ×5、妖丹 300</div>
                      <div><b>目前持有玄鐵：</b>{blackIronQty}</div>
                      <div><b>目前妖丹：</b>{Number(student?.coin || 0)}</div>
                    </div>

                    <div style={{ height: 12 }} />

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        padding: 12,
                        lineHeight: 1.9,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>目前特效</div>

                      {selectedWeaponEffects.length > 0 ? (
                        selectedWeaponEffects.map((ef, idx) => (
                          <div key={idx}>
                            ・{EFFECT_QUALITY_LABEL[ef.quality] || ef.quality}
                            ｜{EFFECT_TYPE_LABEL[ef.effectType] || ef.effectType}
                            ｜+{ef.value}
                          </div>
                        ))
                      ) : (
                        <div style={{ opacity: 0.75 }}>目前尚無特殊效果</div>
                      )}
                    </div>

                    <div style={{ height: 14 }} />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
  className="rpg-btn"
  onClick={handleRollWeaponEffect}
  disabled={blackIronQty < 5 || Number(student?.coin || 0) < 300 || !selectedWeapon}
  style={{
    opacity:
      blackIronQty < 5 || Number(student?.coin || 0) < 300 || !selectedWeapon
        ? 0.5
        : 1,
    cursor:
      blackIronQty < 5 || Number(student?.coin || 0) < 300 || !selectedWeapon
        ? "not-allowed"
        : "pointer",
  }}
>
  🎲 洗練特效
</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )}
</div>
    </div>
  )}
</Modal>

      <BackpackModal
  open={openBag}
  onClose={() => setOpenBag(false)}
  items={bagItems}
  slotsPerTab={16}
  onUseItem={handleUseItem}
  student={student}            // ✅ 新增
  studentPath={studentPath}    // ✅ 新增
/>

      <TreasureShop
        open={openTreasure}
        onClose={() => setOpenTreasure(false)}
        mode="student"
        items={SHOP_ITEMS}
        coin={student?.coin ?? 0}
        onBuy={handleStudentBuy}
      />
      <div
  style={{
    marginTop: 14,
    padding: 18,
    border: "1px solid rgba(218,185,120,0.35)",
    borderRadius: 12,
    background: "rgba(20,20,20,0.85)",
    display: "grid",
    gridTemplateColumns: "1fr 220px",
    gap: 18,
    alignItems: "center",
  }}
>
  {/* 左側資訊 */}
  <div>
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
  <div style={{ fontSize: 20, fontWeight: 800 }}>修為：{totalXp}</div>
  <div style={{ fontSize: 20, fontWeight: 800 }}>戰力：{totalPower}</div>
  <div style={{ fontSize: 20, fontWeight: 800 }}>妖丹：{student.coin ?? 0}</div>
  <div style={{ fontSize: 20, fontWeight: 800 }}>靈寵碎片：{Number(student?.petShard || 0)}</div>
</div>

<div style={{ height: 6 }} />
<div style={{ display: "flex", gap: 14, flexWrap: "wrap", opacity: 0.82, fontSize: 13 }}>
  <div>📈 經驗加成：+{effectSummary.xp_boost}%</div>
  <div> 妖丹加成：+{effectSummary.coin_boost}%</div>
  <div>🎁 掉寶加成：+{effectSummary.drop_boost}%</div>
</div>

    <div style={{ height: 10 }} />
    <div style={{ fontSize: 12, opacity: 0.7 }}>
      班級代碼：{meIndex?.classCode || "—"}　|　弟子ID：{meIndex?.studentId || "—"}
    </div>
  </div>

  {/* 右側角色圖 */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 180,
    }}
  >
    {student.gender ? (
      <img
        src={student.gender === "female" ? "/characters/girl.png" : "/characters/boy.png"}
        alt={student.gender === "female" ? "女弟子" : "男弟子"}
        style={{
          maxWidth: "100%",
          maxHeight: 220,
          objectFit: "contain",
        }}
      />
    ) : (
      <div style={{ opacity: 0.35, fontSize: 14 }}>尚未選擇性別</div>
    )}
  </div>
</div>

      <div style={{ height: 16 }} />

      <div
        style={{
          padding: 16,
          border: "1px solid rgba(218,185,120,0.35)",
          borderRadius: 12,
          background: "rgba(20,20,20,0.72)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          🐾 目前靈寵
        </div>

        {student?.currentPetId ? (
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 92,
                height: 92,
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
                src={student.currentPetIcon}
                alt={student.currentPetName}
                style={{ width: "82%", height: "82%", objectFit: "contain" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{student.currentPetName}</div>
              <div style={{ marginTop: 6, opacity: 0.8 }}>已出戰中</div>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>尚未孵化靈寵</div>
        )}
      </div>

      <div style={{ height: 14 }} />

<div
  style={{
    padding: 16,
    border: "1px solid rgba(218,185,120,0.35)",
    borderRadius: 12,
    background: "rgba(20,20,20,0.72)",
  }}
>
  <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
    ⚔️ 目前神兵
  </div>

  <div style={{ height: 10 }} />
  {equippedWeapons.length > 0 ? (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {equippedWeapons.map((w, idx) => (
          <div
            key={`${w.weaponId}-${idx}`}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              padding: 12,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={w.icon}
                alt={w.name}
                style={{ width: "82%", height: "82%", objectFit: "contain" }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {w.name}
              </div>

              <div style={{ marginTop: 4, opacity: 0.82, fontSize: 13 }}>
                戰力：{Number(w.power || 0)}
              </div>

              <div style={{ marginTop: 2, opacity: 0.82, fontSize: 13 }}>
                修為：+{Number(w.xpBonus || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 12 }} />
      <div style={{ opacity: 0.8 }}>
        已裝備 {equippedWeapons.length} / 3 把　
        ｜神兵總戰力：{weaponPower}　
        ｜神兵修為加成：+{weaponXpBonus}
      </div>
    </>
  ) : (
    <div style={{ opacity: 0.75 }}>
      尚未裝備神兵（Lv20 後可購買並在背包中裝備）
    </div>
  )}
</div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="rpg-btn" onClick={() => setOpenAchModal(true)}>🎖️ 成就稱號</button>
        <button className="rpg-btn" onClick={() => setOpenPetModal(true)}>🐾 靈寵</button>
        <button className="rpg-btn" onClick={() => setOpenWeaponModal(true)}>
    ⚔️ 神兵{Number(student?.level || 1) < 20 ? "（Lv20開啟）" : ""}
  </button>
        <button className="rpg-btn" onClick={() => setOpenBag(true)}>🎒 行囊</button>
      </div>
    </div>
  );
}