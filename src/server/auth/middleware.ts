import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config';
import type { GameRepository, UserEntity } from '../database/types';
import { AppError } from '../errors';
import { clearSessionCookie, SESSION_COOKIE_NAME, verifySessionToken } from './session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: UserEntity;
      requestId: string;
    }
  }
}

export function createRequireAuth(repository: GameRepository, config: AppConfig) {
  return async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
      const payload = verifySessionToken(token, config.sessionSecret);
      if (!payload) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
      }
      const user = await repository.getUserById(payload.uid);
      if (!user || user.telegramId.toString() !== payload.tid) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Your session is no longer valid');
      }
      req.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function optionalAuthCookie(value: string | undefined, secret: string): { userId: string } | null {
  const payload = verifySessionToken(value, secret);
  return payload ? { userId: payload.uid } : null;
}

export function authFailure(
  res: Response,
  config: AppConfig,
  status: number,
  code: string,
  message: string,
): void {
  if (code === 'AUTH_REQUIRED') {
    clearSessionCookie(res, config.isProduction);
  }
  res.status(status).json({ error: { code, message } });
}
