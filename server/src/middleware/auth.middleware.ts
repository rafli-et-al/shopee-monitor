import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbService } from '../db';

export const JWT_SECRET = process.env.JWT_SECRET || 'shopee-monitor-jwt-secret-key-2026';

export interface AuthenticatedUser {
  id: string;
  username: string;
  telegram_chat_id: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    const user = dbService.findUserById(decoded.id);

    if (!user) {
      res.status(401).json({ error: 'User no longer exists. Please sign in again.' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      telegram_chat_id: user.telegram_chat_id
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}
