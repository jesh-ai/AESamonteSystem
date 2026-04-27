/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import styles from "@/css/auth.module.css";

import type { UserInfo } from "@/types/user";
import ForgotPassword from "./ForgotPassword";

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot">("login");

  const [username,      setUsername]      = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [password,      setPassword]      = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [rememberMe,    setRememberMe]    = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const saved = localStorage.getItem("rememberedUsername");
     const remembered = localStorage.getItem("rememberMe") === "true";
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    } else {
      setRememberMe(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password, remember_me: rememberMe }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Invalid credentials. Please check your username and password.", "error");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
        localStorage.setItem("rememberMe", "true"); 
      } else {
        localStorage.removeItem("rememberedUsername");
        localStorage.removeItem("rememberMe");  
      }

      localStorage.setItem("token", data.token);
      onLogin({
        employeeId:       data.employee_id,
        employeeName:     data.employee_name,
        employeeUsername: data.employee_username,
        roleName:         data.role,
        roleId:           data.role_id,
        permissions:      data.permissions,
        token:            data.token,
      });
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/\s/.test(val)) return;
    if (val.length > 25) {
      setUsernameError("Username must be 25 characters or fewer.");
      return;
    }
    if (val === "" || /^[a-zA-Z0-9._@]+$/.test(val)) {
      setUsername(val);
      setUsernameError(val.length > 0 && val.length < 8 ? "Username must be at least 8 characters." : "");
    } else {
      setUsernameError("Username may only contain letters, numbers, and ( _ . @ )");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/\s/.test(val)) return;
    if (val.length > 25) {
      setPasswordError("Password must be 25 characters or fewer.");
      return;
    }
    setPassword(val);
    setPasswordError(val.length > 0 && val.length < 8 ? "Password must be at least 8 characters." : "");
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginLogo}>
        <Image
          src="/ae-logo.png"
          alt="AE Samonte Logo"
          width={100}
          height={100}
          className={styles.loginLogoImg}
          priority
        />
        {view === "login" && <h2 className={styles.loginTitle}>Welcome Back!</h2>}
      </div>

      <div className={styles.loginFormBox}>
        {view === "login" ? (
          /* ── LOGIN ── */
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Username <span style={{ color: "red" }}>*</span></label>
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className={styles.loginInput}
                autoComplete="username"
                required
                suppressHydrationWarning={true}
              />
              {usernameError && <span className={styles.fieldError}>{usernameError}</span>}
            </div>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Password <span style={{ color: "red" }}>*</span></label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  className={styles.loginInput}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  required
                />
                <span className={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
              {passwordError && <span className={styles.fieldError}>{passwordError}</span>}
            </div>

            <div className={styles.formOptions}>
              <label className={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberMe(checked);
                  if (checked) {
                    localStorage.setItem("rememberMe", "true");
                  } else {
                    localStorage.removeItem("rememberMe");
                    localStorage.removeItem("rememberedUsername"); // ✅ also clear username immediately
                  }
                }}
                />
                <span>Remember Me</span>
              </label>
              <a href="#" className={styles.forgotLink} onClick={() => setView("forgot")}>
                Forgot Password?
              </a>
            </div>

            <button suppressHydrationWarning={true} type="submit" className={styles.loginSubmit}>
              LOGIN
            </button>
          </form>

        ) : (
          /* ── FORGOT PASSWORD ── */
          <ForgotPassword
            employeeId={username}
            employeeIdError={usernameError}
            handleEmployeeIdChange={handleUsernameChange}
            showToast={showToast}
            onBack={() => setView("login")}
          />
        )}
      </div>

      {/* ALERT MODAL */}
      {toast && (
        <div className={styles.modalOverlay}>
          <div className={styles.alertModal}>
            <div className={`${styles.alertModalBand} ${styles[`alertBand_${toast.type}`]}`} />
            <div className={`${styles.alertModalCircle} ${styles[`alertCircle_${toast.type}`]}`}>
              {toast.type === "error" ? "✕" : toast.type === "success" ? "✓" : "ℹ"}
            </div>
            <div className={styles.alertModalBody}>
              <h2 className={styles.alertModalTitle}>
                {toast.type === "error" ? "Error" : toast.type === "success" ? "Success" : "Notice"}
              </h2>
              <p className={styles.alertModalMessage}>{toast.message}</p>
              <button className={`${styles.alertModalOkBtn} ${styles[`alertOkBtn_${toast.type}`]}`} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
