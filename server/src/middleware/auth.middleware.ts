import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbService } from '../db';

const resolveJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production mode.');
    }
    return 'shopee-monitor-jwt-dev-secret';
  }
  return secret;
};

export const JWT_SECRET = resolveJwtSecret();

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
