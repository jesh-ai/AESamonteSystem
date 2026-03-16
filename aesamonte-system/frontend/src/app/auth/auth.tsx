/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { FaMobileAlt, FaEnvelope, FaArrowLeft } from "react-icons/fa"; 
import styles from "@/css/auth.module.css";

import type { UserInfo } from "@/types/user";

interface LoginProps {
  onLogin: (user: UserInfo) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot" | "sms" |"sms_otp" | "email_info" | "email_otp">("login");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeIdError, setEmployeeIdError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const [showPop, setShowPop] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                employee_id: employeeId, // Matches backend data.get('employee_id')
                password: password 
            }),
        });

      const data = await response.json();

      if (response.ok) {
        if (rememberMe) {
          localStorage.setItem("rememberedEmployeeId", employeeId);
        } else {
          localStorage.removeItem("rememberedEmployeeId");
        }
        localStorage.setItem("token", data.token);
        onLogin({
          employeeId:  data.employee_id,
          roleName:    data.role,
          department:  data.department ?? null,
          permissions: data.permissions,
          token:       data.token,
        });
      } else {
        showToast(data.message || "Invalid credentials. Please check your Employee ID and password.", "error");
      }
    } catch (err) {
      showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
    }

  };

  // inside Login component in src/app/auth/auth.tsx
  useEffect(() => {
      const savedId = localStorage.getItem("rememberedEmployeeId");
      if (savedId) {
          setEmployeeId(savedId);
          setRememberMe(true); // Keep the checkbox checked for the user
      }
  }, []);
  
  /* Time for Verification */
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
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleResend = () => {
    setTimer(120);
    showToast("OTP resent to your registered phone number.", "success");
  };

  const handleEmployeeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setEmployeeId(val);
      setEmployeeIdError("");
    } else {
      setEmployeeIdError("Employee ID must contain numbers only.");
    }
  };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (value: string, index: number) => {
      if (!/^\d*$/.test(value)) return; // Only allow numbers
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

    const handleOtpVerify = async (otpValue: string) => {
      //e.preventDefault();
      try {
        const response = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            otp: otpValue,
            employeeId: employeeId,
            method: view === "sms_otp" ? "sms" : "email"
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setShowPop(true);
        } else {
          showToast(data.message || "Invalid OTP. Please try again.", "error");
        }
      } catch (err) {
        showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
      }
    };

    const handleSendOtp = async (method: "sms" | "email") => {
      try {
        const response = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            employeeId: employeeId,
            contact: method === "sms" ? contactNumber : emailAddress,
            method: method
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setTimer(120);
          setView(method === "sms" ? "sms_otp" : "email_otp");
        } else {
          showToast(data.message || "Failed to send OTP. Please check your information.", "error");
        }
      } catch (err) {
        showToast("Connection failed. The backend server is unreachable. Please try again later.", "error");
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
        {/* --- LOGIN --- */}
        {view === "login" ? (
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

            <button
              suppressHydrationWarning={true}
              type="submit"
              className={styles.loginSubmit}
            >
              LOGIN
            </button>
          </form>
        ) : view === "forgot" ? (
          /* --- CHOOSE --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("login")}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Forgot Password?</h2>
            <p className={styles.forgotSubtitle}>Choose how you want to recover your account.</p>

            <button className={styles.recoveryOption} onClick={() => setView("sms")}>
              <FaMobileAlt className={styles.recoveryIcon} />
              <div className={styles.recoveryText}>
                <strong>via SMS</strong>
                <span>A verification code will be sent to your registered mobile number.</span>
              </div>
            </button>

            <button className={styles.recoveryOption} onClick={() => setView("email_info")}>
              <FaEnvelope className={styles.recoveryIcon} />
              <div className={styles.recoveryText}>
                <strong>via Email</strong>
                <span>A verification code will be sent to your registered email.</span>
              </div>
            </button>
          </div>
        ) : view === "sms" ? (
          /* --- SMS INFO ENTRY --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("forgot")}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Forgot Password?</h2>
            <p className={styles.forgotSubtitle}>To continue, enter the information for the selected recovery method.</p>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID <span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={handleEmployeeIdChange}
                className={styles.loginInput}
              />
              {employeeIdError && <span className={styles.fieldError}>{employeeIdError}</span>}
            </div>

            <div className={styles.loginField} style={{marginTop: '15px'}}>
              <label className={styles.loginLabel}>Contact Number <span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                placeholder="Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className={styles.loginInput}
              />
            </div>

            <button className={styles.loginSubmit} style={{marginTop: '25px'}} onClick={() => setView("sms_otp")}>
              Send OTP
            </button>
          </div>

        ) : view === "sms_otp" ? ( 
          /* --- SMS OTP VIEW (The 6 Boxes) --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("sms")}><FaArrowLeft /></button>
            <h2 className={styles.forgotTitle}>Enter Verification Code</h2>
            <p className={styles.forgotSubtitle}>Please enter the One Time Passcode sent to your registered phone number: 
              XXXXXXXXX681</p> 

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

            <button className={styles.loginSubmit} onClick={() => setShowPop(true)}>
              Verify OTP
            </button>

            <div className={styles.timerWrapper}>
              {timer > 0 ? (
                <span className={styles.timerText}>{formatTime(timer)}</span>
              ) : (
                <button type="button" className={styles.resendBtn} onClick={handleResend}>
                  Resend Verification Code
                </button>
              )}
            </div>
          </div> 

        ) : view === "email_info" ? (
          /* --- EMAIL INFO ENTRY --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("forgot")}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Forgot Password?</h2>
            <p className={styles.forgotSubtitle}>To continue, enter the information for the selected recovery method.</p>
            
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID <span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={handleEmployeeIdChange}
                className={styles.loginInput}
              />
              {employeeIdError && <span className={styles.fieldError}>{employeeIdError}</span>}
            </div>

            <div className={styles.loginField} style={{marginTop: '15px'}}>
              <label className={styles.loginLabel}>Email Address <span style={{color: 'red'}}>*</span></label>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={emailAddress} 
                onChange={(e) => setEmailAddress(e.target.value)} 
                className={styles.loginInput} 
              />
            </div>
            
            <button className={styles.loginSubmit} style={{marginTop: '25px'}} onClick={() => setView("email_otp")}>
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

              <button className={styles.loginSubmit} onClick={() => setShowPop(true)}>
                Verify OTP
              </button>

              <div className={styles.emailResendWrapper}>
              {timer > 0 ? (
                /* When the timer is counting down, show only the numbers */
                <span className={styles.timerText}>{formatTime(timer)}</span>
              ) : (
                /* When timer is 0, show ONLY the blue clickable text */
                <button
                  type="button"
                  className={styles.resendBtn}
                  onClick={() => {
                    setTimer(120);
                    showToast("Verification email resent. Please check your inbox.", "success");
                  }}
                >
                  Did not receive an email?
                </button>
              )}
            </div>
            </div>
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
                {toast.type === "error" ? "Login Failed" : toast.type === "success" ? "Success" : "Notice"}
              </h2>
              <p className={styles.alertModalMessage}>{toast.message}</p>
              <button className={`${styles.alertModalOkBtn} ${styles[`alertOkBtn_${toast.type}`]}`} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERI CONFIRM POPUP */}
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
              <button className={styles.confirmBtn} onClick={() => {
                  setShowPop(false);
                  setView("login");
                  showToast("Temporary password sent! Please check your messages/email.", "success");
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div> 
  );
}