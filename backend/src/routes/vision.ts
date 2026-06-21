import { Router, Response } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';
import { calculateEmissions } from './carbon';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini Client dynamically for testing/mock support
const getGenAI = () => {
  const key = process.env.GEMINI_API_KEY || '';
  return key ? new GoogleGenerativeAI(key) : null;
};

// Helper to convert buffer to Gemini vision format
const fileToGenerativePart = (buffer: Buffer, mimeType: string) => {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
};

/**
 * POST /api/v1/vision/scan-bill
 * Processes an uploaded electricity/gas bill image, extracts usage metrics, and awards 75 ECO tokens.
 */
router.post('/scan-bill', authMiddleware, upload.single('file'), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        requestId: req.id,
        error: { message: 'Image file upload is required.', status: 400 },
      });
    }

    let provider = 'NextEnergy';
    let quantity = 100.0;
    let unit = 'kWh';

    const genAI = getGenAI();
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const imgPart = fileToGenerativePart(file.buffer, file.mimetype);
        const prompt = `
          Analyze this utility bill image. Extract:
          1. Provider name (string)
          2. Quantity / Usage value (number only)
          3. Unit of measurement (e.g. kWh, units, therms)
          
          Respond ONLY with a JSON object in this format:
          {"provider": "Name", "quantity": 123.4, "unit": "kWh"}
        `;

        const result = await model.generateContent([prompt, imgPart]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          provider = parsed.provider || provider;
          quantity = Number(parsed.quantity) || quantity;
          unit = parsed.unit || unit;
        }
      } catch (err) {
        console.warn('[Gemini API] Failed to extract bill details, falling back to mock parser.', err);
      }
    } else {
      // Mock parser filename regex matching for local testing
      const filename = file.originalname.toLowerCase();
      if (filename.includes('gas')) {
        provider = 'CityGas';
        quantity = 250.0;
        unit = 'kWh';
      } else if (filename.includes('electric') || filename.includes('power')) {
        provider = 'NextEnergy';
        quantity = 100.0;
        unit = 'kWh';
      }
    }

    // Calculate emissions
    const carbonEmitted = calculateEmissions('energy', 'electricity', quantity);

    // Save carbon entry
    const entry = await prisma.carbonEntry.create({
      data: {
        userId,
        category: 'energy',
        type: 'electricity',
        value: quantity,
        unit,
        carbonEmitted,
        source: 'bill_ocr',
        automatic: true,
        metadata: JSON.stringify({ provider, originalName: file.originalname }),
      },
    });

    // Mint 75 EcoTokens for scan activity
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('')}`;

    const transaction = await prisma.tokenTransaction.create({
      data: {
        userId,
        action: 'bill_ocr',
        amountECO: 75,
        transactionHash: txHash,
      },
    });

    // Broadcast updates via WebSockets
    const io = req.app.get('io');
    if (io) {
      io.emit(`tokens:awarded:${userId}`, {
        amountECO: 75,
        action: 'bill_ocr',
        transactionHash: txHash,
      });
      io.emit(`carbon:updated:${userId}`, entry);
    }

    res.status(200).json({
      provider,
      quantity,
      unit,
      carbonEmitted,
      tokensAwarded: 75,
      entry,
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/vision/analyze-food
 * Analyzes a meal photo using Gemini to identify ingredients, portion weights, and CO2 values.
 */
router.post('/analyze-food', authMiddleware, upload.single('file'), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        requestId: req.id,
        error: { message: 'Meal photo file upload is required.', status: 400 },
      });
    }

    let foodItem = 'chicken with vegetables';
    let breakdown: { item: string; weightKg: number; emissions: number }[] = [
      { item: 'chicken', weightKg: 0.3, emissions: 2.07 }, // 0.3 * 6.9
      { item: 'vegetables', weightKg: 0.4, emissions: 0.8 }, // 0.4 * 2.0
    ];

    const genAI = getGenAI();
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const imgPart = fileToGenerativePart(file.buffer, file.mimetype);
        const prompt = `
          Analyze this meal photo. Identify ingredients and estimate their weight in kilograms.
          Using these emission factors (kg CO2 / kg product):
          - beef: 27.0
          - chicken: 6.9
          - vegetables / grains: 2.0
          - cheese / dairy: 13.5
          
          Respond ONLY with a JSON object in this format:
          {
            "foodItem": "burger with fries",
            "breakdown": [
              { "item": "beef", "weightKg": 0.2, "emissions": 5.4 },
              { "item": "vegetables", "weightKg": 0.15, "emissions": 0.3 }
            ]
          }
        `;

        const result = await model.generateContent([prompt, imgPart]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          foodItem = parsed.foodItem || foodItem;
          breakdown = parsed.breakdown || breakdown;
        }
      } catch (err) {
        console.warn('[Gemini API] Failed to analyze food, falling back to mock parser.', err);
      }
    } else {
      const filename = file.originalname.toLowerCase();
      if (filename.includes('burger') || filename.includes('beef')) {
        foodItem = 'beef burger with fries';
        breakdown = [
          { item: 'beef', weightKg: 0.25, emissions: 6.75 },
          { item: 'vegetables', weightKg: 0.15, emissions: 0.3 },
        ];
      }
    }

    const totalEmissions = Number(breakdown.reduce((sum, item) => sum + item.emissions, 0).toFixed(3));
    const totalWeight = Number(breakdown.reduce((sum, item) => sum + item.weightKg, 0).toFixed(3));

    // Save food entry to database
    const entry = await prisma.carbonEntry.create({
      data: {
        userId,
        category: 'food',
        type: foodItem,
        value: totalWeight,
        unit: 'kg',
        carbonEmitted: totalEmissions,
        source: 'food_camera',
        automatic: true,
        metadata: JSON.stringify({ breakdown }),
      },
    });

    // Broadcast updates
    const io = req.app.get('io');
    if (io) {
      io.emit(`carbon:updated:${userId}`, entry);
    }

    res.status(200).json({
      foodItem,
      breakdown,
      totalEmissions,
      entry,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
