import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/api';
import { SchedulerService } from './services/scheduler.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

const publicPath = path.join(__dirname, '../public');
const clientDistPath = path.join(__dirname, '../../client/dist');

if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON in request body.' });
    return;
  }
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

import { dbService } from './db';
import { TelegramBotListener } from './services/telegram-bot.service';

if (process.env.TELEGRAM_BOT_TOKEN && !dbService.getSetting('telegram_bot_token')) {
  dbService.setSetting('telegram_bot_token', process.env.TELEGRAM_BOT_TOKEN.trim());
}
if (process.env.TELEGRAM_CHAT_ID && !dbService.getSetting('telegram_chat_id')) {
  dbService.setSetting('telegram_chat_id', process.env.TELEGRAM_CHAT_ID.trim());
}

SchedulerService.init();
TelegramBotListener.start();

app.listen(PORT, () => {
  console.log(`Shopee Monitor Server running on http://localhost:${PORT}`);
});
