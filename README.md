# 🛍️ Shopee Indonesia Stock & Price Monitor

[![CI Pipeline](https://github.com/your-username/shopee-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/shopee-monitor/actions)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-blue?logo=docker)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Fullstack-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?logo=telegram)](https://core.telegram.org/bots/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-stack monitoring system and DevOps pipeline built to track out-of-stock items, specific product variants, and price drops on **Shopee Indonesia (`shopee.co.id`)**, with instant alerts delivered via **Telegram Bot**.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Frontend [Client - React + Vite + TypeScript]
        UI[Dashboard & Metrics]
        Preview[URL Parser & Variant Selector]
        SettingsUI[Telegram & Cron Settings]
        LogsUI[Alert & Price History]
    end

    subgraph Backend [Server - Node.js + Express + TypeScript]
        API[Express REST API]
        Scraper[Shopee ID Scraper & Variant Extractor]
        Scheduler[Dual Cron Scheduler: Stock 6h / Price 1h]
        Telegram[Telegram Bot Dispatcher]
        DB[(SQLite Embedded DB)]
    end

    subgraph DevOps [CI/CD & Deployment]
        GH[GitHub Actions CI/CD]
        Docker[Multi-stage Docker Container]
        VPS[Free Linux VPS / Oracle Cloud Always Free]
    end

    UI -->|REST API| API
    API --> DB
    Scheduler --> Scraper
    Scraper -->|Shopee Indonesia API| Shopee[Shopee.co.id]
    Scheduler -->|Restock / Price Drop| Telegram
    Telegram -->|Send Message & Photo| TGUser[User Telegram App]
    GH -->|Automated Build & SSH Deploy| VPS
```

---

## ✨ Features

- **Specific Variant Tracking**: Select and monitor exact variants (size, color, model) rather than generic product listings.
- **Dual Monitoring Schedulers**:
  - **Stock Checks**: Scheduled every **6 hours** per variant (configurable).
  - **Price Drop Checks**: Scheduled every **1 hour** for discount alerts.
- **Instant Telegram Alerts**: Sends rich notifications containing product thumbnail, variant name, real-time stock count, formatted price in IDR (`Rp`), and direct "Buy Now" link.
- **Interactive Setup Wizard**: In-app Telegram Bot configuration with one-click test message verification.
- **Production-Ready DevOps Pipeline**: Automated GitHub Actions CI/CD, multi-stage Docker builds, and zero-downtime SSH deployment to a free VPS (e.g. Oracle Cloud Always Free).

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js** v20+ and **npm**
- **Git**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/shopee-monitor.git
cd shopee-monitor

# Install dependencies for root, server, and client
npm run install:all
```

### 3. Configure Environment
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
STOCK_CHECK_CRON=0 */6 * * *
PRICE_CHECK_CRON=0 * * * *
```

### 4. Run Locally
```bash
# Start backend server with live reload
npm run dev:server

# In another terminal, start React frontend
npm run dev:client
```
Visit `http://localhost:5173` to access the dashboard.

---

## 🐳 Docker Deployment

Run the complete production container locally or on your VPS using Docker Compose:

```bash
# Build and run container in background
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop container
docker compose down
```

---

## ⚙️ DevOps & CI/CD Setup (GitHub Actions)

### 1. Continuous Integration (CI)
File: `.github/workflows/ci.yml`
- Runs automatically on every push or pull request to `main`/`develop`.
- Validates TypeScript compilation and builds both frontend and backend bundles.

### 2. Continuous Deployment (CD)
File: `.github/workflows/cd.yml`
- Runs automatically on push to `main`.
- Builds optimized multi-stage Docker image and pushes it to **GitHub Container Registry (`ghcr.io`)**.
- Connects securely to your VPS via SSH and executes `docker compose pull` followed by `docker compose up -d`.

### 3. Setting up GitHub Secrets for Automated Deploy
Add the following secrets to your GitHub Repository (**Settings > Secrets and variables > Actions**):

| Secret Name | Description | Example |
| :--- | :--- | :--- |
| `VPS_HOST` | Public IP or domain of your VPS | `150.136.x.x` |
| `VPS_USERNAME` | SSH username on your VPS | `ubuntu` |
| `VPS_SSH_KEY` | Private SSH key for VPS login | `-----BEGIN OPENSSH PRIVATE KEY...` |
| `VPS_APP_DIR` | Directory on VPS where docker-compose lives | `~/shopee-monitor` |

---

## 📄 License
Distributed under the MIT License.
