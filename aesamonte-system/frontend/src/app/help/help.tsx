'use client';

import React, { useState } from 'react';
import styles from "@/css/help.module.css";
import TopHeader from '@/components/layout/TopHeader';

interface HelpProps {
  role: string;
  onLogout: () => void;
}

// ─── Icon components (inline SVG, no extra deps) ─────────────────────────────
const Icons: Record<string, React.ReactNode> = {
  gettingStarted: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  inventory: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  orders: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  purchases: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  payments: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  suppliers: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  reports: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const guides = [
  {
    key: 'gettingStarted',
    title: 'Getting Started',
    icon: Icons.gettingStarted,
    description:
      'New to the AE system? This guide walks you through logging in, resetting your password, and creating your own password before accessing the dashboard.',
    allowedRoles: ['all'],
    features: [
      { name: 'Login', description: 'Enter your username and password to access the system. Your account is created by an administrator — no self-registration.' },
      { name: 'Remember Me', description: 'Check this on the login screen to save your username so you don\'t have to retype it next time.' },
      { name: 'Forgot Password', description: 'Click "Forgot Password?" on the login screen, enter your username and registered email, then verify the OTP sent to your inbox. A temporary password will be emailed to you.' },
      { name: 'Create Your Password', description: 'After logging in with a temporary password, you\'ll be taken to a Create Password screen before the dashboard. Enter the temporary password as verification, then set and confirm your new password.' },
    ],
    faqs: [
      { question: "I forgot my password. What do I do?", answer: "Click 'Forgot Password?' on the login screen. Enter your username and registered email address, then verify the 6-digit OTP sent to your inbox. Once confirmed, a temporary password will be emailed to you. Log in with it and you'll be prompted to create a new password right away." },
      { question: "I didn't receive the OTP or temporary password email. What should I check?", answer: "Check your spam or junk folder first. Make sure the email address you entered matches the one registered to your account. If the issue persists, contact your administrator to verify your registered email." },
      { question: "Can I use my account on multiple devices?", answer: "Yes — your account is not tied to a specific device. You can log in from any authorized terminal using your username and password." },
    ],
  },
  {
    key: 'inventory',
    title: 'Managing Inventory',
    icon: Icons.inventory,
    description:
      'Track every product in your warehouse — quantities, locations, categories, and pricing — all from one place. Get notified when stock falls below safe levels.',
    allowedRoles: ['head', 'inventory head', 'staff'],
    features: [
      { name: 'Products List', description: 'A full table of every active product, showing item name, company, category, quantity, location, and price.' },
      { name: 'Quantity', description: 'Current stock count. Updates automatically when sales are made or purchases are received.' },
      { name: 'Location', description: 'Where in the warehouse the item is stored. Useful for picking and fulfillment.' },
      { name: 'Out of Stock Section', description: 'Automatically highlights products with zero quantity so your team can act fast.' },
      { name: 'Inventory Report', description: 'Snapshot of your stock status — how many items are healthy, low, or depleted.' },
      { name: 'Edit Product', description: 'Update any product\'s details directly: name, price, quantity, or location.' },
    ],
    faqs: [
      { question: "Why isn't my stock count updating after a sale?", answer: "Stock updates automatically when an order is marked as Completed. If the order is still in Pending or To Ship status, the quantity hasn't been deducted yet." },
      { question: "How do I add a new product to inventory?", answer: "Use the 'Add Product' button at the top of the Products List page. Fill in all required fields and save. The item will immediately appear in the list." },
      { question: "Can I bulk-update quantities?", answer: "Currently, updates are done per item. A bulk import feature is on the product roadmap." },
      { question: "What triggers the Out of Stock alert?", answer: "Any item with a quantity of 0 is automatically flagged. There is no configurable threshold yet — the trigger is strictly zero." },
    ],
  },
  {
    key: 'orders',
    title: 'Orders',
    icon: Icons.orders,
    description:
      'View and manage all customer orders from placement to delivery. Track statuses, contact details, and payment methods in one unified dashboard.',
    allowedRoles: ['head', 'sales head', 'staff', 'cashier'],
    features: [
      { name: 'Order Table', description: 'Lists all orders with key details — customer address, contact info, items ordered, quantity, amount, payment method, date, and status.' },
      { name: 'Status Pipeline', description: 'Orders move through: To Ship → To Receive → Completed. Each stage reflects where the delivery is in the process.' },
      { name: 'Payment Method', description: 'Shown per order — e.g., Cash on Delivery, GCash, Bank Transfer. Comes from the customer system.' },
      { name: 'Order Detail View', description: 'Click any row to see the full breakdown of that specific order.' },
    ],
    faqs: [
      { question: "Can I cancel an order that has already been shipped?", answer: "Once an order is marked 'To Receive' or 'Completed', changes require a supervisor override. Contact your Manager or Admin to initiate a reversal." },
      { question: "A customer wants to change their order. What do I do?", answer: "Edit the order details before it moves to 'To Ship'. After that point, coordinate with the warehouse team and update the order notes." },
      { question: "Why does an order show the wrong payment method?", answer: "Payment method data comes from the Customer System at the time of order placement. If it's incorrect, edit the order detail and flag it for Finance." },
    ],
  },
  {
    key: 'purchases',
    title: 'Purchases',
    icon: Icons.purchases,
    description:
      'Manage all inbound stock purchases from suppliers. Purchases are directly linked to your Inventory — when a purchase is received, stock levels update automatically.',
    allowedRoles: ['head', 'inventory head', 'staff'],
    features: [
      { name: 'Purchase Orders List', description: 'Displays all purchase orders with supplier name, item/s ordered, quantity, unit cost, total amount, date, and status.' },
      { name: 'Supplier Link', description: 'Each purchase is tied to a supplier record. You can jump directly to the supplier profile from within a purchase.' },
      { name: 'Status Pipeline', description: 'Purchase orders move through: Ordered → Received → Stocked. Once marked Stocked, inventory quantities are updated.' },
      { name: 'Unit Cost & Total Amount', description: 'Tracks how much was paid per unit and in total — used in cost-of-goods calculations in Reports.' },
      { name: 'Inventory Integration', description: 'Marking a purchase as Received automatically adds the quantity to the corresponding product in the Inventory module.' },
      { name: 'Create Purchase Order', description: 'Raise a new PO by selecting a supplier, adding items and quantities, and setting an expected delivery date.' },
    ],
    faqs: [
      { question: "Does creating a Purchase Order immediately update inventory?", answer: "No. Inventory only updates when the purchase status is changed to 'Received'. This ensures stock is only counted once the items have physically arrived." },
      { question: "Can I purchase from a supplier not yet in the system?", answer: "No — you must add the supplier to the Suppliers module first before you can create a purchase order tied to them." },
      { question: "What if I received fewer items than ordered?", answer: "Edit the purchase before marking it Received. Adjust the quantity to what was actually delivered, then save and mark as Received. The correct amount will reflect in inventory." },
      { question: "Who can approve Purchase Orders?", answer: "Depending on your setup, Head and Manager roles may need to approve POs before they are sent to the supplier. Check your organization's workflow with your Admin." },
    ],
  },
  {
    key: 'payments',
    title: 'Payments and Sales',
    icon: Icons.payments,
    description:
      'Monitor all transactions and revenue in real time. Payments flow in automatically from the Customer System, and your team can make manual corrections as needed.',
    allowedRoles: ['head', 'sales head', 'staff', 'cashier'],
    features: [
      { name: 'Total Sales', description: 'Running total of all completed transactions. Updates in real time as orders are fulfilled.' },
      { name: 'Sales Report', description: 'Itemized breakdown of revenue by date, product, or customer — depending on the filter applied.' },
      { name: 'Top Selling Item', description: 'Highlights the product generating the most revenue in the current period.' },
      { name: 'Transaction Table', description: 'Full list of all transactions with customer, amount, payment method, date, and status.' },
      { name: 'Payment Status', description: 'Each transaction is either Pending, Paid, or Failed. Staff can manually update status when needed.' },
      { name: 'Three-dot Menu (⋮)', description: 'Appear beside each transaction row — click to edit amount, change payment status, or add remarks.' },
    ],
    faqs: [
      { question: "A transaction shows as Pending but the customer already paid. What do I do?", answer: "Click the ⋮ menu beside the transaction and change the status to Paid. Add a remark noting the payment confirmation reference if available." },
      { question: "Can I delete a transaction?", answer: "Transactions cannot be deleted — only edited. This preserves audit integrity. If a transaction was made in error, mark it with a correction remark." },
      { question: "Why isn't my transaction appearing in the Sales Report?", answer: "The report only includes Paid transactions by default. Check if the transaction is still in Pending status — it won't count toward totals until it's marked Paid." },
    ],
  },
  {
    key: 'suppliers',
    title: 'Suppliers',
    icon: Icons.suppliers,
    description:
      'Manage your vendor directory. Keep supplier contact details, payment terms, and transaction history organized so purchasing is always smooth and traceable.',
    allowedRoles: ['head', 'inventory head', 'staff'],
    features: [
      { name: 'Supplier Directory', description: 'A searchable list of all registered suppliers, showing name, contact person, phone, email, and address.' },
      { name: 'Contact Details', description: 'Stores primary contact person, phone number, and email for quick communication.' },
      { name: 'Supplier Profile', description: 'Each supplier has a dedicated profile page listing all associated purchase orders, making it easy to review purchase history.' },
      { name: 'Add Supplier', description: 'Register a new vendor by filling in their business name, contact info, and payment terms. Required before creating a purchase order from them.' },
      { name: 'Edit Supplier', description: 'Update any supplier\'s information — contacts change, addresses move. Keep records accurate.' },
      { name: 'Purchase History Link', description: 'From within a supplier profile, view all past and pending purchase orders tied to that vendor.' },
    ],
    faqs: [
      { question: "Can I have two supplier records for the same company?", answer: "The system doesn't prevent it, but it's not recommended — it fragments purchase history. If you find a duplicate, consolidate records by editing one and archiving the other." },
      { question: "A supplier changed their contact info. How do I update it?", answer: "Go to Suppliers, find the record, click Edit, update the fields, and save. The change reflects immediately across all linked purchase orders." },
      { question: "What happens to purchase orders if I delete a supplier?", answer: "Existing purchase orders remain intact — they are not deleted. The supplier name may show as 'Archived' in those records. Always archive instead of delete when possible." },
    ],
  },
  {
    key: 'reports',
    title: 'System Reports & Business Analytics',
    icon: Icons.reports,
    description:
      'Get a bird\'s-eye view of your entire business. Sales performance, inventory health, top clients, and key trends — all in one exportable dashboard.',
    allowedRoles: [],
    features: [
      { name: 'Sales Report', description: 'Total revenue over a selected date range, broken down by product, order, or customer.' },
      { name: 'Inventory Report', description: 'Current stock health — how many products are optimal, low, or out of stock.' },
      { name: 'Top Clients Ordered', description: 'Ranks customers by volume or value of orders placed, helping identify key accounts.' },
      { name: 'Top Selling Items', description: 'Shows which products move the fastest — useful for procurement and promotion planning.' },
      { name: 'Most Stock Items', description: 'Highlights products with the highest quantities — useful for spotting slow-moving stock.' },
      { name: 'Export Button', description: 'Downloads the current report view as a file for record keeping, presentations, or sharing with stakeholders.' },
    ],
    faqs: [
      { question: "How far back does the Sales Report go?", answer: "The report pulls all historical data in the system. Use the date range filter to narrow down to a specific period." },
      { question: "Can I schedule a report to run automatically?", answer: "Scheduled exports are not yet available. For now, reports are generated on-demand. This is on the roadmap." },
      { question: "The numbers in my report don't match what I see in the Sales module. Why?", answer: "Reports aggregate only Paid and Completed transactions. Any Pending items are excluded. Ensure all transactions are correctly marked before running a report." },
      { question: "Who can access System Reports?", answer: "Only Super Admin, Admin, and Manager roles have access to this module by default." },
    ],
  },
];

// ─── Role filtering ────────────────────────────────────────────────────────────
const allAccessRoles = ['super admin', 'admin', 'manager'];

function filterGuides(role: string) {
  const current = role?.toLowerCase() || '';
  return guides.filter(g => {
    if (allAccessRoles.includes(current)) return true;
    if (g.allowedRoles.includes('all')) return true;
    return g.allowedRoles.includes(current);
  });
}

// ─── Sub-accordion for FAQs ────────────────────────────────────────────────────
const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderTop: '1px solid #e8edf3',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: '13px 0',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '12px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e3a5f', lineHeight: 1.4 }}>
          {question}
        </span>
        <span style={{
          color: '#5b7fa6',
          fontSize: '12px',
          flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.22s ease',
        }}>▼</span>
      </button>
      <div style={{
        maxHeight: open ? '200px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.28s ease',
      }}>
        <p style={{
          margin: '0 0 14px 0',
          fontSize: '13.5px',
          color: '#4a6480',
          lineHeight: 1.65,
        }}>
          {answer}
        </p>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Help: React.FC<HelpProps> = ({ role, onLogout }) => {
  const s = styles as Record<string, string>;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const visibleGuides = filterGuides(role);

  const toggleAccordion = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className={s['help-container']}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s['help-main-layout']}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '0 8px',
          width: '100%',
        }}>

          {/* ── Page Header ── */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#1e3a5f',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
            }}>
              Help Center
            </h1>
            <p style={{ margin: 0, fontSize: '14.5px', color: '#5b7fa6' }}>
              Learn how to use each section of the system.
            </p>
          </div>

          {/* ── Accordion list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleGuides.map((guide, index) => {
              const isOpen = openIndex === index;
              return (
                <div
                  key={guide.key}
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: isOpen ? '2px solid #2a5f9e' : '2px solid #e3eaf3',
                    overflow: 'hidden',
                    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                    boxShadow: isOpen ? '0 4px 20px rgba(30,58,95,0.10)' : '0 1px 4px rgba(30,58,95,0.05)',
                  }}
                >
                  {/* Header row */}
                  <button
                    onClick={() => toggleAccordion(index)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '18px 22px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: '40px', height: '40px',
                      borderRadius: '10px',
                      background: isOpen ? '#1e3a5f' : '#eef3fa',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOpen ? '#ffffff' : '#2a5f9e',
                      flexShrink: 0,
                      transition: 'all 0.18s ease',
                    }}>
                      {guide.icon}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 700, color: '#1e3a5f' }}>
                        {guide.title}
                      </div>
                      {!isOpen && (
                        <div style={{ fontSize: '12.5px', color: '#7a95b2', marginTop: '2px', lineHeight: 1.4 }}>
                          {guide.description.slice(0, 80)}…
                        </div>
                      )}
                    </div>

                    <span style={{
                      color: '#5b7fa6',
                      fontSize: '12px',
                      flexShrink: 0,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.22s ease',
                    }}>▼</span>
                  </button>

                  {/* Body */}
                  <div style={{
                    maxHeight: isOpen ? '1200px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.38s ease',
                  }}>
                    <div style={{ padding: '0 22px 22px 22px' }}>

                      {/* Description */}
                      <p style={{
                        margin: '0 0 22px 0',
                        fontSize: '14px',
                        color: '#3d5a78',
                        lineHeight: 1.7,
                        paddingBottom: '18px',
                        borderBottom: '1px solid #e8edf3',
                      }}>
                        {guide.description}
                      </p>

                      {/* Two-col layout: Features | FAQs */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '28px',
                      }}>

                        {/* Features & Fields */}
                        <div>
                          <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#8aabcc',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            margin: '0 0 14px 0',
                          }}>
                            Features &amp; Fields
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {guide.features.map((f, fi) => (
                              <div key={fi} style={{
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'flex-start',
                              }}>
                                <span style={{
                                  width: '7px', height: '7px',
                                  borderRadius: '50%',
                                  background: '#2a5f9e',
                                  flexShrink: 0,
                                  marginTop: '6px',
                                }}/>
                                <div>
                                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e3a5f' }}>
                                    {f.name}
                                  </span>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#5b7fa6', lineHeight: 1.55 }}>
                                    {f.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Frequently Asked */}
                        <div>
                          <h3 style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#8aabcc',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            margin: '0 0 4px 0',
                          }}>
                            Frequently Asked
                          </h3>
                          <div>
                            {guide.faqs.map((faq, fi) => (
                              <FaqItem key={fi} question={faq.question} answer={faq.answer} />
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom padding */}
          <div style={{ height: '40px' }} />
        </div>
      </div>
    </div>
  );
};

export default Help;