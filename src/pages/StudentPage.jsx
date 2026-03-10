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
  runTransaction,
} from "firebase/firestore";

import TreasureShop from "../components/TreasureShop";
import { SHOP_ITEMS } from "../data/shopItems";
import { PETS_MASTER, createPetDoc } from "../data/pets";
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
  const [openFashionModal, setOpenFashionModal] = useState(false);

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
            icon: data.icon || "",
            qty: Number(data.qty || 0),
            feedCount: Number(data.feedCount || 0),
            hatched: Boolean(data.hatched || false),
            hatchedTo: data.hatchedTo || "",
            activated: Boolean(data.activated || false),
          };
        });

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

        // 3) 其他商品：進 inventory
        const invSnap = await tx.get(inventoryRef);

        tx.update(sRef, {
          coin: coinNow - cost,
          updatedAt: serverTimestamp(),
        });

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

  const selectedPet = useMemo(() => {
    return petList.find((p) => p.petId === selectedPetId) || petList[0] || null;
  }, [petList, selectedPetId]);

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

      <Modal open={openWeaponModal} title="⚔️ 神兵" onClose={() => setOpenWeaponModal(false)} width={820}>
        <div style={{ opacity: 0.9 }}>
          這裡之後放「神兵列表 / 強化 / 佩戴」等內容（目前先占位）。
        </div>
      </Modal>

      <BackpackModal
        open={openBag}
        onClose={() => setOpenBag(false)}
        items={bagItems}
        slotsPerTab={24}
        onUseItem={handleUseItem}
      />

      <TreasureShop
        open={openTreasure}
        onClose={() => setOpenTreasure(false)}
        mode="student"
        items={SHOP_ITEMS}
        coin={student?.coin ?? 0}
        onBuy={handleStudentBuy}
      />

      <Modal open={openFashionModal} title="👘 時裝" onClose={() => setOpenFashionModal(false)} width={820}>
        <div style={{ opacity: 0.9 }}>
          這裡之後放「時裝清單 / 試穿 / 套用外觀」等內容（目前先占位）。
        </div>
      </Modal>

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
          <div style={{ fontSize: 20, fontWeight: 800 }}>修為：{student.xp ?? 0}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>戰力：{student.cp ?? 0}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>妖丹：{student.coin ?? 0}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>靈寵碎片：{Number(student.petShard || 0)}</div>
        </div>

        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          班級代碼：{meIndex?.classCode || "—"}　|　弟子ID：{meIndex?.studentId || "—"}
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

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="rpg-btn" onClick={() => setOpenAchModal(true)}>🎖️ 成就稱號</button>
        <button className="rpg-btn" onClick={() => setOpenPetModal(true)}>🐾 靈寵</button>
        <button className="rpg-btn" onClick={() => setOpenWeaponModal(true)}>⚔️ 神兵</button>
        <button className="rpg-btn" onClick={() => setOpenBag(true)}>🎒 行囊</button>
      </div>
    </div>
  );
}