'use client';

import React, { useState } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import styles from "@/css/auth.module.css";
import type { UserInfo } from "@/types/user";

interface CreatePasswordProps {
  userInfo: UserInfo;
  onLoginAgain: () => void;
}

export default function CreatePassword({ userInfo, onLoginAgain }: CreatePasswordProps) {
  const [tempPw,      setTempPw]      = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showTempPw,  setShowTempPw]  = useState(false);
  const [showNewPw,   setShowNewPw]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [succeeded,   setSucceeded]   = useState(false);

  // Field-level errors (shown inline under each input, like the login page)
  const [tempPwError,    setTempPwError]    = useState("");
  const [newPwError,     setNewPwError]     = useState("");
  const [confirmPwError, setConfirmPwError] = useState("");

  // Alert modal (same style as the login page toast)
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ message, type });
    toastRef.current = setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset all field errors first
    setTempPwError("");
    setNewPwError("");
    setConfirmPwError("");

    let hasError = false;

    if (!tempPw) {
      setTempPwError("Please enter your temporary password.");
      hasError = true;
    } else if (tempPw.length < 8) {
      setTempPwError("Password must be at least 8 characters.");
      hasError = true;
    }

    if (!newPw) {
      setNewPwError("Please enter a new password.");
      hasError = true;
    } else if (newPw.length < 8) {
      setNewPwError("Password must be at least 8 characters.");
      hasError = true;
    } else if (newPw === tempPw) {
      setNewPwError("New password must be different from the temporary password.");
      hasError = true;
    }

    if (!confirmPw) {
      setConfirmPwError("Please confirm your new password.");
      hasError = true;
    } else if (confirmPw !== newPw) {
      setConfirmPwError("Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({
          employeeId:      userInfo.employeeId,
          currentPassword: tempPw,
          newPassword:     newPw,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.message || "Failed to set password.";
        // If the backend says the current password is wrong, show it under the temp field
        if (msg.toLowerCase().includes("current")) {
          setTempPwError("Incorrect temporary password. Please check your email and try again.");
        } else {
          showToast(msg, "error");
        }
        return;
      }

      setSucceeded(true);
    } catch {
      showToast("Connection failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>

      {/* Logo */}
      <div className={styles.loginLogo}>
        <Image
          src="/ae-logo.png"
          alt="AE Samonte Logo"
          width={100}
          height={100}
          className={styles.loginLogoImg}
          priority
        />
      </div>

      <div className={styles.loginFormBox}>

        {!succeeded ? (
          /* ── FORM VIEW ── */
          <form onSubmit={handleSubmit} className={styles.loginForm} style={{ gap: "14px" }}>

            {/* Header */}
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#164163", margin: 0 }}>
                Create Your Password
              </h2>
              <p style={{ fontSize: "13px", color: "#555", marginTop: "8px", lineHeight: 1.5, margin: "8px 0 0" }}>
                Enter the temporary password from your email, then set a new password.
              </p>
            </div>

            {/* Temporary Password */}
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>
                Temporary Password <span style={{ color: "red" }}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showTempPw ? "text" : "password"}
                  className={styles.loginInput}
                  value={tempPw}
                  maxLength={25}
                  placeholder="Enter temporary password"
                  style={tempPwError ? { borderColor: "#e53935" } : {}}
                  onChange={e => {
                    const val = e.target.value;
                    if (/\s/.test(val)) return;
                    setTempPw(val);
                    setTempPwError(val.length > 0 && val.length < 8 ? "Password must be at least 8 characters." : "");
                  }}
                />
                <span className={styles.eyeIcon} onClick={() => setShowTempPw(v => !v)}>
                  {showTempPw ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
              {tempPwError && <span className={styles.fieldError}>{tempPwError}</span>}
            </div>

            {/* New Password */}
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>
                New Password <span style={{ color: "red" }}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showNewPw ? "text" : "password"}
                  className={styles.loginInput}
                  value={newPw}
                  maxLength={25}
                  placeholder="8–25 characters"
                  style={newPwError ? { borderColor: "#e53935" } : {}}
                  onChange={e => {
                    const val = e.target.value;
                    if (/\s/.test(val)) return;
                    setNewPw(val);
                    setNewPwError(val.length > 0 && val.length < 8 ? "Password must be at least 8 characters." : "");
                  }}
                />
                <span className={styles.eyeIcon} onClick={() => setShowNewPw(v => !v)}>
                  {showNewPw ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
              {newPwError && <span className={styles.fieldError}>{newPwError}</span>}
              <p style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "right", marginTop: "2px", marginBottom: "-6px" }}>
                {newPw.length}/25
              </p>
            </div>

            {/* Confirm New Password */}
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>
                Confirm New Password <span style={{ color: "red" }}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showConfirm ? "text" : "password"}
                  className={styles.loginInput}
                  value={confirmPw}
                  maxLength={25}
                  placeholder="Confirm new password"
                  style={confirmPwError ? { borderColor: "#e53935" } : {}}
                  onChange={e => {
                    const val = e.target.value;
                    if (/\s/.test(val)) return;
                    setConfirmPw(val);
                    setConfirmPwError(val.length > 0 && val !== newPw ? "Passwords do not match." : "");
                  }}
                />
                <span className={styles.eyeIcon} onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
              {confirmPwError && <span className={styles.fieldError}>{confirmPwError}</span>}
            </div>

            <button type="submit" className={styles.loginSubmit} disabled={loading}>
              {loading ? "SAVING..." : "SET PASSWORD"}
            </button>
          </form>

        ) : (
          /* ── SUCCESS VIEW ── */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "#43a047",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#164163", margin: 0 }}>
              Password Set!
            </h2>
            <p style={{ fontSize: "13px", color: "#555", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              Your password has been created successfully.
            </p>

            <button className={styles.loginSubmit} style={{ marginTop: "8px" }} onClick={onLoginAgain}>
              BACK TO LOGIN
            </button>
          </div>
        )}
      </div>

      {/* Alert modal — same style as the login page */}
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
              <button
                className={`${styles.alertModalOkBtn} ${styles[`alertOkBtn_${toast.type}`]}`}
                onClick={() => setToast(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
