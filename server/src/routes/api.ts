import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.get('/auth/me', requireAuth, AuthController.getMe);
router.patch('/auth/telegram', requireAuth, AuthController.updateTelegram);

router.post('/items/preview', requireAuth, ItemController.previewItem);
router.post('/items', requireAuth, ItemController.createItem);
router.get('/items', requireAuth, ItemController.getItems);
router.patch('/items/:id/toggle', requireAuth, ItemController.toggleItem);
router.delete('/items/:id', requireAuth, ItemController.deleteItem);
router.post('/items/:id/check', requireAuth, ItemController.checkItemNow);

router.get('/settings', requireAuth, ItemController.getSettings);
router.post('/settings', requireAuth, ItemController.updateSettings);
router.post('/telegram/test', requireAuth, ItemController.testTelegram);
router.get('/alerts', requireAuth, ItemController.getAlerts);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
