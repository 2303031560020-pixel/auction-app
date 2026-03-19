# BidX Backend — Parul University Auction App

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your keys
cp .env.example .env

# 3. Push schema to database
npm run db:push

# 4. Seed with sample data
npm run db:seed

# 5. Start dev server
npm run dev
```

Server runs at: http://localhost:5000

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/register | Register (uni email only) | No |
| POST | /api/auth/login | Login → returns JWT token | No |
| GET  | /api/auth/me | Get current user | Yes |

### Items
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET  | /api/items | List all items (filter by category, search) | No |
| GET  | /api/items/:id | Get single item with bid history | No |
| POST | /api/items | Create listing (with image upload) | Yes |
| DELETE | /api/items/:id | Cancel your listing | Yes |
| POST | /api/items/:id/report | Report suspicious item | Yes |

### Bids
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/bids/:itemId | Place a bid | Yes |
| GET  | /api/bids/:itemId | Get bid history for item | No |
| GET  | /api/bids/my/bids | Get your bid history | Yes |

### AI Features
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/ai/recognize | Upload image → AI returns item details | Yes |
| POST | /api/ai/price | Get AI price suggestion | Yes |
| POST | /api/ai/chat | Chat with AI assistant | No |

### Users
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/users/profile | Get your profile + listings | Yes |
| GET | /api/users/:id/listings | Get any user's listings | No |

---

## Authentication
All protected routes need this header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Real-time (Socket.io)
Connect to: `ws://localhost:5000`

**Events:**
- Emit `join-item` with itemId to watch an auction
- Listen for `new-bid` to get live bid updates
- Listen for `auction-ended` when timer expires
- Listen for `user-count` to see how many people are watching

---

## AI Features Used
- **Image Recognition**: Gemini 1.5 Flash Vision API
- **Price Suggestion**: Gemini + historical DB data
- **Chatbot**: Gemini 1.5 Flash with context
- **Fraud Detection**: Rule-based (no external API needed)

---

## Tech Stack
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL + Prisma ORM
- **Real-time**: Socket.io
- **AI**: Google Gemini API
- **Image Storage**: Cloudinary
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Zod
