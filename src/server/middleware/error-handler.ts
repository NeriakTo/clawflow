/**
 * 全域 Error Handler
 *
 * 回傳統一 ApiErrorResponse 格式：
 * `{ success: false, error: { code, message, details } }`
 */

import type { Request, Response, NextFunction } from 'express';

/** 自訂應用錯誤 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 常用錯誤工廠 */
export function notFound(message = '資源不存在'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

export function unauthorized(message = '未授權'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

/**
 * Express 全域 error handler middleware
 * 必須有 4 個參數才會被 Express 識別為 error handler
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError — 預期內的錯誤
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? undefined,
      },
    });
    return;
  }

  // 非預期錯誤 — 記錄完整資訊，但只回傳固定訊息
  console.error('[ErrorHandler] 未預期錯誤:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '伺服器內部錯誤',
    },
  });
}
