# Notification App — Backend

Campus notification microservice exposing REST endpoints and a real-time WebSocket channel.

## Setup

```bash
cd notification_app_be
npm install
cp .env.example .env
# Fill in API_TOKEN in .env
npm run dev
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/notifications` | Paginated list (`?type=&page=&limit=`) |
| GET | `/api/v1/notifications/priority?n=10` | Top-N priority inbox |
| GET | `/api/v1/notifications/unread-count` | Badge count |
| GET | `/api/v1/notifications/:id` | Single notification |
| GET | `/health` | Health check |

## WebSocket

Connect to `ws://localhost:4000`, then emit:

```json
{ "event": "subscribe", "data": { "studentId": 1042 } }
```

The server will emit `new_notification` events to your socket whenever a notification is pushed to your student room.

## Priority Inbox Demo (Stage 6)

```bash
npm run priority-demo
```

Fetches live notifications from the API, scores each by type weight + recency, and prints the top-10 ranked table.
