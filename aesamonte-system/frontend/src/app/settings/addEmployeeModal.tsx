/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import React, { useState, useEffect } from "react";
import styles from "@/css/addEmployeeModal.module.css";
import { LuUserPlus, LuX, LuSave } from "react-icons/lu";

interface RoleOption {
  role_id: number;
  role_name: string;
}

export default function AddEmployeeModal({ onClose, onAdd, employee }: any) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [contactError, setContactError] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("11");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);

  // Error states
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  useEffect(() => {
    fetch('/api/roles')
      .then(r => r.json())
      .then((data: RoleOption[]) => {
        const filtered = Array.isArray(data) ? data : [];
        setRoleOptions(filtered);
        if (!employee && filtered.length > 0) {
          setRole(filtered[filtered.length - 1].role_id.toString());
        }
      })
      .catch(() => setRoleOptions([]));
  }, []);

  useEffect(() => {
    if (employee) {
      setName(employee.name || "");
      setUsername(employee.username || "");
      setEmail(employee.email || "");
      setContact(employee.contact || "");
      setRole(employee.role_id?.toString() || "");
      setStatus(employee.status_id?.toString() || "11");
    }
  }, [employee]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/\s/.test(val)) return;
    if (val.length > 25) {
      setUsernameError("Username must be 25 characters or fewer.");
      return;
    }
    setUsername(val);
    if (val.length > 0 && val.length < 8) {
      setUsernameError("Username must be at least 8 characters.");
    } else if (val.length > 0 && !/^[a-zA-Z0-9._@]+$/.test(val)) {
      setUsernameError("Username may only contain letters, numbers, and ( _ . @ )");
    } else {
      setUsernameError("");
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
    if (val.length > 0 && val.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
    } else {
      setPasswordError("");
    }
    if (confirmPassword && val !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setConfirmPassword(val);
    if (val !== password) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = e.target.value;
  if (!/^\d*$/.test(val)) return; // numbers only
  if (val.length > 11) return; // max 11 digits
  setContact(val);
  if (val.length > 0 && val.length < 11) {
    setContactError("Contact number must be 11 digits.");
  } else if (val.length > 0 && !val.startsWith('09')) {
    setContactError("Contact number must start with 09.");
  } else {
    setContactError("");
  }
};

  const handleSubmit = async () => {
    if (!name || !username || !email || !contact) return alert("Please fill in all required fields.");
    if (usernameError || passwordError || confirmPasswordError) return;
    if (username.length < 8) { setUsernameError("Username must be at least 8 characters."); return; }
    if (!/^[a-zA-Z0-9._@]+$/.test(username)) { setUsernameError("Username may only contain letters, numbers, and ( _ . @ )"); return; }
    if (!employee && !password) return alert("Password is required for new accounts.");
    if (password && password.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (password && password !== confirmPassword) { setConfirmPasswordError("Passwords do not match."); return; }
    if (contactError) return;
    if (contact.length !== 11) { setContactError("Contact number must be 11 digits."); return; }
    if (!contact.startsWith('09')) { setContactError("Contact number must start with 09."); return; }

    const payload = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      contact: contact.trim(),
      role_id: parseInt(role),
      status_id: parseInt(status),
      password: password || undefined
    };

    try {
      const url = employee ? `/api/employees/${employee.id}` : `/api/employees`;
      const response = await fetch(url, {
        method: employee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onAdd();
        onClose();
      } else {
        const err = await response.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      alert("Server connection failed.");
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>{employee ? "Edit Employee Profile" : "Register New Employee"}</h2>
            <p className={styles.subText}>System Administrative Portal</p>
          </div>
          <LuX className={styles.closeIcon} onClick={onClose} />
        </div>
        <div className={styles.modalFormBody}>
          <div className={styles.formSection}>
            <p className={styles.sectionLabel}>EMPLOYEE PROFILE</p>
            <div className={styles.formGroupFull}>
              <label>Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={styles.formGroupFull}>
              <label>Username</label>
              <input value={username} onChange={handleUsernameChange} />
              {usernameError && <span style={{ color: 'red', fontSize: '0.8rem' }}>{usernameError}</span>}
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Corporate Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
              <label>Contact Number</label>
              <input value={contact} onChange={handleContactChange} placeholder="09XXXXXXXXX" maxLength={11} />
              {contactError && <span style={{ color: 'red', fontSize: '0.8rem' }}>{contactError}</span>}
            </div>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Password</label>
                <input type="password" onChange={handlePasswordChange} />
                {passwordError && <span style={{ color: 'red', fontSize: '0.8rem' }}>{passwordError}</span>}
              </div>
              <div className={styles.formGroup}>
                <label>Confirm Password</label>
                <input type="password" onChange={handleConfirmPasswordChange} />
                {confirmPasswordError && <span style={{ color: 'red', fontSize: '0.8rem' }}>{confirmPasswordError}</span>}
              </div>
            </div>
          </div>
          <div className={`${styles.formSection} ${styles.sectionDivider}`}>
            <p className={styles.sectionLabel}>SYSTEM CREDENTIALS</p>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Designated Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {roleOptions.map(r => (
                    <option key={r.role_id} value={r.role_id.toString()}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Account Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="11">Active</option>
                  <option value="12">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSubmit}>
              {employee ? <LuSave /> : <LuUserPlus />} {employee ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}