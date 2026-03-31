'use client';

import React, { useState } from 'react';
import styles from "@/css/help.module.css";
import TopHeader from '@/components/layout/TopHeader';

interface HelpProps {
  role: string;
  onLogout: () => void;
}

const Help: React.FC<HelpProps> = ({ role, onLogout }) => {
  // Changed to a single number (or null) to allow only one open section at a time
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const s = styles as Record<string, string>;

  // Normalize the active role name to lowercase for strict matching
  const currentRole = role?.toLowerCase() || '';

  // 1. ROLES WITH FULL ACCESS
  // Super Admin (1), Admin (2), and Manager (3) automatically bypass the filter.
  // Add any future top-level roles here.
  const allAccessRoles = ['super admin', 'admin', 'manager'];

  const toggleAccordion = (index: number) => {
    // Classic accordion logic: if the clicked index is already open, close it (set to null).
    // Otherwise, set it as the new currently open index.
    setOpenIndex(prev => (prev === index ? null : index));
  };

  /*
   * HOW TO UPDATE ONCE NEW ROLES ARE ADDED TO THE DB:
   * When you split "Head" into "Inventory Head" and "Sales Head", simply
   * add their lowercase names to the `allowedRoles` array inside the specific
   * guides they should have access to. You can then safely remove the generic 'head'.
   */
  const guides = [
    {
      title: "Getting Started",
      // 'all' allows any logged-in user to see this general module
      allowedRoles: ['all'], 
      steps: [
        {
          label: "Step 1: Launch the System",
          details: [
            "Open the AE system in your desktop.",
            "You'll see the Start screen.",
            "Choose your role:",
            "◦ Admin – for full system access and management.",
            "◦ Staff – for limited access (inventory, sales, etc.)"
          ]
        },
        {
          label: "Step 2: Log In",
          details: [
            "On the Log In screen, enter your Employee ID and Password.",
            "Click Login.",
            "If you don't have an account yet, click Register to create one."
          ]
        },
        {
          label: "Step 3: Sign Up (New Users)",
          details: [
            "Fill out the form:",
            "◦ Employee ID",
            "◦ Name",
            "◦ Password",
            "◦ Confirm Password",
            "Click Sign Up to create your account.",
            "Once approved, you'll return to the Login screen."
          ]
        }
      ]
    },
    {
      title: "Managing Inventory",
      // FUTURE UPDATE: Replace 'head' with 'inventory head'
      allowedRoles: ['head', 'inventory head', 'staff'], 
      steps: [
        {
          label: "Step 1: Open the Inventory Page",
          details: ["From the left side menu, click Inventory.", "You’ll see your Products List, Inventory Report, and Out of Stock section."]
        },
        {
          label: "Step 2: View Product Details",
          details: [
            "In the Products List, you can see all items in stock.", 
            "Check each product's:",
            "◦ Item name", "◦ Company name", "◦ Category", "◦ Quantity", "◦ Location", "◦ Price or Amount"
          ]
        },
        {
          label: "Step 3: Edit a Product",
          details: ["Find the item and click Edit.", "Update any details (like quantity or price) and click Save."]
        }
      ]
    },
    {
      title: "Orders",
      // FUTURE UPDATE: Replace 'head' with 'sales head'
      allowedRoles: ['head', 'sales head', 'staff', 'cashier'],
      steps: [
        {
          label: "Step 1: Open the Orders Page",
          details: ["Click Orders on the left side menu.", "You'll see all customer orders listed."]
        },
        {
          label: "Step 2: View Order Details",
          details: [
            "Each row shows:",
            "◦ Customer address", "◦ Contact info", "◦ Item ordered", "◦ Quantity", "◦ Amount", "◦ Payment method", "◦ Date", "◦ Status"
          ]
        },
        {
          label: "Step 3: Update Order Status",
          details: ["Click the order you want to update.", "Change the Status (e.g., To Ship → To Receive → Completed).", "Save the update."]
        }
      ]
    },
    {
      title: "Payments and Sales",
      // FUTURE UPDATE: Replace 'head' with 'sales head'
      allowedRoles: ['head', 'sales head', 'staff', 'cashier'],
      steps: [
        {
          label: "Step 1: View Sales Overview",
          details: ["At the top, you'll see: Total Sales, Sales Report, and Top Selling Item."]
        },
        {
          label: "Step 2: Automatic Updates",
          details: ["When customers complete a payment through the Customer System, the transaction automatically appears here."]
        },
        {
          label: "Step 3: Manual Edit or Update",
          details: [
            "Click the “⋮” (three dots) beside a transaction to edit details.",
            "◦ Change the payment status (e.g., from Pending → Paid).",
            "◦ Adjust the amount if there's a correction.",
            "◦ Add notes or remarks."
          ]
        }
      ]
    },
    {
      title: "System Reports and Business Analytics",
      // Left empty because Super Admin, Admin, and Manager already get access via `allAccessRoles`
      allowedRoles: [], 
      steps: [
        {
          label: "Step 1: View Reports Summary",
          details: ["◦ Sales Report, Inventory Report, and Total Sales & Orders."]
        },
        {
          label: "Step 2: Check Insights",
          details: ["◦ Top Clients Ordered, Top Selling Items, and Most Stock Items."]
        },
        {
          label: "Step 3: Export the Report",
          details: ["◦ Click the Export button (top-right corner) for record keeping."]
        }
      ]
    }
  ];

  // 2. FILTERING LOGIC
  const visibleGuides = guides.filter(guide => {
    // Grant access if the user is a top-level role (Super Admin, Admin, Manager)
    if (allAccessRoles.includes(currentRole)) return true;
    
    // Grant access if the module is marked for 'all'
    if (guide.allowedRoles.includes('all')) return true;

    // Grant access if the user's specific role is explicitly listed in allowedRoles
    return guide.allowedRoles.includes(currentRole);
  });

  return (
    <div className={s['help-container']}>
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s['help-main-layout']}>
        <div className={s['help-card']}>
          <h1 className={s['help-title']}>User Guide & System Help</h1>
          
          <div className={s['video-container']}>
            <div className={s['video-placeholder']}>
              <div className={s['play-button']}>▶</div>
            </div>
          </div>

          <div className={s['help-list']}>
            {/* Map through the filtered list instead of the full array */}
            {visibleGuides.map((guide, index) => {
              // Now comparing against a single index instead of an array
              const isOpen = openIndex === index; 
              return (
                <div key={index} className={`${s['help-item']} ${isOpen ? s['item-open'] : ''}`}>
                  <div 
                    className={`${s['help-header']} ${isOpen ? s['header-open'] : ''}`} 
                    onClick={() => toggleAccordion(index)}
                  >
                    <span>{guide.title}</span>
                    <span className={`${s['arrow']} ${isOpen ? s['arrow-open'] : ''}`}>▼</span>
                  </div>
                  
                    <div className={`${s['help-body-wrapper']} ${isOpen ? s['wrapper-open'] : ''}`}>
                      <div className={s['help-body-content']}>
                        
                        <div className={s['help-body']}>
                          {guide.steps.map((step, sIdx) => (
                            <div key={sIdx} className={s['help-step-section']}>
                              <p className={s['step-label']}>{step.label}</p>
                              <div className={s['step-details']}>
                                {step.details.map((detail, dIdx) => (
                                  <p 
                                    key={dIdx} 
                                    className={`${s['detail-line']} ${detail.startsWith('◦') ? s['sub-bullet'] : ''}`}
                                  >
                                    {detail.startsWith('◦') ? '' : '• '} {detail}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;