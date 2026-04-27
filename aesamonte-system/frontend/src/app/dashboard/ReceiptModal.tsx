"use client";

import { useState } from "react";
import styles from "@/css/dashboard.module.css";
import { MdOutlineCheckCircle, MdOutlineStorefront } from "react-icons/md";
import { OrderReceipt, RecentOrder } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n as number)) return "₱ 0";
  return "₱ " + n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface ReceiptModalProps {
  receipt: OrderReceipt;
  receiptLoading: boolean;
  onClose: () => void;
  onOrdersUpdate: (updater: (prev: RecentOrder[]) => RecentOrder[]) => void;
  onReceiptStatusUpdate: (orderId: number, status: string) => void;
}

export default function ReceiptModal({
  receipt,
  receiptLoading,
  onClose,
  onOrdersUpdate,
  onReceiptStatusUpdate,
}: ReceiptModalProps) {
  const [confirmAction, setConfirmAction] = useState<"PREPARING" | "TO SHIP" | "RECEIVED" | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

const showToast = (message: string, type: "success" | "error") => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
};
  const handleStatusAdvance = async (targetStatus: "PREPARING" | "TO SHIP" | "RECEIVED") => {
  try {
    const res = await fetch(
      `${API}/api/dashboard/order-status/${receipt.orderId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      }
    );
    const data = await res.json();

    if (!res.ok) {
      // Surface the backend error message
      showToast(data.error ?? "Failed to update status.", "error");
      return;
    }

    if (data.status) {
      onReceiptStatusUpdate(receipt.orderId, data.status);
      onOrdersUpdate((prev) =>
        prev.map((o) =>
          o.orderId === receipt.orderId ? { ...o, status: data.status } : o
        )
      );
      showToast(
        targetStatus === "RECEIVED"
          ? "Order marked as Received ✓"
          : targetStatus === "TO SHIP"
          ? "Order moved to To Ship ✓"
          : "Order moved to Preparing ✓",
        "success"
      );
    }
  } catch (err) {
    console.error("Status advance error:", err);
    showToast("Network error — could not update order.", "error");
  }
};

  const handlePrint = () => {
    const pw = window.open("", "_blank");
    if (!pw) {
      alert(
        "Pop-up blocked. Please allow pop-ups for this site in your browser settings, then try again."
      );
      return;
    }

    const items = receipt.items;
    const totalRows = Math.max(25, items.length);
    const rows = Array.from({ length: totalRows }, (_, i) => {
      const item = items[i];
      return item
        ? `<tr><td>${i + 1}</td><td>${item.quantity}</td><td>${item.uom || "PCS"}</td><td class="part">${item.item_name}</td></tr>`
        : `<tr><td>${i + 1}</td><td></td><td></td><td></td></tr>`;
    }).join("");

    pw.document.write(`<!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Receipt - No. ${receipt.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }
          .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .company h1 { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .company p  { font-size: 10px; line-height: 1.65; }
          .receipt-block { text-align: right; }
          .receipt-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
          .receipt-no    { font-size: 24px; font-weight: 900; color: #c0392b; letter-spacing: 2px; }
          .receipt-no span { font-size: 13px; font-weight: 700; color: #000; }
          .meta-row { display: flex; justify-content: flex-end; align-items: flex-end; gap: 4px; margin-top: 4px; font-size: 10px; }
          .meta-label { font-weight: 600; white-space: nowrap; }
          .meta-value { border-bottom: 1px solid #000; min-width: 120px; padding: 0 4px; font-size: 10px; }
          .deliver-section { font-size: 10px; margin-bottom: 6px; }
          .deliver-row   { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 4px; }
          .deliver-label { font-weight: 700; font-size: 11px; white-space: nowrap; }
          .deliver-line  { border-bottom: 1px solid #000; flex: 1; min-height: 14px; padding: 0 4px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          thead th { border: 1px solid #000; padding: 5px 6px; font-weight: 700; text-align: center; font-size: 11px; }
          thead th.art { font-size: 12px; letter-spacing: 1px; }
          tbody td { border: 1px solid #000; padding: 2px 6px; text-align: center; height: 19px; font-size: 10px; }
          tbody td.part { text-align: left; }
          .print-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12px; }
          .footer-left  { max-width: 46%; font-size: 9px; line-height: 1.65; color: #333; }
          .footer-right { font-size: 10px; text-align: right; }
          .received-text { margin-bottom: 30px; }
          .by-line { display: flex; align-items: flex-end; justify-content: flex-end; gap: 6px; margin-bottom: 4px; }
          .by-underline { border-bottom: 1px solid #000; width: 160px; height: 16px; }
          .sig-line { border-top: 1px solid #000; width: 180px; margin-left: auto; text-align: center; padding-top: 2px; font-size: 9px; }
          .not-valid { font-style: italic; font-weight: 700; font-size: 9px; text-decoration: underline; text-align: center; margin-top: 8px; }
          @media print { body { padding: 10px 14px; } @page { margin: 0.4in; size: letter; } }
        </style>
      </head>
      <body>
        <div class="top">
          <div class="company">
            <h1>AE Samonte Merchandise</h1>
            <p>ALAIN E. SAMONTE - Prop.</p>
            <p>VAT Reg. TIN : 263-884-036-00000</p>
            <p>1457 A. Leon Guinto St., Zone 73 Barangay 676,</p>
            <p>1000 Ermita NCR, City of Manila, First District, Philippines</p>
          </div>
          <div class="receipt-block">
            <div class="receipt-title">DELIVERY RECEIPT</div>
            <div class="receipt-no"><span>N<sup>o</sup></span> ${receipt.orderId}</div>
            <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${receipt.orderDate}</span></div>
            <div class="meta-row"><span class="meta-label">P.O. No.:</span><span class="meta-value">&nbsp;</span></div>
            <div class="meta-row"><span class="meta-label">RFQ No.:</span><span class="meta-value">&nbsp;</span></div>
            <div class="meta-row"><span class="meta-label">TIN No.:</span><span class="meta-value">&nbsp;</span></div>
          </div>
        </div>
        <div class="deliver-section">
          <div class="deliver-row">
            <span class="deliver-label">DELIVERED TO:</span>
            <span class="deliver-line">${receipt.customerName}</span>
          </div>
          <div class="deliver-row">
            <span class="deliver-label">Address:</span>
            <span class="deliver-line">${receipt.customerAddress || ""}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:6%">ITEM</th>
              <th style="width:8%">QTY</th>
              <th style="width:10%">UNIT</th>
              <th class="art">ARTICLES / PARTICULARS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="print-footer">
          <div class="footer-left">
            <div>20 Bkts. (50x3) 4251 - 5250</div>
            <div>BIR Authority to Print No.: OCN033AU20250000004322</div>
            <div>Date of ATP: OCTOBER 10, 2025</div>
            <div>REGENCIA PRINTING SERVICES | Ramil P. Egencia - Prop.</div>
            <div>Lot 3 to 7, Raq's Hope Ville, Navarro 4107 City of General</div>
            <div>Trias, Cavite, Philippines • VAT Reg. TIN: 245-821-996-00000</div>
            <div>Printer's Accreditation No.: 54BMP20250000000023</div>
            <div>Date of ATP: OCT. 09, 2025 • Expiry Date: OCT. 08, 2030</div>
          </div>
          <div class="footer-right">
            <div class="received-text">Received the above goods in good order and condition.</div>
            <div class="by-line"><span>By:</span><div class="by-underline"></div></div>
            <div class="sig-line">Authorized Signature</div>
            <div class="not-valid">"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"</div>
          </div>
        </div>
      </body>
      </html>`);
    pw.document.close();
    pw.focus();
    pw.print();
  };

  return (
    <>
      {/* Confirm Modal */}
      {confirmAction !== null && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmAction(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div
              className={
                confirmAction === "RECEIVED" ? styles.confirmHeader : styles.confirmHeaderAmber
              }
            >
              <div className={styles.confirmIconCircle}>
                {confirmAction === "RECEIVED" ? (
                  <MdOutlineCheckCircle className={styles.confirmCheckIcon} />
                ) : (
                  <MdOutlineStorefront className={styles.confirmAmberIcon} />
                )}
              </div>
            </div>
            <div className={styles.confirmBody}>
              <p className={styles.confirmTitle}>
                {confirmAction === "RECEIVED" ? "Mark as Received?" 
                : confirmAction === "TO SHIP" ? "Mark as To Ship?"
                : "Mark as Preparing?"}
              </p>
              <p className={styles.confirmMessage}>
                {confirmAction === "RECEIVED" ? (
                  <><strong>Received</strong> status means the customer has collected their order. This cannot be undone.</>
                ) : confirmAction === "TO SHIP" ? (
                  <>This will move the order to <strong>To Ship</strong> status.</>
                ) : (
                  <>This will move the order to <strong>Preparing</strong> status.</>
                )}
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.confirmCancelBtn} onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
                <button
                  className={
                    confirmAction === "RECEIVED" ? styles.confirmGreenBtn : styles.confirmAmberBtn
                  }
                  onClick={() => {
                    handleStatusAdvance(confirmAction);
                    setConfirmAction(null);
                  }}
                >
                  {confirmAction === "RECEIVED"
                    ? "Yes, Mark as Received"
                    : confirmAction === "TO SHIP"
                    ? "Yes, Mark as To Ship"
                    : "Yes, Mark as Preparing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <div className={styles.receiptOverlay} onClick={onClose}>
        <div
          className={styles.receiptModal}
          onClick={(e) => e.stopPropagation()}
          id="receipt-print-area"
        >
          <div className={styles.receiptHeader}>
            <div>
              <p className={styles.receiptTitle}>Order Receipt</p>
              <p className={styles.receiptOrderId}>#{receipt.orderId}</p>
            </div>
            <button className={styles.receiptClose} onClick={onClose}>
              ✕
            </button>
          </div>
          {receiptLoading ? (
            <div className={styles.receiptLoading}>Loading...</div>
          ) : (
            <>
              <div className={styles.receiptMeta}>
                <div>
                  <p className={styles.receiptMetaLabel}>Customer</p>
                  <p className={styles.receiptMetaVal}>{receipt.customerName}</p>
                </div>
                <div className={styles.receiptMetaRight}>
                  <p className={styles.receiptMetaLabel}>{receipt.orderDate}</p>
                  <p className={styles.receiptMetaVal}>{receipt.paymentMethod}</p>
                </div>
              </div>
              <div className={styles.receiptDivider} />
              <div className={styles.receiptItemsHeader}>
                <span>Item</span>
                <span>Qty</span>
                <span>Amount</span>
              </div>
              <div className={styles.receiptItems}>
                {(receipt.items ?? []).map((item, i) => (
                  <div key={i} className={styles.receiptItem}>
                    <span className={styles.receiptItemName}>{item.item_name}</span>
                    <span className={styles.receiptItemQty}>
                      <span className={styles.receiptQtyNum}>{item.quantity}</span>
                      <span className={styles.receiptQtyUnit}>{item.uom}</span>
                    </span>
                    <span className={styles.receiptItemTotal}>{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.receiptDivider} />
              <div className={styles.receiptTotal}>
                <span>Total</span>
                <span>{fmt(receipt.totalAmount)}</span>
              </div>
              <div className={styles.receiptStatusActions}>
                {receipt.status === "PREPARING" && (
                  <button
                    className={`${styles.receiptStatusBtn} ${styles.receiptStatusBtnAmber}`}
                    onClick={() => setConfirmAction("TO SHIP")}
                  >
                    Mark as To Ship
                  </button>
                )}
                {receipt.status === "TO SHIP" && (
                  <button
                    className={`${styles.receiptStatusBtn} ${styles.receiptStatusBtnGreen}`}
                    onClick={() => setConfirmAction("RECEIVED")}
                  >
                    Mark as Received
                  </button>
                )}
                {receipt.status === "RECEIVED" && (
                  <span className={styles.receiptStatusDone}>✓ Received</span>
                )}
              </div>
              <button className={styles.receiptPrintBtn} onClick={handlePrint}>
                Print Receipt
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}