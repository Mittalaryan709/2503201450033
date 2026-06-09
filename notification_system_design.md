# Notification System Design

---

## Stage 1 — REST API Design & Real-Time Mechanism

### Core Actions

| Action | Description |
|---|---|
| Fetch all notifications for a student | Paginated list, newest first |
| Fetch a single notification | Full detail view |
| Mark one notification as read | PATCH on a single resource |
| Mark all notifications as read | PATCH bulk action |
| Delete a notification | Soft-delete preferred |
| Fetch unread count | Lightweight badge endpoint |

---

### Endpoints

#### 1. Get Notifications (paginated)

```
GET /api/v1/notifications
```

**Headers**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| page | integer | Page number (default 1) |
| limit | integer | Items per page (default 20, max 100) |
| type | string | Filter by type: Placement \| Event \| Result |
| isRead | boolean | Filter read/unread |

**Response 200**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "type": "Placement",
        "message": "CSX Corporation is hiring. Apply now.",
        "isRead": false,
        "createdAt": "2026-04-22T17:51:18Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

#### 2. Get Single Notification

```
GET /api/v1/notifications/:id
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "type": "Placement",
    "message": "CSX Corporation is hiring.",
    "isRead": false,
    "createdAt": "2026-04-22T17:51:18Z"
  }
}
```

**Response 404**

```json
{ "success": false, "error": "Notification not found" }
```

---

#### 3. Mark Single Notification as Read

```
PATCH /api/v1/notifications/:id/read
```

**Response 200**

```json
{
  "success": true,
  "data": { "id": "d146095a-...", "isRead": true }
}
```

---

#### 4. Mark All Notifications as Read

```
PATCH /api/v1/notifications/read-all
```

**Response 200**

```json
{ "success": true, "data": { "updatedCount": 14 } }
```

---

#### 5. Delete a Notification

```
DELETE /api/v1/notifications/:id
```

**Response 200**

```json
{ "success": true, "data": { "deleted": true } }
```

---

#### 6. Get Unread Count

```
GET /api/v1/notifications/unread-count
```

**Response 200**

```json
{ "success": true, "data": { "unreadCount": 5 } }
```

---

### Real-Time Notification Mechanism

**Chosen approach: WebSockets (via Socket.IO)**

When a student logs in, the client opens a persistent WebSocket connection authenticated with the same JWT. The server places the socket into a room named after the student's ID (e.g. `student:1042`). Whenever a new notification is created for that student, the backend emits a `new_notification` event to that room.

```
Client connects → socket.join("student:1042")
Server emits  → io.to("student:1042").emit("new_notification", payload)
```

**Payload emitted**

```json
{
  "event": "new_notification",
  "data": {
    "id": "b283218f-...",
    "type": "Placement",
    "message": "CSX Corporation hiring",
    "createdAt": "2026-04-22T17:51:18Z"
  }
}
```

**Why WebSockets over SSE or polling?**

| Method | Pros | Cons |
|---|---|---|
| WebSockets | Full-duplex, low latency, scales with Redis adapter | Stateful — needs sticky sessions or a pub/sub layer |
| SSE | Simple, HTTP-based, auto-reconnect | Server-to-client only; one connection per tab |
| Long-polling | Works everywhere | High server load, high latency |

WebSockets are the best fit here because the platform may also need client-to-server signals (e.g. "mark as read" acknowledgment) in future iterations.

---

## Stage 2 — Persistent Storage

### Recommended Database: PostgreSQL

**Reasoning:**

- Notifications have a clear relational structure (students, notification types, read status).
- PostgreSQL supports partial indexes, which is critical for the common query pattern of fetching *unread* notifications per student.
- JSONB columns allow storing type-specific metadata without schema migrations.
- Native support for enums avoids storing raw strings for `notificationType`.
- Well-supported with Node.js (pg, Prisma, Sequelize) and has mature replication/failover tooling.

---

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');
CREATE TYPE delivery_channel  AS ENUM ('email', 'push');
CREATE TYPE delivery_status   AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE students (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)        NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        INTEGER          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  message           TEXT             NOT NULL,
  is_read           BOOLEAN          NOT NULL DEFAULT FALSE,
  metadata          JSONB,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ               DEFAULT NULL
);

