# Replate Nutrition

AI-powered dietary and nutrition management for your household — humans and pets.

## Tech Stack

- **Frontend**: React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · Framer Motion
- **Backend**: Express · TypeScript · Prisma ORM · PostgreSQL
- **AI**: OpenAI GPT-4o for recommendations, meal planning, and grocery intelligence
- **Store Data**: Google Places API + community-sourced pricing with exponential decay
- **Auth**: Custom JWT with refresh token rotation
- **PWA**: Installable on mobile with offline shell caching

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, graceful fallback)
- OpenAI API key
- Google Places API key

## Setup

### 1. Clone and install

```bash
git clone <repo-url> replate-nutrition
cd replate-nutrition
npm run install:all
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random 64-char string for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Random 64-char string for refresh tokens |
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4o access) |
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API key |
| `RESEND_API_KEY` | No | For password reset emails |
| `REDIS_URL` | No | Redis connection for caching |

### 3. Database

```bash
cd backend
npx prisma migrate dev --name init
```

### 4. Run

```bash
# From root
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

## Project Structure

```
├── backend/
│   ├── prisma/schema.prisma    # Database schema (13 models)
│   └── src/
│       ├── app.ts              # Express app setup
│       ├── index.ts            # Server entry
│       ├── config/             # Environment & database config
│       ├── middleware/          # Auth, rate limiter, error handler
│       ├── routes/             # API route handlers (9 route files)
│       ├── services/           # Business logic (AI, auth, pricing, stores...)
│       ├── utils/              # JWT, Redis utilities
│       └── jobs/               # Cron jobs (price aggregation)
├── frontend/
│   ├── public/                 # PWA manifest, service worker
│   └── src/
│       ├── App.tsx             # Router with lazy loading
│       ├── components/
│       │   ├── ui/             # Reusable UI components (shadcn-style)
│       │   ├── layout/         # AppShell, Sidebar, MobileNav
│       │   ├── shared/         # EmptyState, ErrorCard, etc.
│       │   └── onboarding/     # 5-step onboarding flow
│       ├── contexts/           # AuthContext with JWT management
│       ├── lib/                # API client, utilities
│       ├── pages/              # All page components
│       └── types/              # TypeScript interfaces
└── .env.example
```

## Modules

- **Profiles**: Manage household members (humans & pets) with dietary needs, allergies, conditions
- **Recommendations**: AI-generated food/brand/recipe suggestions per profile
- **Meal Plans**: Calendar-based meal planning with day/week/2-week/month views
- **Shopping**: Smart shopping lists with AI generation from meal plans, store finder, in-store session mode
- **Pricing**: Community-sourced price tracking with exponential decay averaging
- **Settings**: Account, security, notifications, data export

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/profiles` | List user profiles |
| POST | `/api/recommendations/generate` | Generate AI recommendations |
| GET | `/api/meal-plans` | Get meal plans by date range |
| POST | `/api/meal-plans/generate` | Generate AI meal plan |
| GET | `/api/shopping` | Get shopping list |
| POST | `/api/shopping/session` | Start shopping session |
| GET | `/api/pricing/stores` | Find nearby stores |

## License

Private — All rights reserved.
