import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();

// Zod validation for device synchronization payload
const deviceSyncSchema = z.object({
  watts: z.number().nonnegative('Watts must be a non-negative number.'),
  devices: z.object({
    lights: z.number().nonnegative(),
    ac: z.number().nonnegative(),
    fridge: z.number().nonnegative(),
    media: z.number().nonnegative(),
  }),
});

/**
 * POST /api/v1/devices/sync
 * Syncs current smart meter readings, computes carbon emissions, and logs to database.
 */
router.post('/sync', authMiddleware, validateBody(deviceSyncSchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { watts, devices } = req.body;

    // Convert Watts to kWh for a 10-second sampling interval (10 / 3600 hours)
    const hours = 10 / 3600;
    const kwh = (watts * hours) / 1000;
    const carbonEmitted = Number((kwh * 0.233).toFixed(6)); // electricity factor

    // Log the energy consumption block in the DB
    const entry = await prisma.carbonEntry.create({
      data: {
        userId,
        category: 'energy',
        type: 'electricity',
        value: Number(kwh.toFixed(6)),
        unit: 'kWh',
        carbonEmitted,
        source: 'iot',
        automatic: true,
        metadata: JSON.stringify({ watts, devices }),
      },
    });

    // Broadcast live WebSocket update containing current power load & device breakdown
    const io = req.app.get('io');
    if (io) {
      io.emit(`iot:power:updated:${userId}`, {
        watts,
        devices,
        timestamp: new Date().toISOString(),
      });

      // Notify general carbon updates
      io.emit(`carbon:updated:${userId}`, entry);
    }

    res.status(200).json({
      status: 'synced',
      carbonEmitted,
      entry,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/devices/energy/live
 * Fetches the latest live smart meter telemetry for the user dashboard.
 */
router.get('/energy/live', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Retrieve the most recent smart meter sync log
    const lastIotLog = await prisma.carbonEntry.findFirst({
      where: { userId, source: 'iot' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastIotLog || !lastIotLog.metadata) {
      return res.status(200).json({
        watts: 0,
        devices: { lights: 0, ac: 0, fridge: 0, media: 0 },
      });
    }

    const payload = JSON.parse(lastIotLog.metadata);
    res.status(200).json({
      watts: payload.watts,
      devices: payload.devices,
      timestamp: lastIotLog.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
