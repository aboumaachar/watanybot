/**
 * Watany PostgreSQL Persistence Layer
 * 
 * Phase 4: Database persistence for all advanced features
 * - Sessions, interactions, feedback
 * - A/B test experiments and results
 * - KB gaps and improvements
 * - User profiles and analytics
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

// ─────────────────────────────────────────────────────────────────────
// SQL Migrations
// ─────────────────────────────────────────────────────────────────────

export const migrations = [
  // Migration 001: Sessions table
  {
    version: 1,
    name: 'create_sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        channel VARCHAR(20) NOT NULL DEFAULT 'web',
        state VARCHAR(20) NOT NULL DEFAULT 'active',
        context JSONB DEFAULT '{}',
        analytics JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );
      
      CREATE INDEX idx_sessions_user_id ON watany_sessions(user_id);
      CREATE INDEX idx_sessions_state ON watany_sessions(state);
      CREATE INDEX idx_sessions_created_at ON watany_sessions(created_at);
    `,
    down: 'DROP TABLE IF EXISTS watany_sessions CASCADE;',
  },
  
  // Migration 002: Session messages table
  {
    version: 2,
    name: 'create_session_messages_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_session_messages (
        id VARCHAR(100) PRIMARY KEY,
        session_id VARCHAR(100) REFERENCES watany_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_session_messages_session ON watany_session_messages(session_id);
      CREATE INDEX idx_session_messages_created ON watany_session_messages(created_at);
    `,
    down: 'DROP TABLE IF EXISTS watany_session_messages CASCADE;',
  },
  
  // Migration 003: Interactions table
  {
    version: 3,
    name: 'create_interactions_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_interactions (
        id VARCHAR(100) PRIMARY KEY,
        session_id VARCHAR(100),
        user_id VARCHAR(100),
        query TEXT NOT NULL,
        response TEXT,
        intent VARCHAR(100),
        entities JSONB DEFAULT '{}',
        chunks_used JSONB DEFAULT '[]',
        confidence REAL DEFAULT 0,
        processing_time_ms INTEGER DEFAULT 0,
        rating VARCHAR(20),
        feedback_text TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_interactions_session ON watany_interactions(session_id);
      CREATE INDEX idx_interactions_user ON watany_interactions(user_id);
      CREATE INDEX idx_interactions_intent ON watany_interactions(intent);
      CREATE INDEX idx_interactions_created ON watany_interactions(created_at);
      CREATE INDEX idx_interactions_confidence ON watany_interactions(confidence);
    `,
    down: 'DROP TABLE IF EXISTS watany_interactions CASCADE;',
  },
  
  // Migration 004: Experiments table
  {
    version: 4,
    name: 'create_experiments_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_experiments (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        hypothesis TEXT,
        status VARCHAR(20) DEFAULT 'draft',
        target_metric VARCHAR(50) DEFAULT 'conversionRate',
        minimum_sample_size INTEGER DEFAULT 100,
        significance_level REAL DEFAULT 0.95,
        variants JSONB DEFAULT '[]',
        results JSONB DEFAULT '{}',
        winner VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );
      
      CREATE INDEX idx_experiments_status ON watany_experiments(status);
      CREATE INDEX idx_experiments_created ON watany_experiments(created_at);
    `,
    down: 'DROP TABLE IF EXISTS watany_experiments CASCADE;',
  },
  
  // Migration 005: User assignments table
  {
    version: 5,
    name: 'create_user_assignments_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_user_assignments (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        experiment_id VARCHAR(100) REFERENCES watany_experiments(id) ON DELETE CASCADE,
        variant_id VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, experiment_id)
      );
      
      CREATE INDEX idx_user_assignments_user ON watany_user_assignments(user_id);
      CREATE INDEX idx_user_assignments_experiment ON watany_user_assignments(experiment_id);
    `,
    down: 'DROP TABLE IF EXISTS watany_user_assignments CASCADE;',
  },
  
  // Migration 006: KB gaps table
  {
    version: 6,
    name: 'create_kb_gaps_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_kb_gaps (
        id SERIAL PRIMARY KEY,
        topic VARCHAR(255) NOT NULL,
        sample_queries JSONB DEFAULT '[]',
        frequency INTEGER DEFAULT 1,
        avg_confidence REAL DEFAULT 0,
        severity VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'open',
        resolution TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      
      CREATE INDEX idx_kb_gaps_topic ON watany_kb_gaps(topic);
      CREATE INDEX idx_kb_gaps_severity ON watany_kb_gaps(severity);
      CREATE INDEX idx_kb_gaps_status ON watany_kb_gaps(status);
    `,
    down: 'DROP TABLE IF EXISTS watany_kb_gaps CASCADE;',
  },
  
  // Migration 007: User profiles table
  {
    version: 7,
    name: 'create_user_profiles_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_user_profiles (
        user_id VARCHAR(100) PRIMARY KEY,
        common_intents JSONB DEFAULT '[]',
        preferred_topics JSONB DEFAULT '[]',
        interaction_count INTEGER DEFAULT 0,
        avg_satisfaction REAL DEFAULT 0,
        preferred_language VARCHAR(10) DEFAULT 'ar',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_user_profiles_interaction ON watany_user_profiles(interaction_count);
    `,
    down: 'DROP TABLE IF EXISTS watany_user_profiles CASCADE;',
  },
  
  // Migration 008: Embeddings table (for semantic search)
  {
    version: 8,
    name: 'create_embeddings_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_embeddings (
        id VARCHAR(100) PRIMARY KEY,
        chunk_id VARCHAR(100) NOT NULL,
        embedding REAL[] NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_embeddings_chunk ON watany_embeddings(chunk_id);
    `,
    down: 'DROP TABLE IF EXISTS watany_embeddings CASCADE;',
  },
  
  // Migration 009: Analytics events table
  {
    version: 9,
    name: 'create_analytics_events_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_analytics_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB DEFAULT '{}',
        user_id VARCHAR(100),
        session_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX idx_analytics_events_type ON watany_analytics_events(event_type);
      CREATE INDEX idx_analytics_events_user ON watany_analytics_events(user_id);
      CREATE INDEX idx_analytics_events_created ON watany_analytics_events(created_at);
    `,
    down: 'DROP TABLE IF EXISTS watany_analytics_events CASCADE;',
  },
  
  // Migration 010: Migrations tracking table
  {
    version: 10,
    name: 'create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS watany_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    down: 'DROP TABLE IF EXISTS watany_migrations CASCADE;',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Database Client Interface
// ─────────────────────────────────────────────────────────────────────

export interface DatabaseClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────
// PostgreSQL Client Implementation (using pg library if available)
// ─────────────────────────────────────────────────────────────────────

export class PostgresClient implements DatabaseClient {
  private config: DatabaseConfig;
  private pool: unknown = null;
  private connected = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Dynamic import of pg
      const pg = await import('pg');
      const Pool = pg.default?.Pool || pg.Pool;
      
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.poolSize || 10,
      });

      // Test connection
      await (this.pool as any).query('SELECT 1');
      this.connected = true;
      console.log('[DB] PostgreSQL connected');
    } catch (error) {
      console.error('[DB] PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await (this.pool as any).end();
      this.pool = null;
      this.connected = false;
      console.log('[DB] PostgreSQL disconnected');
    }
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      await this.connect();
    }

    const result = await (this.pool as any).query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      await this.connect();
    }

    const client = await (this.pool as any).connect();
    
    try {
      await client.query('BEGIN');
      
      // Create wrapped client
      const wrappedClient: DatabaseClient = {
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        connect: async () => {},
        disconnect: async () => {},
        transaction: async (f) => f(wrappedClient),
      };

      const result = await fn(wrappedClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// In-Memory Fallback Client
// ─────────────────────────────────────────────────────────────────────

export class InMemoryClient implements DatabaseClient {
  private tables: Map<string, unknown[]> = new Map();

  async connect(): Promise<void> {
    console.log('[DB] Using in-memory storage (PostgreSQL not configured)');
  }

  async disconnect(): Promise<void> {
    this.tables.clear();
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    // Parse simple queries for in-memory simulation
    const upperSql = sql.toUpperCase().trim();

    if (upperSql.startsWith('CREATE TABLE') || upperSql.startsWith('CREATE INDEX')) {
      // Schema operations - no-op for in-memory
      return { rows: [], rowCount: 0 };
    }

    if (upperSql.startsWith('DROP TABLE')) {
      return { rows: [], rowCount: 0 };
    }

    if (upperSql.startsWith('SELECT 1')) {
      return { rows: [{ '?column?': 1 }] as T[], rowCount: 1 };
    }

    // For actual data operations, log a warning
    console.warn('[DB] In-memory query (data not persisted):', sql.slice(0, 100));
    return { rows: [] as T[], rowCount: 0 };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Persistence Manager
// ─────────────────────────────────────────────────────────────────────

export class PersistenceManager {
  private client: DatabaseClient;
  private isPostgres: boolean;

  constructor(client: DatabaseClient) {
    this.client = client;
    this.isPostgres = client instanceof PostgresClient;
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<number> {
    await this.client.connect();

    // Ensure migrations table exists
    await this.client.query(migrations[migrations.length - 1].up);

    // Get applied migrations
    let appliedVersions: number[] = [];
    try {
      const result = await this.client.query<{ version: number }>(
        'SELECT version FROM watany_migrations ORDER BY version'
      );
      appliedVersions = result.rows.map(r => r.version);
    } catch {
      // Table might not exist yet
    }

    // Apply pending migrations
    let applied = 0;
    for (const migration of migrations) {
      if (!appliedVersions.includes(migration.version)) {
        console.log(`[DB] Applying migration ${migration.version}: ${migration.name}`);
        await this.client.query(migration.up);
        await this.client.query(
          'INSERT INTO watany_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        applied++;
      }
    }

    if (applied > 0) {
      console.log(`[DB] Applied ${applied} migrations`);
    } else {
      console.log('[DB] Database is up to date');
    }

    return applied;
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    const result = await this.client.query<{ version: number }>(
      'SELECT version FROM watany_migrations ORDER BY version DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      console.log('[DB] No migrations to rollback');
      return;
    }

    const version = result.rows[0].version;
    const migration = migrations.find(m => m.version === version);

    if (migration) {
      console.log(`[DB] Rolling back migration ${version}: ${migration.name}`);
      await this.client.query(migration.down);
      await this.client.query('DELETE FROM watany_migrations WHERE version = $1', [version]);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Session Operations
  // ─────────────────────────────────────────────────────────────

  async saveSession(session: {
    id: string;
    userId?: string;
    channel: string;
    state: string;
    context: unknown;
    analytics: unknown;
    expiresAt: Date;
  }): Promise<void> {
    await this.client.query(
      `INSERT INTO watany_sessions (id, user_id, channel, state, context, analytics, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         state = EXCLUDED.state,
         context = EXCLUDED.context,
         analytics = EXCLUDED.analytics,
         updated_at = NOW()`,
      [session.id, session.userId, session.channel, session.state, 
       JSON.stringify(session.context), JSON.stringify(session.analytics), session.expiresAt]
    );
  }

  async loadSessions(): Promise<unknown[]> {
    const result = await this.client.query(
      `SELECT * FROM watany_sessions WHERE state != 'expired' AND expires_at > NOW()`
    );
    return result.rows;
  }

  // ─────────────────────────────────────────────────────────────
  // Interaction Operations
  // ─────────────────────────────────────────────────────────────

  async saveInteraction(interaction: {
    id: string;
    sessionId?: string;
    userId?: string;
    query: string;
    response?: string;
    intent?: string;
    entities?: unknown;
    chunksUsed?: string[];
    confidence: number;
    processingTimeMs?: number;
    rating?: string;
    feedbackText?: string;
  }): Promise<void> {
    await this.client.query(
      `INSERT INTO watany_interactions 
       (id, session_id, user_id, query, response, intent, entities, chunks_used, confidence, processing_time_ms, rating, feedback_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [interaction.id, interaction.sessionId, interaction.userId, interaction.query,
       interaction.response, interaction.intent, JSON.stringify(interaction.entities || {}),
       JSON.stringify(interaction.chunksUsed || []), interaction.confidence,
       interaction.processingTimeMs, interaction.rating, interaction.feedbackText]
    );
  }

  async loadInteractions(limit = 1000): Promise<unknown[]> {
    const result = await this.client.query(
      `SELECT * FROM watany_interactions ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // ─────────────────────────────────────────────────────────────
  // Experiment Operations
  // ─────────────────────────────────────────────────────────────

  async saveExperiment(experiment: {
    id: string;
    name: string;
    description?: string;
    hypothesis?: string;
    status: string;
    targetMetric: string;
    minimumSampleSize: number;
    significanceLevel: number;
    variants: unknown;
    results: unknown;
    winner?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<void> {
    await this.client.query(
      `INSERT INTO watany_experiments 
       (id, name, description, hypothesis, status, target_metric, minimum_sample_size, significance_level, variants, results, winner, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         results = EXCLUDED.results,
         winner = EXCLUDED.winner,
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at`,
      [experiment.id, experiment.name, experiment.description, experiment.hypothesis,
       experiment.status, experiment.targetMetric, experiment.minimumSampleSize,
       experiment.significanceLevel, JSON.stringify(experiment.variants),
       JSON.stringify(experiment.results), experiment.winner,
       experiment.startedAt, experiment.completedAt]
    );
  }

  async loadExperiments(): Promise<unknown[]> {
    const result = await this.client.query(
      `SELECT * FROM watany_experiments ORDER BY created_at DESC`
    );
    return result.rows;
  }

  // ─────────────────────────────────────────────────────────────
  // Analytics Operations
  // ─────────────────────────────────────────────────────────────

  async logEvent(eventType: string, eventData: unknown, userId?: string, sessionId?: string): Promise<void> {
    await this.client.query(
      `INSERT INTO watany_analytics_events (event_type, event_data, user_id, session_id)
       VALUES ($1, $2, $3, $4)`,
      [eventType, JSON.stringify(eventData), userId, sessionId]
    );
  }

  async getEventStats(startDate: Date, endDate: Date): Promise<unknown[]> {
    const result = await this.client.query(
      `SELECT event_type, COUNT(*) as count, DATE_TRUNC('hour', created_at) as hour
       FROM watany_analytics_events
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY event_type, DATE_TRUNC('hour', created_at)
       ORDER BY hour DESC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Get database client
   */
  getClient(): DatabaseClient {
    return this.client;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let persistenceInstance: PersistenceManager | null = null;

export function getPersistenceManager(): PersistenceManager {
  if (!persistenceInstance) {
    const host = process.env.DB_HOST;
    
    if (host) {
      const client = new PostgresClient({
        host,
        port: parseInt(process.env.DB_PORT || '5433'),
        database: process.env.DB_NAME || 'watany',
        user: process.env.DB_USER || 'watany',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
      });
      persistenceInstance = new PersistenceManager(client);
    } else {
      // Use in-memory fallback
      persistenceInstance = new PersistenceManager(new InMemoryClient());
    }
  }
  return persistenceInstance;
}

export function createPersistenceManager(config: DatabaseConfig): PersistenceManager {
  const client = new PostgresClient(config);
  persistenceInstance = new PersistenceManager(client);
  return persistenceInstance;
}
