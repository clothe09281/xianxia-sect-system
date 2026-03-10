import { useMemo } from "react";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  PETS_MASTER,
  calcPetStats,
  getStarNeed,
  calcPetPower,
  createPetDoc,
} from "../data/pets";

function Modal({ open, title, onClose, children, width = 1280 }) {
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

const PET_CHOICES = [
  { id: "pet_001", name: "青靈幼狐", icon: "/merchandise/pet_001.png" },
  { id: "pet_002", name: "天眼神鷹", icon: "/merchandise/pet_002.png" },
  { id: "pet_003", name: "太虛白澤", icon: "/merchandise/pet_003.png" },
];

const EGG_ID = "egg_001";
const FOOD_IDS = ["mat_lingbao_001", "mat_lingbao_002", "mat_lingbao_003"];
const FEED_NEED = 5;
const MAX_LEVEL_PER_STAR = 10;

export default function PetHatchModal({
  open,
  onClose,
  student,
  studentPath,
  bagItems = [],
  petList = [],
  selectedPetId,
  setSelectedPetId,
  petTab,
  setPetTab,
  onToast,
}) {
  const toast = (t) => (onToast ? onToast(t) : alert(t));

  const level = Number(student?.level || 1);
  const levelUnlocked = level >= 5;
  const petSystemUnlocked = Boolean(student?.petSystemUnlocked || false);
  const canUseSystem = levelUnlocked && petSystemUnlocked;

  const currentPetId = student?.currentPetId || "";
  const currentPetName = student?.currentPetName || "";
  const currentPetIcon = student?.currentPetIcon || "";
  const hasCurrentPet = !!currentPetId;

  const totalPetShard = Number(student?.petShard || 0);

  const egg = useMemo(() => {
    return bagItems.find((x) => x?.id === EGG_ID) || null;
  }, [bagItems]);

  const foods = useMemo(() => {
    return FOOD_IDS
      .map((id) => bagItems.find((x) => x?.id === id))
      .filter(Boolean);
  }, [bagItems]);

  const foodQty = foods.reduce((sum, x) => sum + Number(x?.qty || 0), 0);

  const foodToConsumeId = useMemo(() => {
    if (foods.length === 0) return null;
    const sorted = [...foods].sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));
    return sorted[0]?.id || null;
  }, [foods]);

  const feedCount = Number(egg?.feedCount || 0);
  const hatched = Boolean(egg?.hatched || false);

  const eggIcon =
    egg?.icon && String(egg.icon).startsWith("/")
      ? egg.icon
      : "/merchandise/egg_001.png";

  const feedNow = Math.max(0, Math.min(FEED_NEED, feedCount));
  const feedPct = FEED_NEED > 0 ? Math.round((feedNow / FEED_NEED) * 100) : 0;

  const selectedPet =
    petList.find((p) => p.petId === selectedPetId) ||
    petList[0] ||
    null;

  const selectedMaster = selectedPet ? PETS_MASTER[selectedPet.petId] : null;

  const petPower = selectedPet ? calcPetPower(selectedPet) : 0;

  const currentLevel = Number(selectedPet?.level || 1);
  const currentStar = Number(selectedPet?.star || 1);
  const nextLevel = Math.min(MAX_LEVEL_PER_STAR, currentLevel + 1);
  const currentStarNeed = getStarNeed(currentStar);

  const nextStats =
    selectedPet && selectedMaster
      ? calcPetStats(selectedMaster, nextLevel, currentStar)
      : { hp: 0, atk: 0, spd: 0 };

  const nextHp = nextStats.hp;
  const nextAtk = nextStats.atk;
  const nextSpd = nextStats.spd;

  const canLevelUp =
    !!selectedPet &&
    currentLevel < MAX_LEVEL_PER_STAR &&
    foodQty > 0 &&
    !!foodToConsumeId;

  const canStarUp =
    !!selectedPet &&
    currentStar < 5 &&
    currentLevel >= MAX_LEVEL_PER_STAR &&
    totalPetShard >= currentStarNeed;

  async function feedOnce() {
    if (!studentPath?.classId || !studentPath?.studentId) return toast("尚未取得 studentPath");
    if (!canUseSystem) return toast("請先達到 Lv5 並在行囊中使用靈獸蛋。");
    if (!egg) return toast("你尚未擁有靈獸蛋。");
    if (hatched) return toast("此靈獸蛋已孵化。");
    if (feedCount >= FEED_NEED) return toast("已餵養完成，可以孵化了！");
    if (foodQty <= 0) return toast("天地靈寶不足，無法餵養。");
    if (!foodToConsumeId) return toast("找不到可消耗的天地靈寶。");

    const { classId, studentId } = studentPath;

    const eggRef = doc(db, "classes", classId, "students", studentId, "inventory", EGG_ID);
    const foodRef = doc(db, "classes", classId, "students", studentId, "inventory", foodToConsumeId);

    try {
      await runTransaction(db, async (tx) => {
        const eggSnap = await tx.get(eggRef);
        const foodSnap = await tx.get(foodRef);

        if (!eggSnap.exists()) throw new Error("找不到靈獸蛋（egg_001）");
        if (!foodSnap.exists()) throw new Error("找不到可用的天地靈寶");

        const eggData = eggSnap.data() || {};
        const foodData = foodSnap.data() || {};

        const curFeed = Number(eggData.feedCount || 0);
        const curHatched = Boolean(eggData.hatched || false);
        const curFood = Number(foodData.qty || 0);

        if (curHatched) throw new Error("此靈獸蛋已孵化");
        if (curFeed >= FEED_NEED) throw new Error("已餵養完成，請直接孵化");
        if (curFood <= 0) throw new Error("天地靈寶不足");

        tx.update(foodRef, {
          qty: curFood - 1,
          updatedAt: serverTimestamp(),
        });

        tx.update(eggRef, {
          feedCount: curFeed + 1,
          updatedAt: serverTimestamp(),
        });
      });

      toast(`✅ 餵養成功（${feedCount + 1}/${FEED_NEED}）`);
    } catch (e) {
      console.error(e);
      toast(e?.message || "餵養失敗");
    }
  }

  async function hatchTo(pet) {
    if (!studentPath?.classId || !studentPath?.studentId) return toast("尚未取得 studentPath");
    if (!canUseSystem) return toast("請先達到 Lv5 並在行囊中使用靈獸蛋。");
    if (!egg) return toast("你尚未擁有靈獸蛋。");
    if (hatched) return toast("此靈獸蛋已孵化。");
    if (feedCount < FEED_NEED) return toast(`餵養未完成（${feedCount}/${FEED_NEED}）`);

    const { classId, studentId } = studentPath;

    const eggRef = doc(db, "classes", classId, "students", studentId, "inventory", EGG_ID);
    const studentRef = doc(db, "classes", classId, "students", studentId);
    const petRef = doc(db, "classes", classId, "students", studentId, "pets", pet.id);

    try {
      await runTransaction(db, async (tx) => {
        const eggSnap = await tx.get(eggRef);
        const studentSnap = await tx.get(studentRef);
        const petSnap = await tx.get(petRef);

        if (!eggSnap.exists()) throw new Error("找不到靈獸蛋");
        if (!studentSnap.exists()) throw new Error("找不到學生資料");

        const eggData = eggSnap.data() || {};
        const studentData = studentSnap.data() || {};

        const curFeed = Number(eggData.feedCount || 0);
        const curHatched = Boolean(eggData.hatched || false);

        if (curHatched) throw new Error("此靈獸蛋已孵化");
        if (curFeed < FEED_NEED) throw new Error("餵養未完成，不能孵化");

        const master = PETS_MASTER[pet.id];
        if (!master) throw new Error("找不到靈寵主資料");

        if (petSnap.exists()) {
          const oldPetShard = Number(studentData.petShard || 0);

          tx.update(studentRef, {
            petShard: oldPetShard + 1,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(petRef, {
            ...createPetDoc(master),
            equipped: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        tx.update(studentRef, {
          currentPetId: master.id,
          currentPetName: master.name,
          currentPetIcon: master.icon,
          petHatchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        tx.update(eggRef, {
          qty: 0,
          hatched: true,
          hatchedTo: pet.id,
          updatedAt: serverTimestamp(),
        });
      });

      toast(`🎉 孵化成功：${pet.name} 已成為你的靈寵！`);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast(e?.message || "孵化失敗");
    }
  }

  async function equipPet(pet) {
    if (!studentPath?.classId || !studentPath?.studentId) return toast("尚未取得 studentPath");

    const { classId, studentId } = studentPath;
    const studentRef = doc(db, "classes", classId, "students", studentId);
    const petRef = doc(db, "classes", classId, "students", studentId, "pets", pet.petId);

    try {
      await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(studentRef);
        const pSnap = await tx.get(petRef);

        if (!sSnap.exists()) throw new Error("找不到學生資料");
        if (!pSnap.exists()) throw new Error("找不到靈寵資料");

        tx.update(studentRef, {
          currentPetId: pet.petId,
          currentPetName: pet.name,
          currentPetIcon: pet.icon,
          updatedAt: serverTimestamp(),
        });

        tx.update(petRef, {
          equipped: true,
          updatedAt: serverTimestamp(),
        });
      });

      toast(`✅ 已讓 ${pet.name} 出戰`);
    } catch (e) {
      console.error(e);
      toast(e?.message || "出戰失敗");
    }
  }

  async function levelUpPet(pet) {
    if (!studentPath?.classId || !studentPath?.studentId) return toast("尚未取得 studentPath");
    if (!pet) return toast("尚未選擇靈寵");
    if (Number(pet.level || 1) >= MAX_LEVEL_PER_STAR) return toast("已達此星級最高等級（Lv10）");
    if (foodQty <= 0 || !foodToConsumeId) return toast("天地靈寶不足");

    const { classId, studentId } = studentPath;
    const petRef = doc(db, "classes", classId, "students", studentId, "pets", pet.petId);
    const foodRef = doc(db, "classes", classId, "students", studentId, "inventory", foodToConsumeId);

    try {
      await runTransaction(db, async (tx) => {
        const petSnap = await tx.get(petRef);
        const foodSnap = await tx.get(foodRef);

        if (!petSnap.exists()) throw new Error("找不到靈寵資料");
        if (!foodSnap.exists()) throw new Error("找不到天地靈寶");

        const petData = petSnap.data() || {};
        const currentLv = Number(petData.level || 1);
        const currentStarValue = Number(petData.star || 1);
        const currentFood = Number(foodSnap.data()?.qty || 0);

        if (currentLv >= MAX_LEVEL_PER_STAR) throw new Error("已達此星級最高等級（Lv10）");
        if (currentFood <= 0) throw new Error("天地靈寶不足");

        const master = PETS_MASTER[pet.petId];
        if (!master) throw new Error("找不到靈寵主資料");

        const newLevel = currentLv + 1;
        const newStats = calcPetStats(master, newLevel, currentStarValue);

        tx.update(foodRef, {
          qty: currentFood - 1,
          updatedAt: serverTimestamp(),
        });

        tx.update(petRef, {
          level: newLevel,
          hp: newStats.hp,
          atk: newStats.atk,
          spd: newStats.spd,
          updatedAt: serverTimestamp(),
        });
      });

      toast(`✅ ${pet.name} 升到 Lv.${Number(pet.level || 1) + 1}`);
    } catch (e) {
      console.error(e);
      toast(e?.message || "升級失敗");
    }
  }

  async function starUpPet(pet) {
    if (!studentPath?.classId || !studentPath?.studentId) return toast("尚未取得 studentPath");
    if (!pet) return toast("尚未選擇靈寵");

    const currentStarValue = Number(pet.star || 1);
    const currentLevelValue = Number(pet.level || 1);
    const needShard = getStarNeed(currentStarValue);

    if (currentStarValue >= 5) return toast("已達最高星級（5星）");
    if (currentLevelValue < MAX_LEVEL_PER_STAR) return toast("需先升到 Lv10 才能升星");
    if (totalPetShard < needShard) return toast("靈寵碎片不足");

    const { classId, studentId } = studentPath;
    const petRef = doc(db, "classes", classId, "students", studentId, "pets", pet.petId);
    const studentRef = doc(db, "classes", classId, "students", studentId);

    try {
      await runTransaction(db, async (tx) => {
        const petSnap = await tx.get(petRef);
        const studentSnap = await tx.get(studentRef);

        if (!petSnap.exists()) throw new Error("找不到靈寵資料");
        if (!studentSnap.exists()) throw new Error("找不到學生資料");

        const petData = petSnap.data() || {};
        const studentData = studentSnap.data() || {};

        const star = Number(petData.star || 1);
        const level = Number(petData.level || 1);
        const totalShard = Number(studentData.petShard || 0);
        const need = getStarNeed(star);

        if (star >= 5) throw new Error("已達最高星級");
        if (level < MAX_LEVEL_PER_STAR) throw new Error("需先升到 Lv10 才能升星");
        if (totalShard < need) throw new Error("靈寵碎片不足");

        const master = PETS_MASTER[pet.petId];
        if (!master) throw new Error("找不到靈寵主資料");

        const newStar = star + 1;
        const newLevel = 1;
        const newStats = calcPetStats(master, newLevel, newStar);

        tx.update(studentRef, {
          petShard: totalShard - need,
          updatedAt: serverTimestamp(),
        });

        tx.update(petRef, {
          star: newStar,
          level: newLevel,
          hp: newStats.hp,
          atk: newStats.atk,
          spd: newStats.spd,
          updatedAt: serverTimestamp(),
        });
      });

      toast(`⭐ ${pet.name} 已升到 ${currentStarValue + 1} 星，等級重置為 Lv1`);
    } catch (e) {
      console.error(e);
      toast(e?.message || "升星失敗");
    }
  }

  return (
    <Modal
      open={open}
      title="🐾 靈寵視窗"
      onClose={onClose}
      width={hasCurrentPet ? 1280 : feedCount >= FEED_NEED ? 980 : 400}
    >
      {!levelUnlocked ? (
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
          🔒 靈獸系統未開啟<br />
          需要達到 <b>Lv 5</b> 才能開啟「孵化靈獸」系統。<br />
          目前等級：<b>Lv {level}</b>
        </div>
      ) : !petSystemUnlocked ? (
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
          🥚 靈獸系統待啟用<br />
          你已達到 <b>Lv 5</b>，但尚未啟用靈獸系統。<br />
          請先前往 <b>行囊</b> 使用 <b>靈獸蛋</b>。
        </div>
      ) : hasCurrentPet ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr 320px",
            gap: 18,
            alignItems: "stretch",
            width: "100%",
          }}
        >
          {/* 左：靈寵列表 */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
              🐾 靈寵列表
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {petList.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 13 }}>尚無靈寵</div>
              ) : (
                petList.map((pet) => {
                  const isCurrent = selectedPet?.petId === pet.petId;
                  const stars = Number(pet.star || 1);

                  return (
                    <div
                      key={pet.petId}
                      onClick={() => setSelectedPetId?.(pet.petId)}
                      style={{
                        border: isCurrent
                          ? "2px solid rgba(255,215,0,0.75)"
                          : "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.35)",
                        padding: 8,
                        textAlign: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 72,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={pet.icon}
                          alt={pet.name}
                          style={{ width: "70%", height: "70%", objectFit: "contain" }}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {pet.name}
                      </div>

                      <div style={{ marginTop: 4 }}>
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span
                            key={idx}
                            style={{
                              color: idx < stars ? "#FFD700" : "rgba(255,255,255,0.2)",
                              fontSize: 14,
                            }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 中：中央展示 */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background:
                "radial-gradient(circle at center, rgba(255,215,0,0.14), rgba(255,255,255,0.03) 60%, rgba(0,0,0,0.12) 100%)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 500,
            }}
          >
            {selectedPet ? (
              <>
                <div style={{ fontSize: 14, opacity: 0.75 }}>目前展示靈寵</div>

                <div
                  style={{
                    marginTop: 14,
                    width: 320,
                    height: 320,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 28px rgba(255,215,0,0.15)",
                  }}
                >
                  <img
                    src={selectedPet.icon}
                    alt={selectedPet.name}
                    style={{
                      width: "82%",
                      height: "82%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.45))",
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    fontSize: 34,
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  {selectedPet.name}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <span
                      key={idx}
                      style={{
                        color: idx < Number(selectedPet.star || 1) ? "#FFD700" : "rgba(255,255,255,0.2)",
                        fontSize: 28,
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    width: 260,
                    height: 14,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.12)",
                    overflow: "hidden",
                    border: "1px solid rgba(218,185,120,0.35)",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        getStarNeed(Number(selectedPet.star || 1)) > 0
                          ? (totalPetShard / getStarNeed(Number(selectedPet.star || 1))) * 100
                          : 100
                      )}%`,
                      height: "100%",
                      background: "linear-gradient(180deg,#FFD700,#C8A951)",
                    }}
                  />
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  通用碎片進度 {totalPetShard} / {getStarNeed(Number(selectedPet.star || 1)) || 0}
                </div>

                <button
                  className="rpg-btn"
                  onClick={() => equipPet(selectedPet)}
                  disabled={selectedPet.petId === currentPetId}
                  style={{
                    marginTop: 16,
                    width: 180,
                    opacity: selectedPet.petId === currentPetId ? 0.5 : 1,
                    cursor: selectedPet.petId === currentPetId ? "not-allowed" : "pointer",
                  }}
                >
                  {selectedPet.petId === currentPetId ? "✅ 已出戰" : "⚔️ 出戰"}
                </button>
              </>
            ) : (
              <div style={{ opacity: 0.7 }}>尚未選擇靈寵</div>
            )}
          </div>

          {/* 右：詳情 / 升級 */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.10)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 0",
                  background: petTab === "detail" ? "rgba(255,255,255,0.06)" : "transparent",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                onClick={() => setPetTab?.("detail")}
              >
                詳情
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 0",
                  background: petTab === "upgrade" ? "linear-gradient(180deg,#ff8a2a,#e96b12)" : "transparent",
                  color: petTab === "upgrade" ? "#fff" : "#ddd",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                onClick={() => setPetTab?.("upgrade")}
              >
                升級
              </div>
            </div>

            {!selectedPet ? (
              <div style={{ opacity: 0.7 }}>尚未選擇靈寵</div>
            ) : petTab === "detail" ? (
              <>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      margin: "0 auto",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={selectedPet.icon}
                      alt={selectedPet.name}
                      style={{ width: "82%", height: "82%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ marginTop: 12, fontSize: 20, fontWeight: 900 }}>
                    {selectedPet.name}
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.8 }}>
                    為弟子增加戰力：<b>{petPower}</b>
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    星級：
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 28,
                            lineHeight: 1,
                            color: idx < currentStar ? "#FFD700" : "rgba(0,0,0,0.55)",
                            textShadow: idx < currentStar ? "0 0 8px rgba(255,215,0,0.35)" : "none",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>

                    <button
                      className="rpg-btn sm"
                      style={{
                        background: "linear-gradient(180deg,#ff8a2a,#e96b12)",
                        color: "#fff",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => setPetTab?.("upgrade")}
                    >
                      前往升星
                    </button>
                  </div>

                  <div style={{ height: 10 }} />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>✨</div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.45)",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              currentStarNeed > 0 ? (totalPetShard / currentStarNeed) * 100 : 100
                            )}%`,
                            height: "100%",
                            background: "linear-gradient(180deg,#FFD700,#C8A951)",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ minWidth: 54, textAlign: "right", fontWeight: 900 }}>
                      {totalPetShard}/{currentStarNeed || 0}
                    </div>
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    角色屬性：
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>❤️ 血量</span>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{selectedPet.hp}</span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>⚔️ 攻擊</span>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{selectedPet.atk}</span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>💨 速度</span>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{selectedPet.spd}</span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>✨ 戰力</span>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{petPower}</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 14, opacity: 0.8 }}>靈寵技能</div>
                  <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900 }}>
                    {selectedPet.skillName || "未命名技能"}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.8, lineHeight: 1.6 }}>
                    {selectedPet.skillDesc || "尚無技能說明"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      margin: "0 auto",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={selectedPet.icon}
                      alt={selectedPet.name}
                      style={{ width: "82%", height: "82%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900 }}>
                    Lv.{currentLevel} → Lv.{nextLevel}
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    升級後數值
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.20)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>❤️ 血量</span>
                      <span style={{ fontWeight: 900 }}>
                        {selectedPet.hp} → {nextHp}
                      </span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.20)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>⚔️ 攻擊</span>
                      <span style={{ fontWeight: 900 }}>
                        {selectedPet.atk} → {nextAtk}
                      </span>
                    </div>

                    <div
                      style={{
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.20)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>💨 速度</span>
                      <span style={{ fontWeight: 900 }}>
                        {selectedPet.spd} → {nextSpd}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    升級消耗
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>🌿</div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.45)",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, foodQty > 0 ? (foodQty / 1) * 100 : 0)}%`,
                            height: "100%",
                            background: "linear-gradient(180deg,#FFD700,#C8A951)",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ minWidth: 54, textAlign: "right", fontWeight: 900 }}>
                      {foodQty}/1
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    每個星級都可從 Lv1 升到 Lv10；升到 Lv10 後才可進行升星。
                  </div>
                </div>

                <div style={{ height: 16 }} />

                <div
                  style={{
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    升星消耗
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 24,
                            lineHeight: 1,
                            color: idx < Number(selectedPet.star || 1) ? "#FFD700" : "rgba(0,0,0,0.55)",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>

                    <div style={{ fontWeight: 900 }}>
                      {selectedPet.star} → {Math.min(5, Number(selectedPet.star || 1) + 1)} 星
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>✨</div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.45)",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              currentStarNeed > 0 ? (totalPetShard / currentStarNeed) * 100 : 100
                            )}%`,
                            height: "100%",
                            background: "linear-gradient(180deg,#FFD700,#C8A951)",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ minWidth: 64, textAlign: "right", fontWeight: 900 }}>
                      {totalPetShard}/{currentStarNeed || 0}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    升星需先達到 Lv10。1→2 星需 10 片，2→3 星需 20 片，3→4 星需 30 片，4→5 星需 40 片。
                    升星後等級會重置為 Lv1，重新培養該星級。
                  </div>
                </div>

                <div style={{ height: 18 }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <button
                    className="rpg-btn"
                    onClick={() => levelUpPet(selectedPet)}
                    disabled={!canLevelUp}
                    style={{
                      width: "100%",
                      opacity: !canLevelUp ? 0.5 : 1,
                      cursor: !canLevelUp ? "not-allowed" : "pointer",
                    }}
                  >
                    ⬆️ 升級
                  </button>

                  <button
                    className="rpg-btn"
                    onClick={() => starUpPet(selectedPet)}
                    disabled={!canStarUp}
                    style={{
                      width: "100%",
                      opacity: !canStarUp ? 0.5 : 1,
                      cursor: !canStarUp ? "not-allowed" : "pointer",
                    }}
                  >
                    ⭐ 升星
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : feedCount < FEED_NEED ? (
        <div style={{ width: 340 }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <img
                  src={eggIcon}
                  alt="靈獸蛋"
                  style={{ width: "86%", height: "86%", objectFit: "contain" }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  🥚 靈獸蛋狀態：孵化中
                </div>
                <div style={{ marginTop: 6, opacity: 0.9 }}>
                  餵養進度：<b>{feedNow}</b> / {FEED_NEED}
                </div>
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  天地靈寶持有：<b>{foodQty}</b>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(218,185,120,0.35)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${feedPct}%`,
                    background: "linear-gradient(180deg,#FFD700,#C8A951)",
                    boxShadow: "0 0 14px rgba(255,215,0,0.35)",
                  }}
                />
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                需要餵養 <b>天地靈寶 ×{FEED_NEED}</b> 才能孵化（每次消耗 1）
              </div>
            </div>

            <div style={{ height: 10 }} />

            <button
              className="rpg-btn"
              onClick={feedOnce}
              disabled={
                !canUseSystem ||
                !egg ||
                hatched ||
                feedCount >= FEED_NEED ||
                foodQty <= 0 ||
                !foodToConsumeId
              }
              style={{
                width: "100%",
                opacity:
                  !canUseSystem ||
                  !egg ||
                  hatched ||
                  feedCount >= FEED_NEED ||
                  foodQty <= 0 ||
                  !foodToConsumeId
                    ? 0.45
                    : 1,
                cursor:
                  !canUseSystem ||
                  !egg ||
                  hatched ||
                  feedCount >= FEED_NEED ||
                  foodQty <= 0 ||
                  !foodToConsumeId
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              🍯 餵養（消耗 1 天地靈寶）
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: 880, maxWidth: "100%" }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
              🐾 孵化選擇（3 選 1）
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {PET_CHOICES.map((p) => {
                const disabled = !canUseSystem || !egg || hatched || feedCount < FEED_NEED;
                return (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.18)",
                      opacity: disabled ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
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
                          src={p.icon}
                          alt={p.name}
                          style={{ width: "86%", height: "86%", objectFit: "contain" }}
                        />
                      </div>

                      <div style={{ fontWeight: 900 }}>{p.name}</div>
                    </div>

                    <div style={{ height: 10 }} />

                    <button
                      className="rpg-btn sm"
                      onClick={() => hatchTo(p)}
                      disabled={disabled}
                      style={{
                        width: "100%",
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      🥚 孵化成這隻
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              規則：Lv5 解鎖 → 使用靈獸蛋啟動系統 → 餵養天地靈寶 ×5 → 孵化三選一。
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}