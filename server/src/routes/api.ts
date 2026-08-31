import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';

const router = Router();

router.post('/items/preview', ItemController.previewItem);
router.post('/items', ItemController.createItem);
router.get('/items', ItemController.getItems);
router.patch('/items/:id/toggle', ItemController.toggleItem);
router.delete('/items/:id', ItemController.deleteItem);
router.post('/items/:id/check', ItemController.checkItemNow);

router.get('/settings', ItemController.getSettings);
router.post('/settings', ItemController.updateSettings);
router.post('/telegram/test', ItemController.testTelegram);
router.get('/alerts', ItemController.getAlerts);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
