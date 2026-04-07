/**
 * 001-initial：建立所有初始資料表
 * 包含 tasks, task_dependencies, agents, events, workflows, workflow_steps, schema_migrations
 */
import type { Migration } from '../migrator.js';

const migration: Migration = {
  version: 1,
  name: '001-initial',
  up(db) {
    // === tasks 任務表 ===
    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'backlog'
          CHECK (status IN ('backlog','todo','in_progress','review','done','archived')),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('critical','high','medium','low')),
        assignee_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        tags TEXT DEFAULT '[]',
        progress INTEGER NOT NULL DEFAULT 0
          CHECK (progress >= 0 AND progress <= 100),
        workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee_agent_id);
      CREATE INDEX idx_tasks_workflow ON tasks(workflow_id);
    `);

    // === task_dependencies 任務依賴表 ===
    db.exec(`
      CREATE TABLE task_dependencies (
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, depends_on_task_id),
        CHECK (task_id != depends_on_task_id)
      );
      CREATE INDEX idx_deps_task ON task_dependencies(task_id);
      CREATE INDEX idx_deps_depends_on ON task_dependencies(depends_on_task_id);
    `);

    // === agents 代理表 ===
    db.exec(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        adapter_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle'
          CHECK (status IN ('idle','working','completed','error')),
        capabilities TEXT DEFAULT '[]',
        current_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        metadata TEXT DEFAULT '{}',
        registered_at TEXT NOT NULL,
        last_heartbeat_at TEXT NOT NULL
      );
      CREATE INDEX idx_agents_adapter ON agents(adapter_id);
      CREATE INDEX idx_agents_status ON agents(status);
    `);

    // === events 事件表 ===
    db.exec(`
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        correlation_id TEXT,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
        payload TEXT DEFAULT '{}',
        timestamp TEXT NOT NULL
      );
      CREATE INDEX idx_events_type ON events(event_type);
      CREATE INDEX idx_events_source ON events(source);
      CREATE INDEX idx_events_task ON events(task_id);
      CREATE INDEX idx_events_agent ON events(agent_id);
      CREATE INDEX idx_events_timestamp ON events(timestamp);
    `);

    // === workflows 工作流表 ===
    db.exec(`
      CREATE TABLE workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','running','completed','failed','cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
    `);

    // === workflow_steps 工作流步驟表 ===
    db.exec(`
      CREATE TABLE workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        step_order INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','running','completed','failed','skipped')),
        config TEXT DEFAULT '{}',
        UNIQUE(workflow_id, step_order)
      );
      CREATE INDEX idx_wf_steps_workflow ON workflow_steps(workflow_id);
    `);
  },
};

export default migration;
