/**
 * priorityInbox.js
 *
 * Stage 6 — Priority Inbox
 *
 * Scoring model:
 *   type_weight : Placement = 300 | Result = 200 | Event = 100
 *   recency_score = max(0, 100 - hours_since_notification)
 *   priority_score = type_weight + recency_score
 *
 * A fixed-size max-heap keeps the top-N items.
 * Insertion: O(log n)   |   Peek top: O(1)   |   Extract max: O(log n)
 */

const TYPE_WEIGHT = {
  Placement: 300,
  Result: 200,
  Event: 100,
};

function scoreNotification(notification) {
  const weight = TYPE_WEIGHT[notification.Type] ?? 0;
  const ageHours = (Date.now() - new Date(notification.Timestamp).getTime()) / 3_600_000;
  const recency = Math.max(0, 100 - ageHours);
  return weight + recency;
}

// --- Min-Heap used as a fixed-size max-priority selector ---
// We keep a min-heap of size N; any item scoring higher than the heap's
// minimum (root) displaces it. At the end the heap holds the top-N items.

class MinHeap {
  constructor() {
    this.data = [];
  }

  get size() {
    return this.data.length;
  }

  peek() {
    return this.data[0] ?? null;
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.data[parent].score <= this.data[idx].score) break;
      [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
      idx = parent;
    }
  }

  _siftDown(idx) {
    const n = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < n && this.data[left].score < this.data[smallest].score) smallest = left;
      if (right < n && this.data[right].score < this.data[smallest].score) smallest = right;
      if (smallest === idx) break;
      [this.data[smallest], this.data[idx]] = [this.data[idx], this.data[smallest]];
      idx = smallest;
    }
  }
}

/**
 * Builds the top-N priority notifications from a raw list.
 *
 * @param {Array} notifications  - raw objects from the API
 * @param {number} n             - how many top items to return (default 10)
 * @returns {Array}              - sorted highest-priority first
 */
function buildTopN(notifications, n = 10) {
  const heap = new MinHeap();

  for (const notif of notifications) {
    const score = scoreNotification(notif);
    const entry = { score, notification: notif };

    if (heap.size < n) {
      heap.push(entry);
    } else if (score > heap.peek().score) {
      // Evict lowest-priority item and insert this one
      heap.pop();
      heap.push(entry);
    }
  }

  // Extract all items and sort descending by score for display
  const result = [];
  while (heap.size > 0) result.push(heap.pop());
  return result
    .sort((a, b) => b.score - a.score)
    .map((e) => ({ ...e.notification, priorityScore: Math.round(e.score * 100) / 100 }));
}

// -------------------------------------------------------
// Standalone demo — run with: node src/utils/priorityInbox.js
// -------------------------------------------------------
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const apiClient = require('../config/apiClient');

  (async () => {
    console.log('\n=== Priority Inbox Demo (Top 10) ===\n');
    try {
      const response = await apiClient.get('/notifications');
      const notifications = response.data.notifications || [];
      console.log(`Fetched ${notifications.length} notifications from API.\n`);

      const top10 = buildTopN(notifications, 10);

      console.log('Rank | Type       | Priority Score | Message                              | Timestamp');
      console.log('─'.repeat(95));

      top10.forEach((n, i) => {
        const rank = String(i + 1).padEnd(5);
        const type = n.Type.padEnd(11);
        const score = String(n.priorityScore).padEnd(15);
        const msg = n.Message.substring(0, 36).padEnd(38);
        console.log(`${rank}| ${type}| ${score}| ${msg}| ${n.Timestamp}`);
      });
    } catch (err) {
      console.error('Could not reach API:', err.message);
      console.log('\nRunning with mock data for demonstration...\n');

      // Mock data matching the API shape from the spec
      const mockNotifications = [
        { ID: 'a1', Type: 'Placement', Message: 'Google hiring', Timestamp: new Date(Date.now() - 1 * 3600000).toISOString() },
        { ID: 'a2', Type: 'Result', Message: 'mid-sem results', Timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
        { ID: 'a3', Type: 'Event', Message: 'tech-fest tomorrow', Timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
        { ID: 'a4', Type: 'Placement', Message: 'Amazon SDE internship', Timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
        { ID: 'a5', Type: 'Result', Message: 'external exam result', Timestamp: new Date(Date.now() - 10 * 3600000).toISOString() },
        { ID: 'a6', Type: 'Event', Message: 'farewell party', Timestamp: new Date(Date.now() - 48 * 3600000).toISOString() },
        { ID: 'a7', Type: 'Placement', Message: 'Microsoft hiring', Timestamp: new Date(Date.now() - 1 * 3600000).toISOString() },
        { ID: 'a8', Type: 'Result', Message: 'project review result', Timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
        { ID: 'a9', Type: 'Event', Message: 'sports meet', Timestamp: new Date(Date.now() - 72 * 3600000).toISOString() },
        { ID: 'a10', Type: 'Placement', Message: 'Adobe full-time offer', Timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
        { ID: 'a11', Type: 'Event', Message: 'hackathon 2026', Timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
        { ID: 'a12', Type: 'Result', Message: 'project-review grade', Timestamp: new Date(Date.now() - 30 * 3600000).toISOString() },
      ];

      const top10 = buildTopN(mockNotifications, 10);

      console.log('Rank | Type       | Priority Score | Message                   | Timestamp');
      console.log('─'.repeat(85));
      top10.forEach((n, i) => {
        const rank = String(i + 1).padEnd(5);
        const type = n.Type.padEnd(11);
        const score = String(n.priorityScore).padEnd(15);
        const msg = n.Message.substring(0, 25).padEnd(27);
        console.log(`${rank}| ${type}| ${score}| ${msg}| ${n.Timestamp}`);
      });
    }
  })();
}

module.exports = { buildTopN, scoreNotification };
