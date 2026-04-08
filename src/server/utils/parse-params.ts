/**
 * 安全解析查詢參數工具函式
 */

/**
 * 安全解析整數查詢參數，支援預設值與範圍限制
 * @param value - 查詢參數值（可能是 string、undefined 或其他型別）
 * @param defaultVal - 預設值
 * @param min - 最小值
 * @param max - 最大值
 */
export function parseIntParam(
  value: unknown,
  defaultVal: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultVal;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultVal;
  }
  const rounded = Math.trunc(parsed);
  return Math.max(min, Math.min(max, rounded));
}
