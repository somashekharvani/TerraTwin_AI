import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();

/**
 * GET /api/v1/twin/profile
 * Analyzes carbon history and generates the user's Carbon Digital Twin Profile.
 */
router.get('/profile', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Fetch user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, monthlyGoal: true },
    });

    const goal = user?.monthlyGoal || 600;

    // Calculate current month's emissions
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonthEntries = await prisma.carbonEntry.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
    });

    const totalEmitted = thisMonthEntries.reduce((sum, e) => sum + e.carbonEmitted, 0);

    // Calculate Sustainability Score (0-100)
    // Scale: 0 emissions = 100 score, exceeding goal * 1.5 = 0 score
    const targetScale = goal * 1.5;
    const score = Math.max(0, Math.min(100, Math.round(100 - (totalEmitted / targetScale) * 100)));

    // Classify Carbon Twin Persona
    let persona = 'Eco Explorer';
    if (score >= 85) {
      persona = 'Sustainability Champion';
    } else if (score >= 70) {
      persona = 'Green Crusader';
    } else if (score >= 50) {
      persona = 'Eco Explorer';
    } else {
      persona = 'Carbon Conscious';
    }

    // Projections and stats
    const annualFootprint = Number(((totalEmitted * 12) / 1000).toFixed(2)); // in metric tonnes
    const risk = score >= 80 ? 'Low' : score >= 55 ? 'Moderate' : 'High';
    const potentialReduction = Math.max(5, Math.round(totalEmitted > 0 ? 18 : 15)); // percentage

    res.status(200).json({
      score,
      persona,
      monthlyFootprint: Number(totalEmitted.toFixed(1)),
      annualFootprint,
      risk,
      potentialReduction,
      goal,
      goalProgress: Number(Math.min(100, (totalEmitted / goal) * 100).toFixed(0)),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
