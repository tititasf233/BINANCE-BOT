import request from 'supertest';
import { app } from '../simple-server';

describe('Authentication API', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@test.com',
    password: 'password123'
  };

  let authToken: string;

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not register user with existing email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should not register user without required fields', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      authToken = response.body.data.token;
    });

    it('should not login with invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should not get profile without token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should not get profile with invalid token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });
  });
});