'use client';

import { useState } from "react";
import Image from "next/image";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { FaMobileAlt, FaEnvelope, FaArrowLeft } from "react-icons/fa"; 
import styles from "@/css/auth.module.css";

interface LoginProps {
  onLogin: (role: string) => void;
}

const mockUsers = [
  { employeeId: "A001", password: "admin123", role: "Admin", name: "Alain Samonte" },
  { employeeId: "M001", password: "manager123", role: "Manager", name: "Kristine Samonte" },
  { employeeId: "S001", password: "staff123", role: "Staff", name: "Heidi Legazpi" },
  { employeeId: "H001", password: "head123", role: "Head", name: "Hannah Head" },
];

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<"login" | "forgot" | "sms" | "email">("login"); 
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); 
  const [rememberMe, setRememberMe] = useState(false);
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState(""); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = mockUsers.find((u) => u.employeeId === employeeId);

    if (!user) {
      alert("User not found!");
      return;
    }

    if (user.password !== password) {
      alert("Incorrect password!");
      return;
    }

    alert(`Welcome ${user.name} (${user.role})`);
    onLogin(user.role);
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
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className={styles.loginInput}
                required
              />
            </div>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.loginInput}
                  required
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
                <span>Remember Password</span>
              </label>
              <a href="#" className={styles.forgotLink} onClick={() => setView("forgot")}>
                Forgot Password?
              </a>
            </div>

            <button type="submit" className={styles.loginSubmit}>LOGIN</button>
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

            <button className={styles.recoveryOption} onClick={() => setView("email")}>
              <FaEnvelope className={styles.recoveryIcon} />
              <div className={styles.recoveryText}>
                <strong>via Email</strong>
                <span>A verification code will be sent to your registered email.</span>
              </div>
            </button>
          </div>
        ) : view === "sms" ? (
          /* --- SMS RECOVERY --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("forgot")}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Forgot Password?</h2>
            <p className={styles.forgotSubtitle}>To continue, enter the information for the selected recovery method.</p>

            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID<span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className={styles.loginInput}
              />
            </div>

            <div className={styles.loginField} style={{marginTop: '15px'}}>
              <label className={styles.loginLabel}>Contact Number<span style={{color: 'red'}}>*</span></label>
              <input
                type="text"
                placeholder="Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className={styles.loginInput}
              />
            </div>

            <button className={styles.loginSubmit} style={{marginTop: '25px'}} onClick={() => alert("OTP Sent via SMS!")}>
              Send OTP
            </button>
          </div>
        ) : (
          /* --- EMAIL RECOVERY --- */
          <div className={styles.forgotContainer}>
            <button className={styles.backBtn} onClick={() => setView("forgot")}>
              <FaArrowLeft />
            </button>
            <h2 className={styles.forgotTitle}>Forgot Password?</h2>
            <p className={styles.forgotSubtitle}>To continue, enter the information for the selected recovery method.</p>
            
            <div className={styles.loginField}>
              <label className={styles.loginLabel}>Employee ID<span style={{color: 'red'}}>*</span></label>
              <input 
                type="text" 
                placeholder="Employee ID" 
                value={employeeId} 
                onChange={(e) => setEmployeeId(e.target.value)} 
                className={styles.loginInput} 
              />
            </div>
            
            <div className={styles.loginField} style={{marginTop: '15px'}}>
              <label className={styles.loginLabel}>Email Address<span style={{color: 'red'}}>*</span></label>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={emailAddress} 
                onChange={(e) => setEmailAddress(e.target.value)} 
                className={styles.loginInput} 
              />
            </div>
            
            <button className={styles.loginSubmit} style={{marginTop: '25px'}} onClick={() => alert("OTP Sent via Email!")}>
              Send OTP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}