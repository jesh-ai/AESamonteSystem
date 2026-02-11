## AE Samonte Web System - Project Overview

This repository hosts the automated, role-based platform designed to manage inventory, orders, and real-time sales analytics for AE Samonte.

---

## 👥 The Team

* **Project Manager:** Jeshaiah Mae Mulleno
* **Backend Developer Lead:** Jeshaiah Mae Mulleno
* **Frontend Developer Lead:** Faith Aleczes Cayacap
* **Database Admin:** Aubrey Ilasin
* **Documentation Lead:** Daniella Ysabelle Ibo

---

## 📂 Project Structure

The project utilizes a root-level management strategy to synchronize the frontend and backend services.

```text
AESamonteWebSystem/
│
├── aesamonte-system/               # Main Project Root
│   ├── .gitignore                  # Global git ignore (node_modules, .env)
│   ├── package.json                # Unified scripts for NEXT and FLASK
│   │
│   ├── backend/                    # Flask Backend API
│   │   ├── app.py                  # Server Entry Point
│   │   ├── database/               # SQL configurations
│   │   └── routes/                 # Auth, Sales, and Inventory logic
│   │
│   └── frontend/                   # Next.js Frontend
│       ├── src/
│       │   ├── app/                # Authentication and Dashboard pages
│       │   ├── components/         # Navigation and UI fragments
│       │   └── css/                # Styling modules
│       ├── package.json            # Frontend dependencies
│       └── next.config.ts          # Next.js settings

```

---

## 🚀 Technologies Used

* **Frontend:** Next.js 16.1.0, React 19, Tailwind CSS.
* **Backend:** Python Flask with MySQL Connector.
* **Authentication:** Custom role-based logic (Admin/Staff) and `localStorage` session persistence.
* **Database:** Supabase/SQL for real-time inventory tracking.

---

## 🚦 Quick Access

* To start development: `cd aesamonte-system` then `npm run dev`.
* Ensure a `.env` file is present in the root to enable database connectivity.
