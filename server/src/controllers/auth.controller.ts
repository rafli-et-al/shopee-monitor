import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbService } from '../db';
import { JWT_SECRET, AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, telegram_chat_id } = req.body;

      if (!username || typeof username !== 'string') {
        res.status(400).json({ error: 'Username is required.' });
        return;
      }

      const trimmedUsername = username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
        res.status(400).json({ error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores.' });
        return;
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      const existing = dbService.findUserByUsername(trimmedUsername);
      if (existing) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const userId = crypto.randomUUID();

      const user = dbService.createUser({
        id: userId,
        username: trimmedUsername,
        password_hash: passwordHash,
        telegram_chat_id: telegram_chat_id ? String(telegram_chat_id).trim() : null
      });

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          telegram_chat_id: user.telegram_chat_id
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Registration failed.' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required.' });
        return;
      }

      const trimmedUsername = String(username).trim().toLowerCase();
      const user = dbService.findUserByUsername(trimmedUsername);

      if (!user) {
        res.status(404).json({
          error: `User '@${trimmedUsername}' not found. Please create an account first.`,
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      if (!bcrypt.compareSync(String(password), user.password_hash)) {
        res.status(401).json({
          error: 'Incorrect password. Please try again.',
          code: 'INVALID_PASSWORD'
        });
        return;
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          telegram_chat_id: user.telegram_chat_id
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Sign in failed.' });
    }
  }

  static async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = dbService.findUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          telegram_chat_id: user.telegram_chat_id
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch user.' });
    }
  }

  static async updateTelegram(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { telegram_chat_id } = req.body;
      const chatId = telegram_chat_id !== undefined ? (telegram_chat_id ? String(telegram_chat_id).trim() : null) : null;

      dbService.updateUserTelegramChatId(req.user!.id, chatId);

      res.json({
        success: true,
        message: 'Telegram Chat ID updated successfully.',
        telegram_chat_id: chatId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update Telegram Chat ID.' });
    }
  }
}
