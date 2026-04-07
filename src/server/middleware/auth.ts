/**
 * 可選 Token 驗證 Middleware
 *
 * 透過環境變數 `CLAWFLOW_AUTH_TOKEN` 啟用。
 * 未設定 token 時直接放行（next()）。
 * 設定後需於 Authorization header 帶 `Bearer <token>`。
 */

import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Token 驗證 middleware
 * 從 Authorization header 取得 Bearer token 並比對環境變數
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredToken = process.env['CLAWFLOW_AUTH_TOKEN'];

  // 未設定 token 時直接放行
  if (!configuredToken) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '缺少 Authorization header',
      },
    });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header 格式錯誤，需為 Bearer <token>',
      },
    });
    return;
  }

  // 使用 timingSafeEqual 避免 timing attack
  const tokenBuf = Buffer.from(token, 'utf-8');
  const configBuf = Buffer.from(configuredToken, 'utf-8');
  if (tokenBuf.length !== configBuf.length || !timingSafeEqual(tokenBuf, configBuf)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token 無效',
      },
    });
    return;
  }

  next();
}
