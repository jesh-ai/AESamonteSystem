# AE Samonte Inventory and Sales System

An automated, role-based platform that replaces manual tracking to manage inventory, orders, and real-time sales analytics.

---

## 👥 The Team

* **Project Manager:** Jeshaiah Mae Mulleno
* **Backend Developer Lead:** Jeshaiah Mae Mulleno
* **Frontend Developer Lead:** Faith Aleczes Cayacap
* **Database Admin:** Aubrey Ilasin
* **Documentation Lead:** Daniella Ysabelle Ibo

---

## 🚀 How to Run the System

This project is configured to run both the **frontend** and **backend** simultaneously using a single command from the root directory.

### **Prerequisites**

* **Node.js** installed (for Next.js frontend)
* **Python 3.x** installed (for Flask backend)
* **Git** (for version control)

## Quick Start Guide

To get the **AE Samonte Inventory and Sales System** up and running on your local machine, follow these steps to ensure both the frontend and backend environments are correctly configured.

---

### **1. Install All Dependencies**

You must install dependencies in both the **root** folder (to manage the combined execution) and the **frontend** folder (for the React/Next.js UI).

* **Step A: Root Dependencies**
From the `aesamonte-system` folder, run:
```bash
npm install

```


*This installs `concurrently`, allowing you to run the frontend and backend together.*
* **Step B: Frontend Dependencies**
Move into the frontend directory and install the UI packages:
```bash
cd frontend
npm install
cd ..

```


*This installs Next.js, React, and Tailwind CSS.*
* **Step C: Backend Setup**
Ensure you have Python installed, then install the Flask requirements:
```bash
pip install flask flask-cors mysql-connector-python

```


*This ensures the API can handle authentication and database queries.*

---

### **2. Launch the System**

Once everything is installed, you don't need to open multiple terminals. Simply run the following command from the **root directory**:

```bash
npm run dev

```

---

### **What happens next?**

* **Frontend**: Will be available at `http://localhost:3000`.
* **Backend**: Will be active at `http://127.0.0.1:5000`.
* **Live Features**: The **Enter** key for login will now work, the **Remember Me** checkbox will save your ID, and the dashboard will correctly display **Admin** roles.

**Would you like me to help you set up the `.env` file for your database connection so the system can pull live data?**