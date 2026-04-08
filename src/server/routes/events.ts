/**
 * Event REST Routes
 * 基礎路徑：/api/v1/events
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { SubmitEventDto, BatchSubmitEventDto } from '../dto/event.dto.js';
import * as eventService from '../../core/services/event.service.js';
import { parseIntParam } from '../utils/parse-params.js';

/** 從 query 取得 string 值 */
function queryStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

export const eventsRouter: ReturnType<typeof Router> = Router();

/** GET /events — 列出事件 */
eventsRouter.get('/', (req, res) => {
  const filters: Record<string, unknown> = {
    limit: parseIntParam(req.query['limit'], 50, 0, 1000),
    offset: parseIntParam(req.query['offset'], 0, 0, Number.MAX_SAFE_INTEGER),
  };
  const type = queryStr(req.query['type']);
  if (type) filters['type'] = type;
  const source = queryStr(req.query['source']);
  if (source) filters['source'] = source;
  const taskId = queryStr(req.query['taskId']);
  if (taskId) filters['taskId'] = taskId;
  const agentId = queryStr(req.query['agentId']);
  if (agentId) filters['agentId'] = agentId;
  const since = queryStr(req.query['since']);
  if (since) filters['since'] = since;
  const until = queryStr(req.query['until']);
  if (until) filters['until'] = until;

  const { events, total } = eventService.listEvents(
    filters as eventService.EventFilters,
  );

  res.json({
    success: true,
    data: events,
    meta: {
      total,
      limit: filters['limit'],
      offset: filters['offset'],
    },
  });
});

/** POST /events — 提交事件 */
eventsRouter.post('/', validate(SubmitEventDto), (req, res) => {
  const event = eventService.submitEvent(req.body);
  res.status(201).json({ success: true, data: event });
});

/** POST /events/batch — 批量提交事件 */
eventsRouter.post('/batch', validate(BatchSubmitEventDto), (req, res) => {
  const events = eventService.submitEventsBatch(req.body.events);
  res.status(201).json({ success: true, data: events });
});
