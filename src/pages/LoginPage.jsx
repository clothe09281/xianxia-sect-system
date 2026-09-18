import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
import PasswordInput from "../components/PasswordInput";

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
      console.error(e);
      setMsg("登入失敗，請確認 Email 與密碼是否正確。");
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
      console.error(e);

      if (e.code === "auth/email-already-in-use") {
        setMsg("此 Email 已經註冊，請直接登入或使用忘記密碼。");
      } else if (e.code === "auth/weak-password") {
        setMsg("密碼至少需要 6 碼。");
      } else if (e.code === "auth/invalid-email") {
        setMsg("Email 格式不正確。");
      } else {
        setMsg("註冊失敗，請稍後再試。");
      }
    }
  }

  async function handleForgotPassword() {
    setMsg("");

    if (!email.trim()) {
      setMsg("請先輸入註冊時使用的 Email。");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());

      setMsg("密碼重設信已寄出，請至信箱查看。");
    } catch (e) {
      console.error(e);

      // 不直接透露帳號是否存在
      setMsg("若此 Email 已註冊，我們會寄送密碼重設信，請至信箱查看。");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: 'url("/background.jpg")',
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
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ maxWidth: 520, margin: "70px auto", fontFamily: "sans-serif" }}>
            <h2 style={{ marginBottom: 10 }}>師尊登入</h2>
            <p style={{ color: "#555" }}>第一次使用請先註冊（密碼至少 6 碼）。</p>

            <label>Email</label>
            <input
              style={{ width: "100%", padding: 10, margin: "6px 0 14px" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <PasswordInput
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ padding: "10px 14px" }} onClick={handleLogin}>
                登入
              </button>
              <button style={{ padding: "10px 14px" }} onClick={handleRegister}>
                註冊
              </button>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              style={{
                marginTop: 12,
                padding: 0,
                border: "none",
                background: "transparent",
                color: "#555",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              忘記密碼？
            </button>

            {msg && <p style={{ marginTop: 14, color: "crimson" }}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
