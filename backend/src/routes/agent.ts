import { Router, Response } from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { RequestWithId } from '../middleware/logger';
import { validateBody } from '../middleware/validation';

const router = Router();

// Zod schema for incoming chat message
const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

// Initialize Gemini dynamically
const getGenAI = () => {
  const key = process.env.GEMINI_API_KEY || '';
  return key ? new GoogleGenerativeAI(key) : null;
};

/**
 * POST /api/v1/agent/chat
 * Streams or returns recommendations from the LangChain/Gemini carbon agent.
 */
router.post('/chat', authMiddleware, validateBody(chatMessageSchema), async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body;

    // Fetch user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, monthlyGoal: true },
    });

    // Fetch user's carbon entry stats for context
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonthEntries = await prisma.carbonEntry.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
    });

    const totalEmitted = thisMonthEntries.reduce((sum, e) => sum + e.carbonEmitted, 0);

    // Fetch last 5 carbon entries
    const recentEntries = await prisma.carbonEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Construct Context System Prompt
    const systemPrompt = `
      You are Antigravity-Carbon, a pro-active AI assistant for TerraTwin AI carbon tracker.
      You help users lower their carbon footprint.
      
      User Profile Context:
      - Name: ${user?.name || 'User'}
      - Monthly Carbon Goal: ${user?.monthlyGoal || 600} kg CO2
      - Emitted this month so far: ${totalEmitted.toFixed(2)} kg CO2
      
      Recent Carbon Logs (last 5 entries):
      ${recentEntries
        .map(
          (e) =>
            `- [${e.createdAt.toISOString().split('T')[0]}] ${e.category} (${e.type}): ${e.value} ${e.unit} -> ${e.carbonEmitted} kg CO2`,
        )
        .join('\n')}
      
      Instructions:
      - You have access to: household electricity [data], active trips [data], past conversations [memory].
      - Provide practical, data-driven advice. Reference their actual data (e.g. mention their AC, beef intake, or car trips if visible in their logs).
      - Keep responses friendly, encouraging, and under 150 words.
    `;

    let reply = '';

    const genAI = getGenAI();
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const chatSession = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }],
            },
            {
              role: 'model',
              parts: [{ text: 'Understood. I will act as a helpful carbon coach using this context.' }],
            },
          ],
        });

        const result = await chatSession.sendMessage(message);
        reply = result.response.text();
      } catch (err) {
        console.error('[Gemini API] Chat generation failed, falling back to mock reply.', err);
        reply = generateMockReply(message, totalEmitted, user?.monthlyGoal || 600);
      }
    } else {
      reply = generateMockReply(message, totalEmitted, user?.monthlyGoal || 600);
    }

    res.status(200).json({
      reply,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Custom rule-based mock chat responder for local testing
 */
function generateMockReply(message: string, totalEmitted: number, goal: number): string {
  const msg = message.toLowerCase();

  if (msg.includes('why') && (msg.includes('high') || msg.includes('carbon'))) {
    return `Your monthly carbon emissions are currently at ${totalEmitted.toFixed(1)} kg CO2 against a target of ${goal} kg. Looking at your records, your high electricity usage from the IoT Smart Meter is the primary driver. Try lowering your AC usage or turning off appliances in standby mode to save energy.`;
  }

  if (msg.includes('token') || msg.includes('eco')) {
    return `You can earn EcoTokens (ECO) by walking or cycling instead of driving, completing OCR scans of utility bills (75 ECO), or meeting your monthly target (500 ECO). Check the blockchain leaderboard to see your rank!`;
  }

  return `Hello! I'm your TerraTwin AI carbon advisor. So far this month, you've recorded ${totalEmitted.toFixed(1)} kg of CO2. Let me know if you want tips on reducing transport emissions or optimizing your home energy!`;
}

/**
 * GET /api/v1/agent/story
 * Generates an AI-driven or template-driven narrative of carbon footprint habits.
 */
router.get('/story', authMiddleware, async (req: RequestWithId, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Fetch user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, monthlyGoal: true },
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const entries = await prisma.carbonEntry.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
    });

    const transportEmitted = entries.filter(e => e.category === 'transport').reduce((sum, e) => sum + e.carbonEmitted, 0);
    const foodEmitted = entries.filter(e => e.category === 'food').reduce((sum, e) => sum + e.carbonEmitted, 0);
    const energyEmitted = entries.filter(e => e.category === 'energy').reduce((sum, e) => sum + e.carbonEmitted, 0);
    const totalEmitted = transportEmitted + foodEmitted + energyEmitted;

    const goal = user?.monthlyGoal || 600;

    let story = '';
    const genAI = getGenAI();

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const systemPrompt = `
          You are the Carbon Storyteller for TerraTwin AI.
          Translate raw numbers into an encouraging, readable sustainability story.
          
          Metrics for user ${user?.name || 'User'}:
          - Target Goal: ${goal} kg CO2
          - Emitted so far: ${totalEmitted.toFixed(1)} kg CO2
          - Transport source emissions: ${transportEmitted.toFixed(1)} kg CO2
          - Energy source emissions: ${energyEmitted.toFixed(1)} kg CO2
          - Food source emissions: ${foodEmitted.toFixed(1)} kg CO2
          
          Include percentages, comparisons, and actionable insights. Format in clean markdown without HTML tags. Keep it under 150 words.
        `;
        const result = await model.generateContent(systemPrompt);
        story = result.response.text();
      } catch (err) {
        story = generateFallbackStory(user?.name || 'User', transportEmitted, foodEmitted, energyEmitted, totalEmitted, goal);
      }
    } else {
      story = generateFallbackStory(user?.name || 'User', transportEmitted, foodEmitted, energyEmitted, totalEmitted, goal);
    }

    res.status(200).json({ story });
  } catch (error) {
    next(error);
  }
});

function generateFallbackStory(name: string, transport: number, food: number, energy: number, total: number, goal: number): string {
  const transportPct = total > 0 ? Math.round((transport / total) * 100) : 0;
  const foodPct = total > 0 ? Math.round((food / total) * 100) : 0;
  const energyPct = total > 0 ? Math.round((energy / total) * 100) : 0;

  let advice = '';
  if (transportPct > 40) {
    advice = 'Transportation is your highest contributor. Replacing two weekly car commutes with bicycling or public transit would save approximately 32kg CO₂/month.';
  } else if (foodPct > 40) {
    advice = 'Your diet is driving your emissions. Reducing beef or lamb intake by half and substituting with plant-based alternatives could reduce your food footprint by up to 25%.';
  } else if (energyPct > 40) {
    advice = 'Energy use in your household is above average. Try lowering your air conditioner usage by 2°C or switching off standby devices to save up to 45 kWh monthly.';
  } else {
    advice = 'Your footprint is distributed evenly. Improving thermostat efficiency and batching vehicle trips are great ways to reduce your overall emissions.';
  }

  return `Hello **${name}**! Here is your Carbon Story for this month. 

You have emitted **${total.toFixed(1)} kg CO₂** against your target goal of **${goal} kg CO₂**. 

### 📊 Emissions Breakdown:
* **Transport**: ${transport.toFixed(1)} kg CO₂ (${transportPct}%)
* **Food**: ${food.toFixed(1)} kg CO₂ (${foodPct}%)
* **Energy**: ${energy.toFixed(1)} kg CO₂ (${energyPct}%)

### 💡 Reduction Strategy:
${advice}

*Keep up the great work on your green journey!*`;
}

export default router;
