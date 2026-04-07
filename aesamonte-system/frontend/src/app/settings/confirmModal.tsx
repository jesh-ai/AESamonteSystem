'use client';
import React from "react";
import styles from "@/css/confirmModal.module.css";
import { LuTriangle } from "react-icons/lu";

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, icon, headerColor, confirmBtnColor }: any) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.headerRed} style={headerColor ? { backgroundColor: headerColor } : undefined}>
          <div className={styles.iconCircle} style={headerColor ? { background: headerColor } : undefined}>
            {icon ?? <LuTriangle className={styles.warningIcon} />}
          </div>
        </div>
        <div className={styles.body}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.message}>{message}</p>
          <div className={styles.actionGroup}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.confirmBtnRed} style={confirmBtnColor ? { backgroundColor: confirmBtnColor } : undefined} onClick={onConfirm}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}