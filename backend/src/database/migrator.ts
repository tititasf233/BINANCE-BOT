import fs from 'fs';
import path from 'path';
import { db } from './connection';
import { logger } from '@/utils/logger';

interface Migration {
  version: string;
  name: string;
  filename: string;
  sql: string;
}

class DatabaseMigrator {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async ensureMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await db.query(query);
    logger.info('Migrations table ensured');
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await db.query<{ version: string }>(
      'SELECT version FROM migrations ORDER BY version'
    );
    return result.map(row => row.version);
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = this.loadMigrationFiles();
    
    return allMigrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );
  }

  private loadMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn('Migrations directory does not exist:', this.migrationsDir);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Extract version from filename (e.g., "001_initial_schema.sql" -> "001")
      const versionMatch = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!versionMatch) {
        throw new Error(`Invalid migration filename format: ${filename}`);
      }

      const [, version, name] = versionMatch;
      
      return {
        version,
        name: name.replace(/_/g, ' '),
        filename,
        sql
      };
    });
  }

  async runMigration(migration: Migration): Promise<void> {
    logger.info(`Running migration ${migration.version}: ${migration.name}`);
    
    await db.transaction(async (client) => {
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as applied
      await client.query(
        'INSERT INTO migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
        [migration.version, migration.name]
      );
    });

    logger.info(`Migration ${migration.version} completed successfully`);
  }

  async migrate(): Promise<void> {
    try {
      await this.ensureMigrationsTable();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  async rollback(_targetVersion?: string): Promise<void> {
    // This is a simplified rollback - in production you'd want more sophisticated rollback logic
    logger.warn('Rollback functionality not implemented yet');
    throw new Error('Rollback functionality not implemented');
  }

  async getMigrationStatus(): Promise<{
    applied: string[];
    pending: Migration[];
    total: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    const total = applied.length + pending.length;

    return {
      applied,
      pending,
      total
    };
  }
}

export const migrator = new DatabaseMigrator();
export default migrator;