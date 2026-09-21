import {
  addDoc,
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  increment,
} from "firebase/firestore";

import { db } from "../firebase";

export async function createChallengeSession({
  classId,
  monster,
  teacherUid,
}) {
  if (!classId) {
    throw new Error("缺少班級代號");
  }

  if (!monster?.id) {
    throw new Error("缺少怪物資料");
  }

  const sessionRef = await addDoc(
    collection(
      db,
      "classes",
      classId,
      "challengeSessions"
    ),
    {
      monsterId: monster.id,

      // 保存「當下」的怪物資料，避免未來修改怪物後歷史紀錄跟著改變
      monsterSnapshot: {
        name: monster.name,
        maxHp: Number( monster.maxHp ?? 0 ),
        xpReward: Number( monster.xpReward ?? 0 ),
        cpReward: Number( monster.cpReward ?? 0 ),
        coinReward: Number( monster.coinReward ?? 0 ),
        imagePath: monster.imagePath || "",
        },

      startedAt: serverTimestamp(),
      endedAt: null,

      status: "active",
      result: null,

      participantCount: 0,

      createdBy: teacherUid || null,
    }
  );

  return sessionRef.id;
}

export async function abortChallengeSession({
  classId,
  sessionId,
}) {
  if (!classId || !sessionId) return;

  await updateDoc(
    doc(
      db,
      "classes",
      classId,
      "challengeSessions",
      sessionId
    ),
    {
      status: "aborted",
      endedAt: serverTimestamp(),
    }
  );
}

export async function recordChallengeAnswer({
  classId,
  sessionId,
  students,
  result,
  participantCount,
}) {
  if (!classId) {
    throw new Error("缺少 classId");
  }

  if (!sessionId) {
    throw new Error("缺少 challenge session");
  }

  if (!Array.isArray(students) || students.length === 0) {
    throw new Error("沒有選擇學生");
  }

  if (result !== "correct" && result !== "wrong") {
    throw new Error("無效的答題結果");
  }

  const sessionRef = doc(
    db,
    "classes",
    classId,
    "challengeSessions",
    sessionId
  );

  await runTransaction(db, async (tx) => {
    // =========================
    // 答錯時，要先取得學生目前 HP
    // 因為 HP 不允許低於 0
    // =========================
    const studentSnapshots = [];

    if (result === "wrong") {
      for (const student of students) {
        const studentRef = doc(
          db,
          "classes",
          classId,
          "students",
          student.id
        );

        const snap = await tx.get(studentRef);

        if (!snap.exists()) {
          throw new Error(`找不到學生：${student.name || student.id}`);
        }

        studentSnapshots.push({
          student,
          studentRef,
          snap,
        });
      }
    }

    // =========================
    // 更新每位學生在這場歷練的紀錄
    // =========================
    for (const student of students) {
      const participantRef = doc(
        db,
        "classes",
        classId,
        "challengeSessions",
        sessionId,
        "participants",
        student.id
      );

      tx.set(
        participantRef,
        {
          studentId: student.id,

          // 保留歷史名稱快照
          studentNameSnapshot: student.name || student.id,

          correctCount: increment(result === "correct" ? 1 : 0),
          wrongCount: increment(result === "wrong" ? 1 : 0),

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // =========================
    // 答錯：每位被勾選學生 HP -10
    // 最低只能到 0
    // =========================
    if (result === "wrong") {
      for (const {
        studentRef,
        snap,
      } of studentSnapshots) {
        const data = snap.data() || {};

        const currentHp = Number(data.hpNow ?? 100);
        const nextHp = Math.max(0, currentHp - 10);

        tx.update(studentRef, {
          hpNow: nextHp,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 更新這場歷練目前真正參與過的人數
    tx.update(sessionRef, {
      participantCount,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function completeChallengeSession({
  classId,
  sessionId,
  participantCount,
}) {
  if (!classId || !sessionId) {
    throw new Error("缺少歷練場次資料");
  }

  const sessionRef = doc(
    db,
    "classes",
    classId,
    "challengeSessions",
    sessionId
  );

  await updateDoc(sessionRef, {
    status: "completed",
    result: "victory",
    participantCount: Number(participantCount || 0),

    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}