-- Tracks per-channel delivery outcomes; decoupled from the notification row itself.
-- This is the table that Stage 5 workers write to on success or exhausted retries.
CREATE TABLE notification_delivery_log (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  UUID           NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel          delivery_channel NOT NULL,
  status           delivery_status  NOT NULL DEFAULT 'pending',
  attempts         SMALLINT         NOT NULL DEFAULT 0,
  last_attempted   TIMESTAMPTZ,
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
```

---

### Problems at Scale and Solutions

| Problem | Cause | Solution |
|---|---|---|
| Slow reads | Full table scan on large `notifications` table | Composite + partial indexes (see Stage 3) |
| Hot rows | Many writes for one student during placement season | Batch inserts, async queue (see Stage 5) |
| Storage bloat | Old notifications never removed | Archival job — move rows older than 90 days to `notifications_archive` |
| Connection exhaustion | High concurrency | PgBouncer connection pooler |

---

### SQL Queries for Stage 1 APIs

```sql
-- GET /api/v1/notifications (paginated, unread only)
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- GET /api/v1/notifications/:id
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL;

-- PATCH /api/v1/notifications/:id/read
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND student_id = $2
RETURNING id, is_read;

-- PATCH /api/v1/notifications/read-all
UPDATE notifications
SET is_read = TRUE
WHERE student_id = $1 AND is_read = FALSE AND deleted_at IS NULL;

-- DELETE /api/v1/notifications/:id  (soft-delete)
UPDATE notifications
SET deleted_at = NOW()
WHERE id = $1 AND student_id = $2;

-- GET /api/v1/notifications/unread-count
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE student_id = $1 AND is_read = FALSE AND deleted_at IS NULL;
```

---

## Stage 3 — Query Optimisation

### Is the original query accurate?

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Logically, yes — but there are two concrete problems with it:**

**Problem 1 — Column name mismatch.** The schema defined in Stage 2 uses snake_case (`student_id`, `is_read`, `created_at`). The query uses camelCase (`studentID`, `isRead`, `createdAt`). PostgreSQL column names are case-sensitive when quoted; unquoted identifiers get lowercased, so `studentID` resolves to `studentid` which does not exist. This query would throw a `column does not exist` error against the actual schema and must be corrected to use the schema's column names.

**Problem 2 — `SELECT *` is wasteful.** It pulls every column — including `metadata` (JSONB, potentially large) and `deleted_at` — across the network for every row, even when the front-end only needs `id`, `type`, `message`, `is_read`, and `created_at`. Explicit column selection cuts the payload size and makes the query plan more predictable.

---

### Why is it slow?

With 50 000 students and 5 000 000 notifications, there is no index on `student_id` or `is_read`. The database engine has no shortcut — it reads every single row in the `notifications` table (full sequential scan), evaluates the `WHERE` predicates row by row, collects the matches, and then sorts the full result set by `created_at`. At five million rows, that scan touches a lot of disk pages. If the table doesn't fit in `shared_buffers`, every page miss becomes an I/O wait. The `ORDER BY` on an unindexed column then requires a separate sort pass in memory (or a disk-based sort if the result set is large). All three steps compound on each other, which is why a query that looks simple can take multiple seconds under real load.

---

### Optimised Query

```sql
-- Only select what the front-end actually renders
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = FALSE
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

**Supporting index (partial + composite):**

```sql
-- Covers the WHERE clause exactly and supports the ORDER BY
CREATE INDEX idx_notifications_student_unread
  ON notifications (student_id, created_at DESC)
  WHERE is_read = FALSE AND deleted_at IS NULL;
```

A **partial index** only indexes rows matching the `WHERE` predicate. Because unread notifications are a small fraction of total rows, this index is far smaller than a full index and remains in memory longer.

**Likely computation cost after indexing:**

| Step | Before | After |
|---|---|---|
| Row scan | ~5 000 000 rows (seq scan) | ~50–200 rows (index scan) |
| Sort | O(n log n) on large set | Already ordered by index |
| Overall | Seconds | < 5 ms |

---

### Is "index every column" good advice?

No. While indexes speed up reads, each index:

1. **Adds write overhead** — every INSERT/UPDATE/DELETE must update all relevant indexes.
2. **Consumes disk space** — a table with 5 M rows and ten indexes can have indexes larger than the table itself.
3. **Can confuse the query planner** — too many indexes cause the planner to spend time evaluating options rather than executing.

The correct approach is to index selectively, driven by actual query patterns (EXPLAIN ANALYZE), and to use partial/composite indexes where predicates are well-known.

---

### Placement notifications in the last 7 days

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
JOIN notifications n ON n.student_id = s.id
WHERE n.notification_type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days'
  AND n.deleted_at IS NULL;
```

---

## Stage 4 — Caching Strategy

### Problem

Fetching notifications from the database on every page load with 50 000 concurrent students overwhelms the DB with near-identical queries.

---

### Strategy 1: Redis Cache per Student (Recommended)

Store each student's latest notification page in Redis with a TTL of 60 seconds.

```
Key:   notifications:student:{id}:page:1
Value: JSON array of notification objects
TTL:   60 seconds
```

On write (new notification created), invalidate the relevant key: `DEL notifications:student:{id}:page:1`.

**Tradeoffs:**

| Pro | Con |
|---|---|
| Sub-millisecond reads, DB load drops dramatically | Cache invalidation complexity; student may see up to 60 s stale data |
| Works at any scale | Extra infrastructure (Redis cluster) |

---

### Strategy 2: Unread Count Cache

Cache only the unread count (the most-fetched value):

```
Key:   unread_count:student:{id}
Value: integer
TTL:   30 seconds (or event-driven invalidation)
```

**Tradeoffs:** Very cheap to store and invalidate; does not help with the full notification list fetch.

---

### Strategy 3: HTTP-Level Caching (ETag / Last-Modified)

Return `ETag` or `Last-Modified` headers on the list endpoint. Clients send `If-None-Match` — if nothing changed the server returns `304 Not Modified` with no body, avoiding DB reads entirely for unchanged data.

**Tradeoffs:** Zero extra infrastructure, but works only if clients honour cache headers. Mobile apps and certain JS clients sometimes strip these headers.

---

### Recommended Combination

- Redis for server-side caching of notification pages (Strategy 1).
- ETag headers on list responses (Strategy 3) as a second layer.
- Dedicated Redis key for unread count (Strategy 2) to keep the badge fast.

---

## Stage 5 — Bulk Notification Reliability

### Shortcomings of the Original Pseudocode

```
function notify_all(student_ids, message):
  for student_id in student_ids:
    send_email(student_id, message)   # synchronous
    save_to_db(student_id, message)   # synchronous
    push_to_app(student_id, message)  # synchronous
```

1. **Synchronous loop** — 50 000 iterations in one request will time out.
2. **No retry logic** — if `send_email` fails for student N, students N+1 onward still fire but the error is silently dropped.
3. **Tight coupling** — email, DB write, and push happen in a single transaction. One failure can leave them inconsistent.
4. **No idempotency** — re-running after a partial failure re-sends to students already notified.
5. **No observability** — no way to know which students succeeded or failed without checking logs manually.

---

### What about the 200 failed email sends?

Without a queue, those 200 students are simply missed — there is no record of the failure and no mechanism to retry. The HR has to manually identify and re-send.

---

### Should DB save and email happen together?

No. They serve different purposes and have different failure modes:

- The DB write confirms the notification *exists* in the platform.
- The email is a *delivery channel* that can fail independently.

Tying them together means a failed email rolls back the DB record, so students who open the app never see the notification either. They should be decoupled: persist first, then deliver asynchronously.

---

### Redesigned Pseudocode

```
function notify_all(student_ids: array, message: string, notification_type: string):

  # Step 1 — persist all records atomically in one bulk insert
  notification_records = []
  for student_id in student_ids:
    notification_records.append({
      id: generate_uuid(),
      student_id: student_id,
      type: notification_type,
      message: message,
      is_read: false,
      created_at: now()
    })

  bulk_insert_db(notification_records)   # single DB round-trip, transactional

  # Step 2 — enqueue delivery jobs; do NOT call email/push APIs inline
  for record in notification_records:
    message_queue.publish("email_delivery", {
      notification_id: record.id,
      student_id: record.student_id,
      message: record.message
    })
    message_queue.publish("push_delivery", {
      notification_id: record.id,
      student_id: record.student_id,
      message: record.message
    })

  return { enqueued: len(notification_records) }


# Workers consume the queues independently with retry logic

worker email_worker():
  while true:
    job = message_queue.consume("email_delivery")
    try:
      send_email(job.student_id, job.message)
      mark_delivery_success(job.notification_id, channel="email")
    except EmailAPIError as e:
      if job.attempt < MAX_RETRIES:
        message_queue.requeue(job, delay=exponential_backoff(job.attempt))
      else:
        mark_delivery_failed(job.notification_id, channel="email", reason=e)
        alert_ops_team(job)


worker push_worker():
  while true:
    job = message_queue.consume("push_delivery")
    try:
      push_to_app(job.student_id, job.message)
      mark_delivery_success(job.notification_id, channel="push")
    except PushError as e:
      if job.attempt < MAX_RETRIES:
        message_queue.requeue(job, delay=exponential_backoff(job.attempt))
      else:
        mark_delivery_failed(job.notification_id, channel="push", reason=e)
```

**Key improvements:**

| Old | New |
|---|---|
| Synchronous loop | Bulk DB insert + async queue publish |
| Silent failures | Workers retry with exponential backoff |
| Coupled email + DB | DB persisted first; delivery is async and independent |
| No idempotency | `notification_id` used as deduplication key in workers |
| No failure visibility | `mark_delivery_failed` records reason; ops alert on exhausted retries |

---

## Stage 6 — Priority Inbox

### Scoring Model

Each notification gets a numeric priority score that combines two things: how important the notification type is, and how recently it arrived.

```
priority_score = type_weight + recency_score

type_weight:
  Placement → 300
  Result    → 200
  Event     → 100

recency_score = max(0, 100 - hours_since_notification)
```

The recency component slides down by 1 point for every hour that passes and floors at zero after roughly 4 days. This means a fresh Event can outrank a 4-day-old Result, but a brand-new Placement always beats everything else when timestamps are close.

---

### Data Structure: Fixed-Size Min-Heap

To efficiently track the top-N notifications without sorting the entire list on every update, the implementation uses a **min-heap of size N**:

- The heap always holds the N highest-scoring items seen so far.
- The root of the heap is the *weakest* item currently in the top-N.
- When a new notification arrives, its score is compared to the root. If it beats the root, the root is evicted and the new item is inserted. Otherwise, the new item is discarded.
- This keeps every insertion at **O(log N)** regardless of how many total notifications exist.

This is fundamentally different from sorting the full list (which would be O(M log M) where M is all notifications) — here N is fixed (10, 15, 20), so the heap operations are effectively constant-time relative to the total data volume.

---

### Maintaining Top-10 as New Notifications Arrive

When the backend receives a new notification via the WebSocket `new_notification` event, the client-side or server-side handler calls `buildTopN` incrementally:

```
new notification arrives
  → score it
  → if score > heap.peek().score (the current weakest in top-10)
      → heap.pop()   // remove weakest
      → heap.push(new item)  // O(log 10) = effectively O(1)
  → else discard
```

The heap never grows beyond N, so memory usage is constant and there is no need to re-fetch or re-sort the full notification history on each new arrival.

---

### Why Not a Sorted Array or DB Query?

| Approach | Insert new item | Read top-N | Memory |
|---|---|---|---|
| Re-sort full array | O(M log M) | O(N) | O(M) |
| DB query on each load | Network + index scan | O(N) | O(1) client |
| Fixed min-heap (chosen) | O(log N) | O(N log N) one-time extract | O(N) |

The heap wins for continuous streams where new notifications arrive frequently and N is small relative to total volume.

---

See `notification_app_be/src/utils/priorityInbox.js` for the working implementation. Run `npm run priority-demo` inside `notification_app_be` to see live output.
