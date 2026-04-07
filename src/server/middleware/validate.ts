/**
 * Zod 驗證 middleware factory
 *
 * 使用方式：`router.post('/tasks', validate(CreateTaskDto), handler)`
 * 驗證 req.body，失敗時回傳 400 + 結構化錯誤。
 */

import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

/**
 * 建立 zod validation middleware
 * @param schema - 要驗證的 zod schema
 * @returns Express middleware
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '請求資料驗證失敗',
          details: zodError.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
      });
      return;
    }

    // 將驗證後的資料放回 req.body（zod 會套用 default 值和 transform）
    req.body = result.data;
    next();
  };
}
