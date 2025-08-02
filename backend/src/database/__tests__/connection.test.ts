import { db } from '../connection';

describe('Database Connection', () => {
  afterAll(async () => {
    await db.close();
  });

  describe('connection', () => {
    it('should connect to database successfully', async () => {
      await expect(db.connect()).resolves.not.toThrow();
    });

    it('should execute simple query', async () => {
      const result = await db.query('SELECT 1 as test');
      expect(result).toHaveLength(1);
      expect(result[0].test).toBe(1);
    });

    it('should handle query with parameters', async () => {
      const result = await db.query('SELECT $1 as value', ['test']);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('test');
    });
  });

  describe('transactions', () => {
    it('should execute transaction successfully', async () => {
      const result = await db.transaction(async (client) => {
        const res = await client.query('SELECT 1 as test');
        return res.rows[0];
      });

      expect(result.test).toBe(1);
    });

    it('should rollback transaction on error', async () => {
      await expect(
        db.transaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('pool info', () => {
    it('should return pool information', () => {
      const poolInfo = db.getPoolInfo();
      expect(poolInfo).toHaveProperty('totalCount');
      expect(poolInfo).toHaveProperty('idleCount');
      expect(poolInfo).toHaveProperty('waitingCount');
    });
  });
});