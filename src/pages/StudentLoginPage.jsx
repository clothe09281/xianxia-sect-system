import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
  runTransaction,
} from "firebase/firestore";
import bg from "../assets/bg-marble.jpg";

function normName(s) {
  return (s ?? "").trim();
}
function normCode(s) {
  return (s ?? "").trim().toUpperCase();
}

async function findClassByCode(classCode) {
  const code = normCode(classCode);
  const qy = query(collection(db, "classes"), where("code", "==", code), limit(1));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const c = snap.docs[0];
  return { classId: c.id, ...c.data() };
}

/**
 * 認領流程（最關鍵）
 * - 找到 classes/{classId}/students 內：name == studentName 且 authUid == null 的那筆
 * - 用 transaction 把 authUid 設成目前 uid，避免被別人同時搶走
 * - 寫入 users/{uid}：role=student + classId + studentId
 */
async function claimStudent({ user, classId, studentName, classCode }) {
  const name = normName(studentName);
  if (!name) throw new Error("請輸入弟子名稱");

  // 先找到候選 student 文件（只找尚未被認領者）
  const studentsRef = collection(db, "classes", classId, "students");
  const qy = query(
    studentsRef,
    where("name", "==", name),
    where("authUid", "==", null),
    limit(1)
  );
  const snap = await getDocs(qy);

  if (snap.empty) {
    throw new Error("找不到可認領的弟子：請確認老師已建立該弟子，且尚未被其他人認領");
  }

  const studentDoc = snap.docs[0];
  const studentRef = doc(db, "classes", classId, "students", studentDoc.id);
  const userRef = doc(db, "users", user.uid);

  // 用 transaction 保證同一時間只有一個人能成功認領
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(studentRef);
    if (!fresh.exists()) throw new Error("該弟子已不存在，請請老師重新建立。");

    const data = fresh.data();
    if (data.authUid) {
      throw new Error("此弟子已被認領，請換一個弟子名稱或請老師確認。");
    }

    tx.update(studentRef, {
      authUid: user.uid,
      claimedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(
      userRef,
      {
        role: "student",
        email: user.email ?? "",
        displayName: name,
        studentName: name,
        classId,
        classCode: normCode(classCode),
        studentId: studentDoc.id,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { studentId: studentDoc.id };
}

export default function StudentLoginPage() {
  const [tab, setTab] = useState("login"); // login | claim
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [studentName, setStudentName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();

  // 若已登入且已認領過：直接送去 /student
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const usnap = await getDoc(doc(db, "users", u.uid));
      const ud = usnap.exists() ? usnap.data() : null;
      if (ud?.role === "student" && ud?.classId && ud?.studentId) {
        navigate("/student");
      }
    });
    return () => unsub();
  }, [navigate]);

  async function handleLogin() {
    setMsg("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);

      // 登入後確認是否已有認領索引
      const u = auth.currentUser;
      const usnap = u ? await getDoc(doc(db, "users", u.uid)) : null;
      const ud = usnap && usnap.exists() ? usnap.data() : null;

      if (ud?.role === "student" && ud?.classId && ud?.studentId) {
        navigate("/student");
      } else {
        setMsg("✅ 登入成功，但你尚未認領弟子。請切到「註冊/認領」完成一次認領。");
        setTab("claim");
      }
    } catch (e) {
      setMsg(e?.message || "登入失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterAndClaim() {
    setMsg("");
    setBusy(true);
    try {
      const code = normCode(classCode);
      const name = normName(studentName);

      if (!email.trim()) throw new Error("請輸入 Email");
      if (pw.length < 6) throw new Error("密碼至少 6 碼");
      if (!code) throw new Error("請輸入班級代碼");
      if (!name) throw new Error("請輸入弟子名稱（要跟老師建立的一樣）");

      // 1) 註冊帳號
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);

      // 2) 找班級
      const clazz = await findClassByCode(code);
      if (!clazz) throw new Error("班級代碼不存在，請確認老師提供的代碼");

      // 3) 認領弟子
      await claimStudent({
        user: cred.user,
        classId: clazz.classId,
        studentName: name,
        classCode: code,
      });

      navigate("/student");
    } catch (e) {
      setMsg(e?.message || "註冊/認領失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
        <div
          style={{
            minHeight: "100vh",
            backgroundImage: `url(${bg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "#fff",
            position: "relative",
          }}
        >
          {/* ✅ 跟老師頁面一樣的「框框卡片」 */}
    <div className="login-wrap">
    <div className="login-card">

    <div style={{ maxWidth: 520, margin: "70px auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: 10 }}>學生登入</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          className="rpg-btn sm"
          onClick={() => setTab("login")}
          style={{ opacity: tab === "login" ? 1 : 0.6 }}
          disabled={busy}
        >
          登入
        </button>
        <button
          className="rpg-btn sm"
          onClick={() => setTab("claim")}
          style={{ opacity: tab === "claim" ? 1 : 0.6 }}
          disabled={busy}
        >
          註冊 / 認領加入班級
        </button>
      </div>

      <label>Email</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />

      <label>密碼</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="至少 6 碼"
        type="password"
        autoComplete={tab === "login" ? "current-password" : "new-password"}
      />

      {tab === "claim" && (
        <>
          <label>弟子名稱（必填：要跟老師建立的一樣）</label>
          <input
            style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="例如：花前"
          />

          <label>班級代碼（必填：老師提供）</label>
          <input
            style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            placeholder="例如：RRXJSQ"
          />
        </>
      )}

      {msg && <div style={{ color: msg.includes("✅") ? "green" : "crimson", marginBottom: 10 }}>{msg}</div>}

      {tab === "login" ? (
        <button className="rpg-btn" onClick={handleLogin} disabled={busy}>
          {busy ? "登入中..." : "登入"}
        </button>
      ) : (
        <button className="rpg-btn" onClick={handleRegisterAndClaim} disabled={busy}>
          {busy ? "處理中..." : "註冊並認領弟子"}
        </button>
      )}
    </div>
    </div>
    </div>
    </div>
  );
}
