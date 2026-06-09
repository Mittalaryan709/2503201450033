const { Router } = require('express');
const {
  listNotifications,
  getNotification,
  getPriorityNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteNotification,
} = require('../controllers/notificationController');

const router = Router();

// Specific static paths must be declared before parameterised ones
router.get('/unread-count',    getUnreadCount);
router.get('/priority',        getPriorityNotifications);
router.patch('/read-all',      markAllRead);
router.get('/',                listNotifications);
router.get('/:id',             getNotification);
router.patch('/:id/read',      markOneRead);
router.delete('/:id',          deleteNotification);

module.exports = router;
