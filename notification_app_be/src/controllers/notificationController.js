const {
  getAllNotifications,
  getNotificationById,
  getNotificationsByType,
} = require('../services/notificationService');

const { buildTopN } = require('../utils/priorityInbox');

// In-memory read/delete state — mirrors what a real DB would track.
// Keys are notification IDs; value is the mutation applied.
const readSet    = new Set();   // IDs the user has marked as read
const deletedSet = new Set();   // IDs the user has soft-deleted

/**
 * GET /api/v1/notifications
 * Supports ?type=Placement|Event|Result  &page=1  &limit=20  &isRead=true|false
 */
async function listNotifications(req, res) {
  try {
    const { type, page = 1, limit = 20, isRead } = req.query;

    let data = type
      ? await getNotificationsByType(type)
      : await getAllNotifications();

    // Filter out soft-deleted items
    data = data.filter((n) => !deletedSet.has(n.ID));

    // Apply isRead filter if supplied
    if (isRead !== undefined) {
      const wantRead = isRead === 'true';
      data = data.filter((n) => readSet.has(n.ID) === wantRead);
    }

    // Newest first
    data = data.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    const pageNum  = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10)), 100);
    const offset   = (pageNum - 1) * pageSize;

    const pageSlice = data.slice(offset, offset + pageSize).map((n) => ({
      ...n,
      isRead: readSet.has(n.ID),
    }));

    return res.json({
      success: true,
      data: {
        notifications: pageSlice,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: data.length,
          totalPages: Math.ceil(data.length / pageSize),
        },
      },
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * GET /api/v1/notifications/priority?n=10
 */
async function getPriorityNotifications(req, res) {
  try {
    const n   = Math.min(parseInt(req.query.n || '10', 10), 50);
    const all = (await getAllNotifications()).filter((x) => !deletedSet.has(x.ID));
    const top = buildTopN(all, n);
    return res.json({ success: true, data: { topN: n, notifications: top } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * GET /api/v1/notifications/:id
 */
async function getNotification(req, res) {
  try {
    if (deletedSet.has(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    const notification = await getNotificationById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    return res.json({ success: true, data: { ...notification, isRead: readSet.has(notification.ID) } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 */
async function markOneRead(req, res) {
  try {
    const { id } = req.params;
    if (deletedSet.has(id)) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    const notification = await getNotificationById(id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    readSet.add(id);
    return res.json({ success: true, data: { id, isRead: true } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 */
async function markAllRead(req, res) {
  try {
    const all = await getAllNotifications();
    let count = 0;
    for (const n of all) {
      if (!deletedSet.has(n.ID) && !readSet.has(n.ID)) {
        readSet.add(n.ID);
        count++;
      }
    }
    return res.json({ success: true, data: { updatedCount: count } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * DELETE /api/v1/notifications/:id  (soft-delete)
 */
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    if (deletedSet.has(id)) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    const notification = await getNotificationById(id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    deletedSet.add(id);
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

/**
 * GET /api/v1/notifications/unread-count
 */
async function getUnreadCount(req, res) {
  try {
    const all = await getAllNotifications();
    const count = all.filter((n) => !deletedSet.has(n.ID) && !readSet.has(n.ID)).length;
    return res.json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Upstream API error', detail: err.message });
  }
}

module.exports = {
  listNotifications,
  getNotification,
  getPriorityNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteNotification,
};
