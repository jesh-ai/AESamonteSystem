/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { FaArrowLeft } from "react-icons/fa";
import styles from "@/css/auth.module.css";

import type { UserInfo } from "@/types/user";
import ForgotPassword from "./ForgotPassword";

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot" | "otp">("login");

  // Login fields
  const [employeeId,      setEmployeeId]      = useState("");
  const [employeeIdError, setEmployeeIdError] = useState("");
  const [password,        setPassword]        = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [rememberMe,      setRememberMe]      = useState(false);

  // 2FA OTP state
  const [otpEmployeeId, setOtpEmployeeId] = useState<number>(0);
  const [otpContact,    setOtpContact]    = useState("");       // masked email shown to user
  const [otp,           setOtp]           = useState(["", "", "", "", "", ""]);
  const [timer,         setTimer]         = useState(0);
  const [otpLoading,    setOtpLoading]    = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  // ── Countdown timer for OTP ──
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Main login submit ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Include any stored device trust token so backend can skip OTP if still valid
      const deviceTrustToken = localStorage.getItem(`2fa_trust_${employeeId}`) ?? '';
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, password, device_trust_token: deviceTrustToken }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Invalid credentials. Please check your Employee ID and password.", "error");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("rememberedEmployeeId", employeeId);
      } else {
        localStorage.removeItem("rememberedEmployeeId");
      }

      // 2FA required — switch to OTP view
      if (data.status === "otp_required") {
        setOtpEmployeeId(data.employee_id);
        setOtpContact(data.contact);
        setOtp(["", "", "", "", "", ""]);
        setTimer(120);
        setView("otp");
        return;
      }

      // Normal login
      localStorage.setItem("token", data.token);
      onLogin({
        employeeId:   data.employee_id,
        roleName:     data.role,
        employeeName: data.employee_name ?? '',
        permissions:  data.permissions,
        token:        data.token,
      });
    } catch {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }
  };

  // ── Store trust token after OTP, then complete login ──
  const completeLoginWithTrust = (data: { token: string; role: string; employee_id: number; employee_name?: string; department?: string; permissions: unknown; device_trust_token?: string }) => {
    if (data.device_trust_token) {
      localStorage.setItem(`2fa_trust_${data.employee_id}`, data.device_trust_token);
    }
    localStorage.setItem("token", data.token);
    onLogin({
      employeeId:   data.employee_id,
      roleName:     data.role,
      employeeName: data.employee_name ?? '',
      permissions:  data.permissions as never,
      token:        data.token,
    });
  };

  // ── OTP box handlers ──
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Verify OTP and complete login ──
  const handleOtpVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { showToast("Please enter the full 6-digit code.", "error"); return; }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/complete-2fa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: otpEmployeeId, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Verification failed.", "error");
        return;
      }
      completeLoginWithTrust(data);
    } catch {
      showToast("Connection failed. Please try again.", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Resend 2FA OTP ──
  const handleResendOtp = async () => {
    try {
      // Re-trigger login which will re-send the OTP
      // We can't resend without the password, so we use send-otp with the known email
      // The contact shown is masked; backend send-otp via email doesn't need exact match for 2FA resend
      // We call the dedicated resend endpoint pattern: just re-call complete-2fa-login will fail,
      // so we need a resend — call send-otp with the stored email is the right approach.
      // Since we only have the masked email, we inform the user to re-login instead.
      // Better UX: go back to login
      setView("login");
      setPassword("");
      showToast("Please log in again to receive a new code.", "info");
    } catch {
      showToast("Failed to resend code.", "error");
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem("rememberedEmployeeId");
    if (savedId) {
      setEmployeeId(savedId);
      setRememberMe(true);
    }
  }, []);

  const handleEmployeeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setEmployeeId(val);
      setEmployeeIdError("");
    } else {
      setEmployeeIdError("Employee ID must contain numbers only.");
    }
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
              <label className={styles.loginLabel}>Employee ID <span style={{ color: "red" }}>*</span></label>
              <input
                type="text"
                value={employeeId}
                onChange={handleEmployeeIdChange}
                className={styles.loginInput}
                required
                suppressHydrationWarning={true}
              />
              {employeeIdError && <span className={styles.fieldError}>{employeeIdError}</span>}
            </div>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Password <span style={{ color: "red" }}>*</span></label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.loginInput}
                  required
                  suppressHydrationWarning={true}
                />
                <span className={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
                </span>
              </div>
            </div>

            <div className={styles.formOptions}>
              <label className={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
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

        ) : view === "otp" ? (
          /* ── 2FA OTP ── */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => { setView("login"); setPassword(""); }}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Two-Factor Authentication</h2>
            <p className={styles.forgotSubtitle}>
              A verification code was sent to <strong>{otpContact}</strong>. Enter it below to continue.
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
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                />
              ))}
            </div>

            <button
              className={styles.loginSubmit}
              onClick={handleOtpVerify}
              disabled={otpLoading}
              style={{ opacity: otpLoading ? 0.7 : 1 }}
            >
              {otpLoading ? 'Verifying...' : 'Verify'}
            </button>

            <div className={styles.emailResendWrapper}>
              {timer > 0 ? (
                <span className={styles.timerText}>Code expires in {formatTime(timer)}</span>
              ) : (
                <button type="button" className={styles.resendBtn} onClick={handleResendOtp}>
                  Code expired — click to go back and log in again
                </button>
              )}
            </div>
          </div>

        ) : (
          /* ── FORGOT PASSWORD ── */
          <ForgotPassword
            employeeId={employeeId}
            employeeIdError={employeeIdError}
            handleEmployeeIdChange={handleEmployeeIdChange}
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
