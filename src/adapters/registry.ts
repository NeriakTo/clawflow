/**
 * Adapter 註冊表
 * 管理已載入的 CLI adapter，提供註冊、查詢、移除功能
 */
import type {
  CLIAdapter,
  AdapterConfig,
  AdapterHealthStatus,
  EventSink,
} from './types.js';

/** 已註冊的 adapter 項目 */
interface RegisteredAdapter {
  readonly adapter: CLIAdapter;
  readonly config: AdapterConfig;
  connected: boolean;
}

/**
 * Adapter 註冊表
 * 維護所有已載入的 adapter 及其狀態
 */
export class AdapterRegistry {
  private readonly adapters: Map<string, RegisteredAdapter> = new Map();

  /**
   * 註冊一個 adapter
   * @param adapter CLIAdapter 實例
   * @param config 配置
   * @throws 若 adapter ID 已存在
   */
  register(adapter: CLIAdapter, config: AdapterConfig): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter "${adapter.id}" 已存在，請先移除再重新註冊`);
    }
    this.adapters.set(adapter.id, {
      adapter,
      config,
      connected: false,
    });
  }

  /**
   * 移除一個 adapter（若已連線會先斷線）
   * @param id Adapter ID
   */
  async unregister(id: string): Promise<void> {
    const entry = this.adapters.get(id);
    if (entry === undefined) {
      return;
    }
    if (entry.connected) {
      await entry.adapter.disconnect();
    }
    this.adapters.delete(id);
  }

  /**
   * 取得指定 adapter
   */
  get(id: string): CLIAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  /**
   * 取得所有已註冊的 adapter ID
   */
  listIds(): readonly string[] {
    return [...this.adapters.keys()];
  }

  /**
   * 連線指定 adapter
   */
  async connect(id: string, eventSink: EventSink): Promise<void> {
    const entry = this.adapters.get(id);
    if (entry === undefined) {
      throw new Error(`Adapter "${id}" 不存在`);
    }
    if (entry.connected) {
      return;
    }
    await entry.adapter.connect(entry.config, eventSink);
    entry.connected = true;
  }

  /**
   * 連線所有已啟用的 adapter
   */
  async connectAll(eventSink: EventSink): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [id, entry] of this.adapters) {
      if (entry.config.enabled && !entry.connected) {
        promises.push(this.connect(id, eventSink));
      }
    }
    await Promise.all(promises);
  }

  /**
   * 斷開所有 adapter
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const entry of this.adapters.values()) {
      if (entry.connected) {
        promises.push(
          entry.adapter.disconnect().then(() => {
            entry.connected = false;
          })
        );
      }
    }
    await Promise.all(promises);
  }

  /**
   * 對所有已連線 adapter 執行健康檢查
   */
  async healthCheckAll(): Promise<ReadonlyMap<string, AdapterHealthStatus>> {
    const results = new Map<string, AdapterHealthStatus>();
    const entries = [...this.adapters.entries()].filter(
      ([_, entry]) => entry.connected
    );
    await Promise.all(
      entries.map(async ([id, entry]) => {
        try {
          const status = await entry.adapter.healthCheck();
          results.set(id, status);
        } catch (err: unknown) {
          results.set(id, {
            healthy: false,
            message:
              err instanceof Error ? err.message : '健康檢查時發生未知錯誤',
          });
        }
      })
    );
    return results;
  }

  /**
   * 取得已註冊 adapter 數量
   */
  get size(): number {
    return this.adapters.size;
  }
}
