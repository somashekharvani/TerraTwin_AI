import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();

/**
 * Helper to determine NFT evolution tier based on cumulative carbon footprint.
 */
export const getNFTEvolutionTier = (totalCarbon: number): string => {
  if (totalCarbon <= 50) return '🌱 Seed';
  if (totalCarbon <= 150) return '🌿 Sprout';
  if (totalCarbon <= 300) return '🌳 Tree';
  if (totalCarbon <= 500) return '🌲 Forest';
  if (totalCarbon <= 750) return '🦁 Wildlife';
  return '🌍 Ecosystem';
};

/**
 * GET /api/v1/tokens/balance
 * Returns the user's total EcoToken (ECO) balance and current NFT evolution tier.
 */
router.get('/balance', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Sum all token transactions
    const aggregate = await prisma.tokenTransaction.aggregate({
      where: { userId },
      _sum: { amountECO: true },
    });

    const balanceECO = aggregate._sum.amountECO || 0;

    // Get total cumulative carbon emitted by user
    const carbonAggregate = await prisma.carbonEntry.aggregate({
      where: { userId },
      _sum: { carbonEmitted: true },
    });

    const totalCarbon = carbonAggregate._sum.carbonEmitted || 0;
    const nftTier = getNFTEvolutionTier(totalCarbon);

    res.status(200).json({
      balanceECO,
      totalCarbonEmitted: Number(totalCarbon.toFixed(3)),
      nftTier,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tokens/leaderboard
 * Returns the top 50 users based on total EcoToken (ECO) accumulation.
 */
router.get('/leaderboard', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    // Retrieve users and sum their transactions
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        walletAddress: true,
        tokenTxns: {
          select: { amountECO: true },
        },
      },
    });

    // Compute balance for each user
    const leaderboard = users
      .map((user) => {
        const balance = user.tokenTxns.reduce((sum, tx) => sum + tx.amountECO, 0);
        return {
          id: user.id,
          name: user.name,
          walletAddress: user.walletAddress || 'Not Connected',
          balanceECO: balance,
        };
      })
      .sort((a, b) => b.balanceECO - a.balanceECO)
      .slice(0, 50); // Get top 50

    res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
});

export default router;
