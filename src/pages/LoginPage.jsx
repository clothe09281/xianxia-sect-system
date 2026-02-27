import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

// 產生班級代碼：6碼（大寫+數字）
function genClassCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// 確保老師 users/{uid} 存在 + 確保有 class
async function ensureTeacherAndClass(uid, email) {
  // 1) users/{uid}：老師索引
  await setDoc(
    doc(db, "users", uid),
    {
      role: "teacher",
      email,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 2) 是否已有班級
  const q1 = query(collection(db, "classes"), where("teacherUid", "==", uid));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    const c = snap1.docs[0];
    return { classId: c.id, code: c.data().code };
  }

  // 3) 建立新班級（確保 code 不重複）
  let code = genClassCode();
  while (true) {
    const q2 = query(collection(db, "classes"), where("code", "==", code));
    const s2 = await getDocs(q2);
    if (s2.empty) break;
    code = genClassCode();
  }

  const ref = await addDoc(collection(db, "classes"), {
    code,
    teacherUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { classId: ref.id, code };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    setMsg("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);

      // ✅ 登入後確保 users + class
      await ensureTeacherAndClass(cred.user.uid, cred.user.email || email);

      navigate("/dashboard");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function handleRegister() {
    setMsg("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);

      // ✅ 註冊後確保 users + class
      await ensureTeacherAndClass(cred.user.uid, cred.user.email || email);

      navigate("/dashboard");
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="scroll-box">
      <h2>師尊登入</h2>
      <p style={{ color: "#555" }}>第一次使用請先註冊（密碼至少 6 碼）。</p>

      <label>Email</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <label>密碼</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="至少 6 碼"
        type="password"
      />

      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ padding: "10px 14px" }} onClick={handleLogin}>
          登入
        </button>
        <button style={{ padding: "10px 14px" }} onClick={handleRegister}>
          註冊
        </button>
      </div>

      {msg && <p style={{ marginTop: 14, color: "crimson" }}>{msg}</p>}
    </div>
  );
}
