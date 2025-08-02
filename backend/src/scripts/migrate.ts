#!/usr/bin/env node

/**
 * Database Migration Script
 * Usage: npm run migrate [command]
 * Commands:
 *   - up: Run pending migrations (default)
 *   - status: Show migration status
 *   - rollback: Rollback last migration (not implemented yet)
 */

import dotenv from 'dotenv';
import { migrator } from '../database/migrator';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  const command = process.argv[2] || 'up';

  try {
    // Connect to database
    await db.connect();
    logger.info('Connected to database');

    switch (command) {
      case 'up':
        await runMigrations();
        break;
      
      case 'status':
        await showMigrationStatus();
        break;
      
      case 'rollback':
        await rollbackMigration();
        break;
      
      default:
        logger.error(`Unknown command: ${command}`);
        showUsage();
        process.exit(1);
    }

  } catch (error) {
    logger.error('Migration script failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

async function runMigrations() {
  logger.info('Starting database migrations...');
  await migrator.migrate();
  logger.info('Migrations completed successfully');
}

async function showMigrationStatus() {
  logger.info('Checking migration status...');
  
  const status = await migrator.getMigrationStatus();
  
  console.log('\n=== Migration Status ===');
  console.log(`Total migrations: ${status.total}`);
  console.log(`Applied: ${status.applied.length}`);
  console.log(`Pending: ${status.pending.length}`);
  
  if (status.applied.length > 0) {
    console.log('\nApplied migrations:');
    status.applied.forEach(version => {
      console.log(`  ✓ ${version}`);
    });
  }
  
  if (status.pending.length > 0) {
    console.log('\nPending migrations:');
    status.pending.forEach(migration => {
      console.log(`  ○ ${migration.version} - ${migration.name}`);
    });
  } else {
    console.log('\nNo pending migrations');
  }
  
  console.log('');
}

async function rollbackMigration() {
  logger.warn('Rollback functionality not implemented yet');
  console.log('Rollback functionality is not implemented yet.');
  console.log('This feature will be added in a future version.');
}

function showUsage() {
  console.log('\nUsage: npm run migrate [command]');
  console.log('\nCommands:');
  console.log('  up       Run pending migrations (default)');
  console.log('  status   Show migration status');
  console.log('  rollback Rollback last migration (not implemented)');
  console.log('');
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connection...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connection...');
  await db.close();
  process.exit(0);
});

// Run the script
main().catch(error => {
  logger.error('Unhandled error in migration script:', error);
  process.exit(1);
});