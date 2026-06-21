import { Router, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-chars-long';

// Zod schemas for input validation
const registerSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  name: z.string().min(2, 'Name must be at least 2 characters long.'),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum/Polygon wallet address format.').optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * POST /api/v1/auth/register
 * Registers a new user and returns JWT.
 */
router.post('/register', validateBody(registerSchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const { email, password, name, walletAddress } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        requestId: req.id,
        error: {
          message: 'An account with this email address already exists.',
          status: 409,
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        walletAddress: walletAddress || null,
      },
    });

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    next(error);
  }
});

async function ensureDemoUserExists() {
  const email = 'demo@terratwin.ai';
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) return user;

  const passwordHash = await bcrypt.hash('demo123', 10);
  user = await prisma.user.create({
    data: {
      id: 'cmqn7tjnj0000h6759cg993i1',
      email,
      name: 'Eco Explorer',
      passwordHash,
      monthlyGoal: 600,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    },
  });

  await prisma.goal.create({
    data: {
      userId: user.id,
      monthlyTarget: 600,
      targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    },
  });

  const entriesData = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(now.getDate() - i);

    const elecKwh = 8.5 + Math.random() * 6;
    entriesData.push({
      userId: user.id,
      category: 'energy',
      type: 'electricity',
      value: elecKwh,
      unit: 'kWh',
      carbonEmitted: Number((elecKwh * 0.233).toFixed(3)),
      source: 'iot',
      automatic: true,
      createdAt: date,
    });

    const isCar = Math.random() > 0.5;
    const distance = 5 + Math.random() * 20;
    entriesData.push({
      userId: user.id,
      category: 'transport',
      type: isCar ? 'car' : 'bus',
      value: distance,
      unit: 'km',
      carbonEmitted: Number((distance * (isCar ? 0.21 : 0.11)).toFixed(3)),
      source: isCar ? 'manual' : 'geolocation',
      automatic: !isCar,
      createdAt: date,
    });

    const foodType = Math.random() > 0.6 ? 'beef' : Math.random() > 0.3 ? 'chicken' : 'vegetables';
    const factor = foodType === 'beef' ? 27.0 : foodType === 'chicken' ? 6.9 : 2.0;
    const weight = 0.2 + Math.random() * 0.8;
    entriesData.push({
      userId: user.id,
      category: 'food',
      type: foodType,
      value: weight,
      unit: 'kg',
      carbonEmitted: Number((weight * factor).toFixed(3)),
      source: 'food_camera',
      automatic: true,
      createdAt: date,
    });
  }

  for (const entry of entriesData) {
    await prisma.carbonEntry.create({ data: entry });
  }

  const transactions = [
    {
      userId: user.id,
      action: 'walked_instead_of_car',
      amountECO: 50,
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      userId: user.id,
      action: 'carpool',
      amountECO: 100,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    },
    {
      userId: user.id,
      action: 'monthly_goal',
      amountECO: 500,
      transactionHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    },
  ];

  for (const tx of transactions) {
    await prisma.tokenTransaction.create({ data: tx });
  }

  return user;
}

/**
 * POST /api/v1/auth/login
 * Validates credentials and returns JWT.
 */
router.post('/login', validateBody(loginSchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const { email, password } = req.body;

    if (email === 'demo@terratwin.ai') {
      await ensureDemoUserExists();
    }

    // Retrieve user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({
        requestId: req.id,
        error: {
          message: 'Invalid email or password credentials.',
          status: 401,
        },
      });
    }

    // Compare passwords
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        requestId: req.id,
        error: {
          message: 'Invalid email or password credentials.',
          status: 401,
        },
      });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        monthlyGoal: user.monthlyGoal,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Retrieves current profile of the authenticated user.
 */
router.get('/me', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user?.id;
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        monthlyGoal: true,
        createdAt: true,
      },
    });

    if (!user && req.user?.email === 'demo@terratwin.ai') {
      await ensureDemoUserExists();
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          walletAddress: true,
          monthlyGoal: true,
          createdAt: true,
        },
      });
    }

    if (!user) {
      return res.status(404).json({
        requestId: req.id,
        error: {
          message: 'User profile not found.',
          status: 404,
        },
      });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
