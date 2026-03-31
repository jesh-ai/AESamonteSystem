/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useEffect } from "react";
import { FaArrowLeft } from "react-icons/fa";
import styles from "@/css/auth.module.css";

interface ForgotPasswordProps {
  employeeId: string;
  employeeIdError: string;
  handleEmployeeIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToast: (message: string, type: "error" | "success" | "info") => void;
  onBack: () => void;
}

export default function ForgotPassword({
  employeeId,
  employeeIdError,
  handleEmployeeIdChange,
  showToast,
  onBack,
}: ForgotPasswordProps) {
  const [view, setView] = useState<"email_info" | "email_otp">("email_info");
  const [emailAddress, setEmailAddress] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const [showPop, setShowPop] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpVerify = async () => {
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.join(""), employeeId, method: "email" }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowPop(true);
      } else {
        showToast(data.message || "Invalid OTP. Please try again.", "error");
      }
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  const handleSendOtp = async () => {
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, contact: emailAddress, method: "email" }),
      });
      const data = await response.json();
      if (response.ok) {
        setTimer(120);
        setView("email_otp");
      } else {
        showToast(data.message || "Failed to send OTP. Please check your information.", "error");
      }
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  return (
    <>
      {view === "email_info" ? (
        /* --- EMAIL INFO ENTRY --- */
        <div className={styles.forgotContainer}>
          <button className={styles.backBtn} onClick={onBack}>
            <FaArrowLeft />
          </button>
          <h2 className={styles.forgotTitle}>Forgot Password?</h2>
          <p className={styles.forgotSubtitle}>Enter your Username and registered email to receive a verification code.</p>

          <div className={styles.loginField}>
            <label className={styles.loginLabel}>Username <span style={{ color: "red" }}>*</span></label>
            <input
              type="text"
              placeholder="Username"
              value={employeeId}
              onChange={handleEmployeeIdChange}
              className={styles.loginInput}
            />
            {employeeIdError && <span className={styles.fieldError}>{employeeIdError}</span>}
          </div>

          <div className={styles.loginField} style={{ marginTop: "15px" }}>
            <label className={styles.loginLabel}>Email Address <span style={{ color: "red" }}>*</span></label>
            <input
              type="email"
              placeholder="Email Address"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className={styles.loginInput}
            />
          </div>

          <button className={styles.loginSubmit} style={{ marginTop: "25px" }} onClick={handleSendOtp}>
            Send OTP
          </button>
        </div>

      ) : (
        /* --- EMAIL OTP VIEW --- */
        <div className={styles.forgotContainer}>
          <button className={styles.backBtn} onClick={() => setView("email_info")}>
            <FaArrowLeft />
          </button>
          <h2 className={styles.forgotTitle}>Enter Verification Code</h2>
          <p className={styles.forgotSubtitle}>
            Please enter the One Time Passcode sent to your registered email address.
          </p>

          <div className={styles.otpInputGroup}>
            {otp.map((digit, index) => (
              <input
                key={index}
                className={styles.otpBox}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                ref={(el) => { if (el) inputRefs.current[index] = el; }}
                onChange={(e) => handleOtpChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
            ))}
          </div>

          <button className={styles.loginSubmit} onClick={handleOtpVerify}>
            Verify OTP
          </button>

          <div className={styles.emailResendWrapper}>
            {timer > 0 ? (
              <span className={styles.timerText}>{formatTime(timer)}</span>
            ) : (
              <button
                type="button"
                className={styles.resendBtn}
                onClick={() => {
                  handleSendOtp();
                  showToast("Verification email resent. Please check your inbox.", "success");
                }}
              >
                Did not receive an email?
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM PASSWORD RESET POPUP */}
      {showPop && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Confirm Password Reset</h2>
            <p className={styles.modalText}>
              A system-generated temporary password will be issued to your account.
              The administrator will also be notified.
            </p>
            <p className={styles.modalQuestion}>Do you want to proceed?</p>

            <div className={styles.modalButtons}>
              <button className={styles.closeBtn} onClick={() => setShowPop(false)}>Close</button>
              <button
                className={styles.confirmBtn}
                onClick={async () => {
                  try {
                    const response = await fetch("/api/auth/reset-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ employeeId, email: emailAddress }),
                    });
                    const data = await response.json();
                    setShowPop(false);
                    if (response.ok) {
                      onBack();
                      showToast("Temporary password sent! Please check your email.", "success");
                    } else {
                      showToast(data.message || "Failed to reset password.", "error");
                    }
                  } catch {
                    showToast("Connection failed. Please try again.", "error");
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
