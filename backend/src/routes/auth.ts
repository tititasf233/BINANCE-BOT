import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, generateRefreshToken, AuthRequest, authenticateToken } from '../middleware/auth';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

const router = express.Router();

// Registro de usuário
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password and name are required'
      });
    }

    // Verificar se usuário já existe
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const newUser = await db.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, 'user']
    );

    const user = newUser[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Buscar usuário
    const users = await db.query(
      'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Gerar tokens
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Atualizar último login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Perfil do usuário (rota protegida)
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await db.query(
      'SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
          lastLogin: user.last_login
        }
      }
    });

  } catch (error) {
    logger.error('Profile fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Logout (invalidar token - implementação básica)
router.post('/logout', authenticateToken, (req: AuthRequest, res) => {
  // Em uma implementação real, você adicionaria o token a uma blacklist
  logger.info('User logged out', { userId: req.user!.id });
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;