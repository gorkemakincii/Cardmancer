<div align="center">

# 🐾 Cardmancer

**A real-time, multiplayer card game for 2–6 players — a pet-themed take on the classic _Love Letter_.**

Create a room, share the code, and outwit your friends through bluffing, deduction, and a little luck.

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-cardmancer.vercel.app-7C3AED?style=for-the-badge)](https://cardmancer.vercel.app)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [The Cards](#-the-cards)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [Acknowledgements](#-acknowledgements)

---

## 🎯 About

**Cardmancer** is a web-based, real-time multiplayer card game inspired by the deduction classic _Love Letter_.
Each round, you hold a single secret card. On your turn you draw a second card and play one of the two — triggering
its effect. The goal: be the last pet standing, or hold the highest card when the deck runs out.

The whole experience runs in the browser, with an authoritative Node server keeping every player's view in sync over
WebSockets. Play instantly as a guest, or create an account to track your stats.

> 🌐 The game UI is in **Turkish**.

---

## ✨ Features

- 🎮 **Real-time multiplayer** for 2–6 players over WebSockets
- 🔑 **Room codes** — spin up a lobby and share a 4-character code
- 👤 **Guest play + optional accounts** — JWT auth with persistent **win / game** stats
- 🃏 **Full card engine** — 11 unique, pet-themed cards with multi-step actions
- 🔌 **Reconnection** — drop or refresh and rejoin your held seat within a grace period
- 💬 **In-game chat** with quick **emoji reactions**
- 📖 **Built-in "How to Play"** guide explaining every card
- ✨ **Polished UX** — Framer Motion animations, sound effects, custom display fonts, a vignette table, and toasts

---

## 🃏 The Cards

The deck is built from 11 distinct yokai. Lower numbers are common and weak; higher numbers are rare and powerful.

| #  | Card | Count | Effect |
|:--:|------|:-----:|--------|
| 0  | 🌑 Kage Kit          | ×3 | If you're the **only** player who discarded a 0, you win the round |
| 1  | 🔮 Mystic Neko       | ×5 | Guess a player's hand card — if correct, they're eliminated (can't guess 1) |
| 2  | 🦉 Fukurou Seer      | ×3 | Secretly **peek** at another player's hand |
| 3  | 🐰 Samurai Usagi     | ×3 | **Compare** hands with a player — the lower card is eliminated |
| 4  | 🐢 Zen Kappa         | ×2 | You **can't be targeted** until your next turn |
| 5  | 🌪️ Kamaitachi        | ×2 | Force a player to **discard** their hand and draw a new card |
| 6  | ⛏️ Mogura            | ×1 | Peek at the set-aside card and **optionally swap** it into your hand |
| 7  | 💣 Kemuri Neko       | ×1 | Every unprotected player returns their card and **draws a new one** |
| 8  | ⚡ Raijin Scroll      | ×1 | **Swap hands** with another player |
| 9  | 🦝 Bakedanuki Bandit | ×1 | Swap hands **only if** your target is holding the Nekomata Emperor (10) |
| 10 | 👑 Nekomata Emperor  | ×1 | If you ever **play** this card, you're eliminated |

---

## 🛠 Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- TailwindCSS, Framer Motion (animations)
- Socket.io-client, React Router
- Howler (audio), Sonner (toasts)

**Backend**
- Node.js + Express + TypeScript
- Socket.io (real-time)
- Prisma ORM + PostgreSQL (Neon)
- bcryptjs + JWT (authentication)

---

## 🏗 Architecture

```
┌─────────────┐   WebSocket (Socket.io)   ┌──────────────────────┐
│   Client    │  ◀──────────────────────▶ │   Node / Express     │
│ React + TS  │      REST (/auth/*)       │   Authoritative game │
│  (Vercel)   │  ◀──────────────────────▶ │   state in memory    │
└─────────────┘                           └──────────┬───────────┘
                                                     │ Prisma
                                                     ▼
                                          ┌──────────────────────┐
                                          │  PostgreSQL (Neon)    │
                                          │  users · stats        │
                                          └──────────────────────┘
```

- **Authoritative server.** All live game state lives in memory (a single `Map` of rooms) on one persistent Node
  instance. Clients are thin — they receive **personalized, filtered views** (you never see opponents' hidden cards).
- **Database is for persistence only.** PostgreSQL (via Prisma) stores users and stats; the fast-moving game state
  stays in RAM. This is why the backend must run as a single long-lived instance (not serverless).
- **Stable identity for reconnection.** Logged-in users are keyed by `userId`; guests get a persistent `clientId`,
  so anyone can rejoin a held seat after a refresh or network blip.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+**
- A **PostgreSQL** database — the free [Neon](https://neon.tech) tier works great

### 1. Clone & install
```bash
git clone https://github.com/gorkemakincii/Cardmancer.git
cd Cardmancer

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Configure environment
Create `server/.env`:
```env
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="a-long-random-secret"
PORT=3001
CLIENT_URL="http://localhost:5173"
```
The client defaults to `http://localhost:3001`; override with `VITE_SERVER_URL` if needed.

### 3. Run
```bash
# in server/ — first time only: sync the schema to your database
npm run db:push
npm run dev        # → http://localhost:3001

# in client/ (separate terminal)
npm run dev        # → http://localhost:5173
```

Open **http://localhost:5173**, create a room, then join from a second tab to play.

---

## 📂 Project Structure

```
.
├── client/                # React + Vite frontend
│   └── src/
│       ├── pages/         # Home, Lobby, Game
│       ├── components/    # PlayingCard, ChatPanel, AuthModal, HowToPlay …
│       ├── auth.ts        # auth store + API
│       ├── session.ts     # clientId + active-room (reconnection)
│       └── socket.ts      # Socket.io client
├── server/                # Express + Socket.io backend
│   ├── prisma/            # Prisma schema
│   └── src/
│       ├── index.ts       # HTTP + socket event handlers
│       ├── gameEngine.ts  # deck, turns, winner resolution
│       ├── cardActions.ts # per-card effects
│       └── auth.ts        # register / login / me
└── render.yaml            # Render blueprint (backend)
```

---

## ☁️ Deployment

Deployed for free with **Render** (backend) · **Vercel** (frontend) · **Neon** (database).

- **Backend → Render** — a persistent Node web service (WebSockets + in-memory state rule out serverless). The
  included [`render.yaml`](render.yaml) blueprint sets the build/start commands. In the dashboard, set `DATABASE_URL`
  (your Neon string — **without surrounding quotes**) and `JWT_SECRET`.
- **Frontend → Vercel** — import the repo with **Root Directory = `client`** and set `VITE_SERVER_URL` to your
  backend URL.
- **Database → Neon** — run `npm run db:push` once to sync the schema.

---

## 🗺 Roadmap

- [x] Real-time lobbies & core game engine
- [x] Accounts, authentication & persistent stats
- [x] Reconnection (held seats + grace period)
- [x] In-game chat & emoji reactions
- [ ] Token / multi-round match system (best-of)
- [ ] Bot takeover for disconnected players
- [ ] Spectator mode

---

## 🙏 Acknowledgements

- Game mechanics inspired by **_Love Letter_** by Seiji Kanai.
- Built with [React](https://react.dev), [Socket.io](https://socket.io), [Prisma](https://www.prisma.io), and [Tailwind CSS](https://tailwindcss.com).

---

<div align="center">

Made with 🐾 by [Görkem Akıncı](https://github.com/gorkemakincii)

</div>
