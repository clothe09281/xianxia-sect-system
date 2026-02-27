import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
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

export default function StudentPage() {
  const [msg, setMsg] = useState("");
  const [meIndex, setMeIndex] = useState(null); // users/{uid}
  const [student, setStudent] = useState(null); // classes/{classId}/students/{studentId}
  const [studentPath, setStudentPath] = useState(null); // { classId, studentId }

  const navigate = useNavigate();

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

      // 讀 users/{uid} 看是否已認領
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

      const classId = ud.classId;
      const studentId = ud.studentId;
      setStudentPath({ classId, studentId });

      const sRef = doc(db, "classes", classId, "students", studentId);

      // 即時監聽自己的弟子資料
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

  async function handleChangeActiveTitle(next) {
    if (!studentPath) return;

    const allowed = new Set(student?.unlockedTitles || []);
    if (next && !allowed.has(next)) {
      alert("此稱號尚未解鎖，無法選用。");
      return;
    }

    await updateDoc(
      doc(db, "classes", studentPath.classId, "students", studentPath.studentId),
      {
        activeTitle: next || "",
        updatedAt: serverTimestamp(),
      }
    );
  }

  if (msg) {
    return (
      <div style={{ maxWidth: 860, margin: "60px auto", fontFamily: "sans-serif", color: "#fff" }}>
        <h2>學生頁</h2>
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{msg}</div>
        <div style={{ height: 12 }} />
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
        <h2>弟子面板</h2>
        <button className="rpg-btn" onClick={() => signOut(auth)}>登出</button>
      </div>

      {/* ✅ 稱號（學生可選） */}
      <div style={{ marginTop: 12 }}>
  <div style={{ fontWeight: 700, marginBottom: 6 }}>稱號（學生可選）</div>

  <select
    value={student.activeTitle || ""}
    onChange={async (e) => {
      const next = String(e.target.value || "");

      // ✅ 必須是已解鎖的稱號才可選（空字串代表不配戴）
      const unlocked = Array.isArray(student.unlockedTitles) ? student.unlockedTitles : [];
      const ok = next === "" || unlocked.includes(next);

      if (!ok) {
        alert("此稱號尚未解鎖，不能配戴。");
        return;
      }

      await updateDoc(doc(db, "classes", meIndex.classId, "students", meIndex.studentId), {
        activeTitle: next,
        updatedAt: serverTimestamp(),
      });
    }}
    style={{ padding: 8, width: 260 }}
  >
    <option value="">（不配戴稱號）</option>
    {(student.unlockedTitles || []).map((t) => (
      <option key={t} value={t}>{t}</option>
    ))}
  </select>

  <div style={{ height: 10 }} />

  <div style={{ fontSize: 12, opacity: 0.85 }}>
    已解鎖成就：{Array.isArray(student.unlockedAchievements) ? student.unlockedAchievements.length : 0} 個
    {(!student.unlockedTitles || student.unlockedTitles.length === 0) ? "（目前沒有可配戴稱號）" : ""}
  </div>
</div>

      <div
        style={{
          marginTop: 14,
          padding: 18,
          border: "1px solid rgba(218,185,120,0.35)",
          borderRadius: 12,
          background: "rgba(20,20,20,0.85)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {student.name}
          {student.activeTitle ? (
            <span style={{ marginLeft: 10, fontSize: 13, opacity: 0.85 }}>
              「{student.activeTitle}」
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
          <div>修為：{student.xp ?? 0}</div>
          <div>戰力：{student.cp ?? 0}</div>
          <div>妖丹：{student.coin ?? 0}</div>
        </div>

        <div style={{ height: 10 }} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          班級代碼：{meIndex?.classCode || "—"}　|　弟子ID：{meIndex?.studentId || "—"}
        </div>
      </div>
    </div>
  );
}