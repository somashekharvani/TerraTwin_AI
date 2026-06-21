import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';

const router = Router();

// Zod validation schema for GPS coordinate log
const gpsPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number().positive(),
});

/**
 * Haversine formula to compute distance between two coordinates in kilometers.
 */
export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * POST /api/v1/track/location
 * Accepts a GPS point, calculates speed vs previous point, classifies mode, and logs trip.
 */
router.post('/location', authMiddleware, validateBody(gpsPointSchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { latitude, longitude, timestamp } = req.body;

    // Fetch latest geolocation entry to extract previous coordinates
    const lastGeoEntry = await prisma.carbonEntry.findFirst({
      where: { userId, source: 'geolocation' },
      orderBy: { createdAt: 'desc' },
    });

    // If no previous coordinate exists, log the start point of trip
    if (!lastGeoEntry || !lastGeoEntry.metadata) {
      const entry = await prisma.carbonEntry.create({
        data: {
          userId,
          category: 'transport',
          type: 'start_point',
          value: 0,
          unit: 'km',
          carbonEmitted: 0,
          source: 'geolocation',
          automatic: true,
          metadata: JSON.stringify({ latitude, longitude, timestamp }),
        },
      });
      return res.status(200).json({
        status: 'logged',
        commuteDetected: false,
        message: 'Initial coordinates logged. Waiting for movement.',
        entry,
      });
    }

    // Parse previous coordinate metadata
    const prevCoords = JSON.parse(lastGeoEntry.metadata);
    const prevLat = prevCoords.latitude;
    const prevLon = prevCoords.longitude;
    const prevTime = prevCoords.timestamp;

    // Calculate distance and time delta
    const distanceKm = haversine(prevLat, prevLon, latitude, longitude);
    const timeDeltaMs = timestamp - prevTime;
    const timeDeltaHrs = timeDeltaMs / 1000 / 3600;

    // Ignore coordinates if sent too quickly or no distance traveled
    if (timeDeltaMs <= 0 || distanceKm < 0.01) {
      return res.status(200).json({
        status: 'logged',
        commuteDetected: false,
        message: 'Time difference too short or displacement negligible.',
      });
    }

    // Calculate speed (km/h)
    const speed = distanceKm / timeDeltaHrs;

    // Classify transport mode based on speed limits
    let type = 'walking';
    let factor = 0.0;
    let tokensToAward = 0;
    let action = '';

    if (speed > 40) {
      type = 'car';
      factor = 0.21; // 0.21 kg CO2 / km
    } else if (speed >= 20 && speed <= 40) {
      type = 'bike';
      factor = 0.0; // 0 kg CO2
      tokensToAward = 50; // Award ECO tokens for biking
      action = 'walked_instead_of_car'; // Maps to walking/biking rewards
    } else if (speed >= 10 && speed < 20) {
      type = 'bus';
      factor = 0.11; // 0.11 kg CO2 / km
    } else {
      type = 'walking';
      factor = 0.0; // 0 kg CO2
      tokensToAward = 50;
      action = 'walked_instead_of_car';
    }

    const carbonEmitted = Number((distanceKm * factor).toFixed(3));

    // Save commute entry
    const entry = await prisma.carbonEntry.create({
      data: {
        userId,
        category: 'transport',
        type,
        value: Number(distanceKm.toFixed(3)),
        unit: 'km',
        carbonEmitted,
        source: 'geolocation',
        automatic: true,
        metadata: JSON.stringify({ latitude, longitude, timestamp }),
      },
    });

    // Award EcoTokens if eligible
    let transaction = null;
    if (tokensToAward > 0) {
      const txHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join('')}`;

      transaction = await prisma.tokenTransaction.create({
        data: {
          userId,
          action,
          amountECO: tokensToAward,
          transactionHash: txHash,
        },
      });

      const io = req.app.get('io');
      if (io) {
        io.emit(`tokens:awarded:${userId}`, {
          amountECO: tokensToAward,
          action,
          transactionHash: txHash,
        });
      }
    }

    // Broadcast WebSocket updates
    const io = req.app.get('io');
    if (io) {
      io.emit(`carbon:updated:${userId}`, entry);
    }

    res.status(200).json({
      status: 'logged',
      commuteDetected: true,
      distanceKm: Number(distanceKm.toFixed(3)),
      classifiedAs: type,
      speedKmH: Number(speed.toFixed(1)),
      carbonEmitted,
      tokensAwarded: tokensToAward,
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/track/commutes
 * Returns list of automatically detected trips.
 */
router.get('/commutes', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const commutes = await prisma.carbonEntry.findMany({
      where: {
        userId,
        source: 'geolocation',
        type: { not: 'start_point' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json(commutes);
  } catch (error) {
    next(error);
  }
});

export default router;
