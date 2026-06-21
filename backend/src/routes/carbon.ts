import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();

// Zod schema for creating carbon entry
const carbonEntrySchema = z.object({
  category: z.enum(['transport', 'energy', 'food', 'shopping', 'waste']),
  type: z.string().min(1, 'Type is required.'),
  value: z.number().positive('Value must be greater than 0.'),
  unit: z.string().min(1, 'Unit is required.'),
});

/**
 * Calculates emissions based on category, type, and quantity.
 */
export const calculateEmissions = (category: string, type: string, value: number): number => {
  let factor = 0;
  const t = type.toLowerCase();
  
  if (category === 'energy') {
    if (t.includes('electricity')) factor = 0.233; // kg CO2 / kWh
    else if (t.includes('gas')) factor = 0.200; // kg CO2 / kWh
  } else if (category === 'transport') {
    if (t.includes('car')) factor = 0.210; // kg CO2 / km
    else if (t.includes('bus')) factor = 0.110; // kg CO2 / km
    else if (t.includes('bike') || t.includes('walk')) factor = 0.000;
  } else if (category === 'food') {
    if (t.includes('beef')) factor = 27.000; // kg CO2 / kg
    else if (t.includes('chicken')) factor = 6.900; // kg CO2 / kg
    else if (t.includes('vegetables') || t.includes('plant')) factor = 2.000; // kg CO2 / kg
  } else if (category === 'shopping') {
    factor = 0.500;
  } else if (category === 'waste') {
    factor = 0.350;
  }

  return Number((value * factor).toFixed(3));
};

/**
 * GET /api/v1/carbon/entries
 * Fetches user carbon entries with pagination.
 */
router.get('/entries', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = await prisma.carbonEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const count = await prisma.carbonEntry.count({ where: { userId } });

    res.status(200).json({ entries, count });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/carbon/entries
 * Creates a new manual carbon entry.
 */
router.post('/entries', authMiddleware, validateBody(carbonEntrySchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { category, type, value, unit } = req.body;

    const carbonEmitted = calculateEmissions(category, type, value);

    const entry = await prisma.carbonEntry.create({
      data: {
        userId,
        category,
        type,
        value,
        unit,
        carbonEmitted,
        source: 'manual',
        automatic: false,
      },
    });

    // Notify user sessions via WebSockets
    const io = req.app.get('io');
    if (io) {
      io.emit(`carbon:updated:${userId}`, entry);
      io.emit('carbon:updated', { userId, entry });
    }

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/carbon/analytics/daily
 * Aggregates daily carbon emissions for the last 7 days.
 */
router.get('/analytics/daily', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const entries = await prisma.carbonEntry.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Bucket entries by day
    const dailyMap: { [date: string]: number } = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap[dateStr] = 0;
    }

    entries.forEach((entry) => {
      const dateStr = entry.createdAt.toISOString().split('T')[0];
      if (dailyMap[dateStr] !== undefined) {
        dailyMap[dateStr] += entry.carbonEmitted;
      }
    });

    const dailyStats = Object.keys(dailyMap)
      .map((date) => ({
        date,
        carbonEmitted: Number(dailyMap[date].toFixed(3)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json(dailyStats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/carbon/analytics/monthly
 * Aggregates carbon emissions for the current month vs goal target.
 */
router.get('/analytics/monthly', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyGoal: true },
    });

    const entries = await prisma.carbonEntry.findMany({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
    });

    const totalEmitted = entries.reduce((sum, entry) => sum + entry.carbonEmitted, 0);

    res.status(200).json({
      month: now.toLocaleString('default', { month: 'long' }),
      totalEmitted: Number(totalEmitted.toFixed(3)),
      goal: user?.monthlyGoal || 600,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/prediction (Mapping /api/v1/analytics/prediction)
 * Calculates the monthly carbon projection based on the last 7 days and compares against the goal.
 */
router.get('/prediction', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const entries = await prisma.carbonEntry.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const totalEmitted = entries.reduce((sum, e) => sum + e.carbonEmitted, 0);
    const dailyAverage = totalEmitted / 7;
    const monthlyForecast = Number((dailyAverage * 30).toFixed(3));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyGoal: true },
    });

    const goal = user?.monthlyGoal || 600;
    const status = monthlyForecast <= goal ? 'On track' : '⚠️ Above goal';

    res.status(200).json({
      dailyAverage: Number(dailyAverage.toFixed(3)),
      monthlyForecast,
      goal,
      status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/carbon/public-stats
 * Public endpoint to fetch carbon statistics for the demo user (for the guest landing page).
 */
router.get('/public-stats', async (req: RequestWithId, res: Response, next) => {
  try {
    const email = 'demo@terratwin.ai';
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, monthlyGoal: true },
    });

    if (!user) {
      // Fallback defaults if demo user not seeded yet
      return res.status(200).json({
        totalEmitted: 438.0,
        monthlyForecast: 320.0,
        goal: 600,
        carbonSaved: 162.0,
      });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries = await prisma.carbonEntry.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: startOfMonth },
      },
    });

    const totalEmitted = entries.reduce((sum, entry) => sum + entry.carbonEmitted, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentEntries = await prisma.carbonEntry.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const recentTotal = recentEntries.reduce((sum, e) => sum + e.carbonEmitted, 0);
    const dailyAverage = recentTotal / 7;
    const monthlyForecast = Number((dailyAverage * 30).toFixed(3));

    res.status(200).json({
      totalEmitted: Number(totalEmitted.toFixed(3)),
      monthlyForecast,
      goal: user.monthlyGoal || 600,
      carbonSaved: Math.max(0, (user.monthlyGoal || 600) - totalEmitted),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
