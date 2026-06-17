// Fichier moyen (~200 lignes) pour tester investigate_file
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  poolSize: number;
  timeout: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields: string[];
  duration: number;
}

export class DatabaseConnection extends EventEmitter {
  private config: DatabaseConfig;
  private connected = false;
  private pool: any[] = [];
  private queryQueue: any[] = [];
  private processing = false;

  constructor(config: Partial<DatabaseConfig> = {}) {
    super();
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      username: config.username || 'root',
      password: config.password || '',
      database: config.database || 'default',
      ssl: config.ssl || false,
      poolSize: config.poolSize || 10,
      timeout: config.timeout || 30000,
    };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.emit('connecting', this.config);
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.emit('disconnecting');
    await new Promise(resolve => setTimeout(resolve, 50));
    this.connected = false;
    this.emit('disconnected');
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.connected) throw new Error('Not connected');
    const start = Date.now();
    this.emit('query', sql, params);
    const result = await this.executeQuery(sql, params);
    const duration = Date.now() - start;
    this.emit('queryResult', result, duration);
    return { ...result, duration };
  }

  private async executeQuery<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    // Simulation
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      rows: [] as T[],
      rowCount: 0,
      fields: [],
      duration: 0,
    };
  }

  async transaction<T>(callback: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    await this.query('BEGIN');
    try {
      const result = await callback(this);
      await this.query('COMMIT');
      return result;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConfig(): DatabaseConfig {
    return { ...this.config };
  }
}

export function createConnection(config?: Partial<DatabaseConfig>): DatabaseConnection {
  return new DatabaseConnection(config);
}

export async function withConnection<T>(
  config: Partial<DatabaseConfig>,
  callback: (conn: DatabaseConnection) => Promise<T>
): Promise<T> {
  const conn = createConnection(config);
  try {
    await conn.connect();
    return await callback(conn);
  } finally {
    await conn.disconnect();
  }
}

// Tests
async function main() {
  const db = createConnection({ host: 'test.local', database: 'test' });
  await db.connect();
  console.log('Connected:', db.isConnected());
  const result = await db.query('SELECT 1');
  console.log('Query result:', result);
  await db.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}
