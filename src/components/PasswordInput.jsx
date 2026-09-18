import { useState } from "react";

export default function PasswordInput({
  value,
  onChange,
  placeholder = "至少 6 碼",
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <label>密碼</label>

      <div
        style={{
          position: "relative",
          margin: "6px 0 14px",
        }}
      >
        <input
          style={{
            width: "100%",
            padding: "10px 42px 10px 10px",
            boxSizing: "border-box",
          }}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
        />

        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
          title={showPassword ? "隱藏密碼" : "顯示密碼"}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            fontSize: 18,
          }}
        >
          {showPassword ? "🙈" : "👁️"}
        </button>
      </div>
    </>
  );
}