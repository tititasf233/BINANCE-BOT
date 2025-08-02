// Database exports
export { db, default as database } from './connection';
export { migrator, default as DatabaseMigrator } from './migrator';

// Models
export { BaseModel } from './models/BaseModel';
export { UserModel, userModel } from './models/User';

// Types
export type { BaseModelFields } from './models/BaseModel';
export type { UserFields } from './models/User';

// Database initialization function
import { db } from './connection';
import { migrator } from './migrator';
import { logger } from '@/utils/logger';

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database connection...');
    
    // Test database connection
    await db.connect();
    
    // Run migrations
    logger.info('Running database migrations...');
    await migrator.migrate();
    
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await db.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}