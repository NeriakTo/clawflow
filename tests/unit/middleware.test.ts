/**
 * Middleware 單元測試
 *
 * 測試 validate middleware（Zod 驗證）和 auth middleware（Token 驗證）。
 * 使用 mock Request/Response 物件，不需要啟動 Express server。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../src/server/middleware/validate.js';
import { authMiddleware } from '../../src/server/middleware/auth.js';

// ── 輔助函式：建立 mock Express 物件 ─────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & {
  _statusCode: number;
  _body: unknown;
} {
  const res = {
    _statusCode: 200,
    _body: undefined as unknown,
    status(code: number) {
      res._statusCode = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as Response & { _statusCode: number; _body: unknown };
}

// ── validate middleware ───────────────────────────────────────

describe('validate middleware', () => {
  const testSchema = z.object({
    title: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  });

  it('正確 body 應通過驗證並呼叫 next()', () => {
    const req = createMockReq({ body: { title: '測試任務' } });
    const res = createMockRes();
    const next = vi.fn();

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // zod 應套用預設值
    expect(req.body).toEqual({ title: '測試任務', priority: 'medium' });
  });

  it('完整有效 body 應通過', () => {
    const req = createMockReq({ body: { title: '任務', priority: 'high' } });
    const res = createMockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ title: '任務', priority: 'high' });
  });

  it('空字串 title 應回 400', () => {
    const req = createMockReq({ body: { title: '' } });
    const res = createMockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
    expect(res._body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '請求資料驗證失敗',
      },
    });
  });

  it('缺少必要欄位應回 400 並包含 details', () => {
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);

    const body = res._body as {
      success: boolean;
      error: { details: Array<{ path: string }> };
    };
    expect(body.error.details).toBeDefined();
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it('無效的 enum 值應回 400', () => {
    const req = createMockReq({ body: { title: '任務', priority: 'urgent' } });
    const res = createMockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._statusCode).toBe(400);
  });

  it('多餘欄位應被 zod strip 掉並通過', () => {
    const req = createMockReq({
      body: { title: '任務', extra: 'should-be-stripped' },
    });
    const res = createMockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // zod default 行為是 strip 多餘欄位
    expect(req.body).not.toHaveProperty('extra');
  });
});

// ── auth middleware ────────────────────────────────────────────

describe('auth middleware', () => {
  const originalEnv = process.env['CLAWFLOW_AUTH_TOKEN'];

  afterEach(() => {
    // 還原環境變數
    if (originalEnv !== undefined) {
      process.env['CLAWFLOW_AUTH_TOKEN'] = originalEnv;
    } else {
      delete process.env['CLAWFLOW_AUTH_TOKEN'];
    }
  });

  describe('未設定 token 時', () => {
    beforeEach(() => {
      delete process.env['CLAWFLOW_AUTH_TOKEN'];
    });

    it('應直接放行（呼叫 next）', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('即使沒有 Authorization header 也應放行', () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('已設定 token 時', () => {
    const TEST_TOKEN = 'test-secret-token-12345';

    beforeEach(() => {
      process.env['CLAWFLOW_AUTH_TOKEN'] = TEST_TOKEN;
    });

    it('正確 Bearer token 應放行', () => {
      const req = createMockReq({
        headers: { authorization: `Bearer ${TEST_TOKEN}` },
      });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('缺少 Authorization header 應回 401', () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._statusCode).toBe(401);
      expect(res._body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '缺少 Authorization header',
        },
      });
    });

    it('錯誤的 scheme（非 Bearer）應回 401', () => {
      const req = createMockReq({
        headers: { authorization: `Basic ${TEST_TOKEN}` },
      });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._statusCode).toBe(401);
      expect(res._body).toMatchObject({
        error: { message: 'Authorization header 格式錯誤，需為 Bearer <token>' },
      });
    });

    it('錯誤的 token 應回 401', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer wrong-token' },
      });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._statusCode).toBe(401);
      expect(res._body).toMatchObject({
        error: { message: 'Token 無效' },
      });
    });

    it('只有 Bearer 沒有 token 應回 401', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer' },
      });
      const res = createMockRes();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._statusCode).toBe(401);
    });
  });
});
