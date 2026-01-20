'use client';

import React, { useState } from 'react';
import styles from "@/css/help.module.css";
import TopHeader from '@/components/layout/TopHeader';

interface HelpProps {
  role: string;
  onLogout: () => void;
}

const Help: React.FC<HelpProps> = ({ role, onLogout }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const s = styles as Record<string, string>;

  const guides = [
    { 
      title: "Getting Started", 
      content: `Step 1: Launch the System
Open the AE system in your desktop.
You'll see the Start screen.
Choose your role:
   ◦ Admin: for full system access and management.
   ◦ Staff: for limited access (inventory, sales, etc.).

Step 2: Log In
On the Log In screen, enter your Employee ID and Password.
Click Login.
If you don't have an account yet, click Register to create one.

Step 3: Sign Up (New Users)
Fill out the form:
   ◦ Employee ID
   ◦ Name
   ◦ Password
   ◦ Confirm Password
Click Sign Up to create your account.
Once approved, you'll return to the Login screen.` 
    },
    { 
      title: "Managing Inventory", 
      content: `Step 1: Open the Inventory Page
From the left side menu, click Inventory.
You’ll see your Products List, Inventory Report, and Out of Stock section.

Step 2: View Product Details
In the Products List, you can see all items in stock.
Check each product's:
      ◦ Item name
      ◦ Company name
      ◦ Category
      ◦ Quantity
      ◦ Location
      ◦ Price or Amount

Step 3: Edit a Product
Find the item and click Edit.
Update any details (like quantity or price).
Click Save.` 
    },
    { 
      title: "Orders", 
      content: `Step 1: Open the Orders Page
Click Orders on the left side menu.
You'll see all customer orders listed.
At the top, you can view:
Shipped Today
Orders Cancelled
Total Orders

Step 2: View Order Details
Each row shows:
Customer address
Contact info
Item ordered
Quantity
Amount
Payment method
Date
Status (To Ship, To Receive, Cancelled, etc.)

Step 3: Update Order Status
Click the order you want to update.
Change the Status (e.g., To Ship → To Receive → Completed).
Save the update.` 
    },
    { 
      title: "Payments and Sales", 
      content: `Step 1: View Sales Overview
At the top, you'll see:
Total Sales - total amount sold.
Sales Report - daily, weekly, and monthly summaries.
Top Selling Item - the most popular product.

Step 2: Automatic Updates
When customers complete a payment through the Customer System, the transaction automatically appears here.
The status (e.g., Paid, Pending) updates in real time.

Step 3: Manual Edit or Update
Click the “⋮” (three dots) beside a transaction to edit or update payment details.
You can:
Change the payment status (e.g., from Pending → Paid).
Adjust the amount if there's a correction.
Add notes or remarks.

Step 4: Export Sales Data
Click Export (top-right) to download sales reports.
You can use this for accounting or performance tracking.` 
    },
    { 
      title: "System Reports and Business Analytics", 
      content: `Step 1: View Reports Summary
At the top, you'll see your main reports:
Sales Report - shows daily, weekly, monthly, and yearly totals.
Inventory Report - tracks item quantities and stock levels.
Total Sales & Orders - displays overall sales and number of orders.

Step 2: Check Insights
Top Clients Ordered - See which customers order the most.
Top Selling Items - Identify your best-performing products.
Most Stock Items - Find out which items have the highest remaining stock.

Step 3: Export the Report
Click the Export button (top-right corner).
The report will be downloaded for record keeping, review, or business meetings.` 
    }
  ];

  return (
    <div className={s['help-container']}>
      {/* HEADER PART ADDED HERE */}
      <TopHeader role={role} onLogout={onLogout} />

      <div className={s['help-content-wrapper']}>
        <h1 className={s['help-title']}>User Guide & System Help</h1>
        
        <div className={s['video-placeholder']}>
          <div className={s['play-button']}>▶</div>
        </div>

        <div className={s['help-list']}>
          {guides.map((guide, index) => (
            <div key={index} className={s['help-item']}>
              <div 
                className={s['help-header']} 
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span>{guide.title}</span>
                <span>{openIndex === index ? '▲' : '▼'}</span>
              </div>
              
              {openIndex === index && (
                <div className={s['help-content']} style={{ whiteSpace: 'pre-line' }}>
                  {guide.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Help;