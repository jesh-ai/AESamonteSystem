'use client';
import React, { useState, useEffect } from "react";
import styles from "@/css/addEmployeeModal.module.css";
import { LuUserPlus, LuX, LuSave } from "react-icons/lu";

export default function AddEmployeeModal({ onClose, onAdd, employee }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("4"); 
  const [status, setStatus] = useState("9"); // HTML select values are always strings
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (employee) {
      setName(employee.name || "");
      setEmail(employee.email || "");
      setContact(employee.contact || "");
      setRole(employee.role_id?.toString() || "4");
      // Force incoming number to string for the select dropdown
      setStatus(employee.status_id?.toString() || "9");
    }
  }, [employee]);

  const handleSubmit = async () => {
    if (!name || !email || !contact) return alert("Please fill in all required fields.");
    if (!employee && !password) return alert("Password is required for new accounts.");
    if (password && password !== confirmPassword) return alert("Passwords do not match.");

    const payload = {
      name: name.trim(),
      email: email.trim(),
      contact: contact.trim(),
      role_id: parseInt(role),
      status_id: parseInt(status), // CRITICAL: Convert "9" to 9
      password: password || undefined
    };

    try {
      const url = employee 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/employees/${employee.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/employees`;

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
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Corporate Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Contact Number</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
            </div>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Password</label>
                <input type="password" onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Confirm Password</label>
                <input type="password" onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          </div>
          <div className={`${styles.formSection} ${styles.sectionDivider}`}>
            <p className={styles.sectionLabel}>SYSTEM CREDENTIALS</p>
            <div className={styles.formGridTwo}>
              <div className={styles.formGroup}>
                <label>Designated Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="1">Admin</option>
                  <option value="2">Head</option>
                  <option value="3">Manager</option>
                  <option value="4">Staff</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Account Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="9">Active</option>
                  <option value="10">Inactive</option>
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