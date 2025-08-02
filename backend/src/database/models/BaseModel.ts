import { db } from '../connection';
import { logger } from '@/utils/logger';

export interface BaseModelFields {
  id?: number;
  created_at?: Date;
  updated_at?: Date;
}

export abstract class BaseModel<T extends BaseModelFields> {
  protected tableName: string;
  protected fields: (keyof T)[];

  constructor(tableName: string, fields: (keyof T)[]) {
    this.tableName = tableName;
    this.fields = fields;
  }

  protected buildInsertQuery(data: Partial<T>): { query: string; values: any[] } {
    const keys = Object.keys(data).filter(key => 
      this.fields.includes(key as keyof T) && key !== 'id'
    );
    
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const values = keys.map(key => (data as any)[key]);
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return { query, values };
  }

  protected buildUpdateQuery(id: number, data: Partial<T>): { query: string; values: any[] } {
    const keys = Object.keys(data).filter(key => 
      this.fields.includes(key as keyof T) && key !== 'id' && key !== 'created_at'
    );
    
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...keys.map(key => (data as any)[key])];
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    return { query, values };
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const { query, values } = this.buildInsertQuery(data);
      const result = await db.query<T>(query, values);
      
      if (result.length === 0) {
        throw new Error(`Failed to create record in ${this.tableName}`);
      }

      logger.debug(`Created record in ${this.tableName}`, { id: result[0].id });
      return result[0];
    } catch (error) {
      logger.error(`Error creating record in ${this.tableName}:`, error);
      throw error;
    }
  }

  async findById(id: number): Promise<T | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const result = await db.query<T>(query, [id]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error(`Error finding record by id in ${this.tableName}:`, error);
      throw error;
    }
  }

  async findAll(limit?: number, offset?: number): Promise<T[]> {
    try {
      let query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
      const values: any[] = [];

      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }

      if (offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }

      return await db.query<T>(query, values);
    } catch (error) {
      logger.error(`Error finding all records in ${this.tableName}:`, error);
      throw error;
    }
  }

  async update(id: number, data: Partial<T>): Promise<T | null> {
    try {
      const { query, values } = this.buildUpdateQuery(id, data);
      const result = await db.query<T>(query, values);
      
      if (result.length === 0) {
        return null;
      }

      logger.debug(`Updated record in ${this.tableName}`, { id });
      return result[0];
    } catch (error) {
      logger.error(`Error updating record in ${this.tableName}:`, error);
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
      const result = await db.query(query, [id]);
      
      const deleted = result.length > 0;
      if (deleted) {
        logger.debug(`Deleted record from ${this.tableName}`, { id });
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Error deleting record from ${this.tableName}:`, error);
      throw error;
    }
  }

  async count(whereClause?: string, values?: any[]): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      const result = await db.query<{ count: string }>(query, values);
      return parseInt(result[0].count, 10);
    } catch (error) {
      logger.error(`Error counting records in ${this.tableName}:`, error);
      throw error;
    }
  }

  async findWhere(
    whereClause: string, 
    values: any[], 
    limit?: number, 
    offset?: number
  ): Promise<T[]> {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY created_at DESC`;
      
      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      if (offset) {
        query += ` OFFSET ${offset}`;
      }

      return await db.query<T>(query, values);
    } catch (error) {
      logger.error(`Error finding records with where clause in ${this.tableName}:`, error);
      throw error;
    }
  }
}