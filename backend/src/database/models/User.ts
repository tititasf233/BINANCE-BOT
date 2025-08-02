import { BaseModel, BaseModelFields } from './BaseModel';
import { db } from '../connection';
import { logger } from '@/utils/logger';

export interface UserFields extends BaseModelFields {
  username: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  email_verified: boolean;
}

export class UserModel extends BaseModel<UserFields> {
  constructor() {
    super('users', [
      'id',
      'username',
      'email',
      'password_hash',
      'is_active',
      'email_verified',
      'created_at',
      'updated_at'
    ]);
  }

  async findByEmail(email: string): Promise<UserFields | null> {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await db.query<UserFields>(query, [email]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserFields | null> {
    try {
      const query = 'SELECT * FROM users WHERE username = $1';
      const result = await db.query<UserFields>(query, [username]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  async findByEmailOrUsername(identifier: string): Promise<UserFields | null> {
    try {
      const query = 'SELECT * FROM users WHERE email = $1 OR username = $1';
      const result = await db.query<UserFields>(query, [identifier]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error finding user by email or username:', error);
      throw error;
    }
  }

  async updatePassword(id: number, passwordHash: string): Promise<boolean> {
    try {
      const query = `
        UPDATE users 
        SET password_hash = $2, updated_at = NOW() 
        WHERE id = $1
      `;
      const result = await db.query(query, [id, passwordHash]);
      
      return result.length > 0;
    } catch (error) {
      logger.error('Error updating user password:', error);
      throw error;
    }
  }

  async verifyEmail(id: number): Promise<boolean> {
    try {
      const query = `
        UPDATE users 
        SET email_verified = true, updated_at = NOW() 
        WHERE id = $1
      `;
      const result = await db.query(query, [id]);
      
      return result.length > 0;
    } catch (error) {
      logger.error('Error verifying user email:', error);
      throw error;
    }
  }

  async deactivateUser(id: number): Promise<boolean> {
    try {
      const query = `
        UPDATE users 
        SET is_active = false, updated_at = NOW() 
        WHERE id = $1
      `;
      const result = await db.query(query, [id]);
      
      return result.length > 0;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  async getActiveUsers(limit?: number, offset?: number): Promise<UserFields[]> {
    try {
      let query = 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC';
      const values: any[] = [];

      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      return await db.query<UserFields>(query, values);
    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    recent: number;
  }> {
    try {
      const queries = [
        'SELECT COUNT(*) as count FROM users',
        'SELECT COUNT(*) as count FROM users WHERE is_active = true',
        'SELECT COUNT(*) as count FROM users WHERE email_verified = true',
        'SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL \'7 days\''
      ];

      const results = await Promise.all(
        queries.map(query => db.query<{ count: string }>(query))
      );

      return {
        total: parseInt(results[0][0].count, 10),
        active: parseInt(results[1][0].count, 10),
        verified: parseInt(results[2][0].count, 10),
        recent: parseInt(results[3][0].count, 10)
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }
}

export const userModel = new UserModel();