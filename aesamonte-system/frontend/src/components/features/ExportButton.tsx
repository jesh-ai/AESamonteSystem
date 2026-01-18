'use client';

import React from 'react';
import { LuUpload } from "react-icons/lu";
import styles from "@/css/reports.module.css"; // Reusing report styles for consistency

export default function ExportButton() {
  const handleExport = () => {
    // Placeholder action and message
    console.log("Exporting report data...");
    // Future logic for CSV/PDF generation goes here
  };

  return (
    <button className={styles.exportBtn} onClick={handleExport}>
      <LuUpload /> Export
    </button>
  );
}