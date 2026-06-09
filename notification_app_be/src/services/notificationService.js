const apiClient = require('../config/apiClient');

/**
 * Pulls the full notification list from the upstream API.
 * Returns the raw array; callers apply their own filters.
 */
async function getAllNotifications() {
  const response = await apiClient.get('/notifications');
  return response.data.notifications || [];
}

/**
 * Finds a notification by its ID.
 */
async function getNotificationById(id) {
  const notifications = await getAllNotifications();
  const found = notifications.find((n) => n.ID === id);
  return found || null;
}

/**
 * Returns notifications filtered by type.
 * @param {'Placement'|'Event'|'Result'} type
 */
async function getNotificationsByType(type) {
  const all = await getAllNotifications();
  return all.filter((n) => n.Type === type);
}

module.exports = {
  getAllNotifications,
  getNotificationById,
  getNotificationsByType,
};
