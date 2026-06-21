import request from 'supertest';
import app from '../../src/server';
import { prisma } from '../../src/db';
import * as jwt from 'jsonwebtoken';

// Mock the Google Generative AI SDK to test genAI active code branches
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            generateContent: jest.fn().mockImplementation((args) => {
              const imgPart = args[1];
              // Trigger catch exception if buffer file content contains string "fail"
              if (
                imgPart?.inlineData?.data &&
                Buffer.from(imgPart.inlineData.data, 'base64').toString().includes('fail')
              ) {
                throw new Error('Mocked Gemini API Error');
              }
              return Promise.resolve({
                response: {
                  text: () =>
                    '{"provider": "NextEnergy", "quantity": 120, "unit": "kWh", "foodItem": "beef burger with fries", "breakdown": [{"item": "beef", "weightKg": 0.2, "emissions": 5.4}]}',
                },
              });
            }),
            startChat: jest.fn().mockImplementation(() => {
              return {
                sendMessage: jest.fn().mockImplementation((message: string) => {
                  if (message === 'fail') {
                    throw new Error('Mocked Gemini Chat Error');
                  }
                  return Promise.resolve({
                    response: {
                      text: () =>
                        'Your monthly carbon emissions are currently at 45.2 kg CO2. Looking at your records, your high electricity usage from the IoT Smart Meter is the primary driver. Turning off AC helps.',
                    },
                  });
                }),
              };
            }),
          };
        }),
      };
    }),
  };
});

beforeAll(async () => {
  // Clear any existing data in the test database to ensure isolations
  await prisma.tokenTransaction.deleteMany();
  await prisma.carbonEntry.deleteMany();
  await prisma.user.deleteMany();

  // Set mock socket.io on the app to cover WebSockets update branches
  app.set('io', {
    emit: jest.fn(),
  });
});

afterAll(async () => {
  delete process.env.GEMINI_API_KEY;
  // Gracefully release Prisma client database handles
  await prisma.$disconnect();
});

describe('TerraTwin AI API Integrations - Comprehensive Suite', () => {
  let token: string;
  let userId: string;
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test Advocate',
  };

  test('GET /api/v1/health returns server status and DB connection', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database', 'connected');
  });

  test('GET /api/v1/docs returns HTML API Explorer', async () => {
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  test('POST /api/v1/auth/register registers user and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', testUser.email);
    token = res.body.token;
    userId = res.body.user.id;
  });

  test('POST /api/v1/auth/register returns 409 conflict on duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.error).toHaveProperty('message');
  });

  test('POST /api/v1/auth/register returns 400 bad request on empty payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('details');
  });

  test('POST /api/v1/auth/login validates credentials and logs in user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/v1/auth/login returns 401 on incorrect credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
  });

  test('GET /api/v1/auth/me returns current user profile details', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', testUser.email);
    expect(res.body).toHaveProperty('name', testUser.name);
  });

  test('GET /api/v1/auth/me returns 401 when token is missing', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/auth/me returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/auth/login dynamically seeds and logs in demo user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@terratwin.ai',
        password: 'demo123',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'demo@terratwin.ai');
    
    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@terratwin.ai',
        password: 'demo123',
      });
    expect(res2.status).toBe(200);
  });

  test('GET /api/v1/auth/me restores demo user session if missing from DB', async () => {
    const demoToken = jwt.sign(
      { id: 'cmqn7tjnj0000h6759cg993i1', email: 'demo@terratwin.ai' },
      process.env.JWT_SECRET || 'test-secret-at-least-32-chars-long',
      { expiresIn: '7d' }
    );

    await prisma.user.delete({ where: { email: 'demo@terratwin.ai' } });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'demo@terratwin.ai');
    expect(res.body).toHaveProperty('id', 'cmqn7tjnj0000h6759cg993i1');
  });

  test('POST /api/v1/carbon/entries creates new manual carbon log', async () => {
    const res = await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'transport',
        type: 'car',
        value: 50,
        unit: 'km',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('carbonEmitted', 10.5); // 50 * 0.21
    expect(res.body).toHaveProperty('source', 'manual');
  });

  test('GET /api/v1/carbon/entries retrieves paginated user carbon entries', async () => {
    const res = await request(app)
      .get('/api/v1/carbon/entries?limit=10&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.count).toBe(1);
  });

  test('GET /api/v1/carbon/analytics/daily returns last 7 days daily stats', async () => {
    const res = await request(app)
      .get('/api/v1/carbon/analytics/daily')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(7);
  });

  test('GET /api/v1/carbon/analytics/monthly returns progress against goal', async () => {
    const res = await request(app)
      .get('/api/v1/carbon/analytics/monthly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalEmitted');
    expect(res.body).toHaveProperty('goal', 600);
  });

  test('GET /api/v1/carbon/prediction returns monthly projection forecasts', async () => {
    const res = await request(app)
      .get('/api/v1/carbon/prediction')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('monthlyForecast');
    expect(res.body).toHaveProperty('status');
  });

  // --- SECTION A: Local Offline / Mock Rules Branches (No GEMINI_API_KEY) ---

  test('POST /api/v1/vision/scan-bill parses electrical bill offline rule', async () => {
    const res = await request(app)
      .post('/api/v1/vision/scan-bill')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('mock electric bill'), 'electric.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'NextEnergy');
    expect(res.body).toHaveProperty('quantity', 100);
  });

  test('POST /api/v1/vision/scan-bill parses gas bill offline rule', async () => {
    const res = await request(app)
      .post('/api/v1/vision/scan-bill')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('mock gas bill'), 'gas.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'CityGas');
    expect(res.body).toHaveProperty('quantity', 250);
  });

  test('POST /api/v1/vision/analyze-food recognizes beef burger offline rule', async () => {
    const res = await request(app)
      .post('/api/v1/vision/analyze-food')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('mock beef burger photo'), 'burger.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('foodItem', 'beef burger with fries');
    expect(res.body.breakdown[0]).toHaveProperty('item', 'beef');
  });

  test('POST /api/v1/agent/chat returns offline mock advisor advice', async () => {
    const res = await request(app)
      .post('/api/v1/agent/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Why is my carbon footprint high?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('electricity');
  });

  test('POST /api/v1/agent/chat returns offline token reward instructions', async () => {
    const res = await request(app)
      .post('/api/v1/agent/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'tell me about eco tokens' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('EcoTokens');
  });

  // --- SECTION B: Live API Branches (GEMINI_API_KEY Active via Jest Mock) ---

  test('Enable GEMINI_API_KEY environment variable', () => {
    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test-coverage-boost';
    expect(process.env.GEMINI_API_KEY).toBe('fake-gemini-key-for-test-coverage-boost');
  });

  test('POST /api/v1/vision/scan-bill parses bill OCR via genAI mock', async () => {
    const res = await request(app)
      .post('/api/v1/vision/scan-bill')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('mock electric bill'), 'electric.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'NextEnergy');
    expect(res.body).toHaveProperty('quantity', 120); // mocked genAI value
    expect(res.body).toHaveProperty('tokensAwarded', 75);
  });

  test('POST /api/v1/vision/scan-bill triggers catch exception recovery on failure', async () => {
    const res = await request(app)
      .post('/api/v1/vision/scan-bill')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fail-trigger'), 'electric-fail.jpg'); // includes "fail" in filename/buffer

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'NextEnergy'); // falls back to mock NextEnergy
    expect(res.body).toHaveProperty('quantity', 100); // mock NextEnergy quantity
  });

  test('POST /api/v1/vision/scan-bill returns 400 when file is missing', async () => {
    const res = await request(app)
      .post('/api/v1/vision/scan-bill')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/vision/analyze-food recognizes meal food composition via genAI mock', async () => {
    const res = await request(app)
      .post('/api/v1/vision/analyze-food')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('mock beef burger photo'), 'burger.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('foodItem', 'beef burger with fries');
    expect(res.body.breakdown[0]).toHaveProperty('item', 'beef');
    expect(res.body.totalEmissions).toBe(5.4); // mocked genAI value
  });

  test('POST /api/v1/vision/analyze-food triggers catch exception recovery on failure', async () => {
    const res = await request(app)
      .post('/api/v1/vision/analyze-food')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fail-trigger'), 'burger-fail.jpg');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('foodItem', 'chicken with vegetables'); // falls back to default local chicken mock
  });

  test('POST /api/v1/vision/analyze-food returns 400 when file is missing', async () => {
    const res = await request(app)
      .post('/api/v1/vision/analyze-food')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/agent/chat returns carbon reduction advice suggestions via genAI mock', async () => {
    const res = await request(app)
      .post('/api/v1/agent/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Why is my carbon footprint high?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply).toContain('AC');
  });

  test('POST /api/v1/agent/chat triggers catch exception recovery on failure', async () => {
    const res = await request(app)
      .post('/api/v1/agent/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'fail' }); // triggers mock throw

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply).toContain('carbon advisor'); // falls back to mock responder
  });

  // --- SECTION C: Geolocation commutes and IoT smart meter tests ---

  test('POST /api/v1/track/location logs initial GPS coordinate', async () => {
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: 500000,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'logged');
    expect(res.body).toHaveProperty('commuteDetected', false);
  });

  test('POST /api/v1/track/location ignores coordinate if sent too quickly', async () => {
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: 500000, // same timestamp
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'logged');
    expect(res.body).toHaveProperty('commuteDetected', false);
    expect(res.body.message).toContain('Time difference too short');
  });

  test('POST /api/v1/track/location detects high speed car commutes on movement', async () => {
    // NYC to Midtown NYC displacement (5.3km) in 10 seconds -> High Speed (Car)
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.758,
        longitude: -73.9855,
        timestamp: 510000, // 10s difference
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'logged');
    expect(res.body).toHaveProperty('commuteDetected', true);
    expect(res.body).toHaveProperty('classifiedAs', 'car');
  });

  test('POST /api/v1/track/location ignores displacement < 0.01 km', async () => {
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.75801, // negligible shift
        longitude: -73.98551,
        timestamp: 520000,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('displacement negligible');
  });

  test('POST /api/v1/track/location detects cycling commute & awards 50 tokens', async () => {
    // 0.56 km displacement in 60 seconds -> ~33.6 km/h -> Cycling speed (20-40)
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.762,
        longitude: -73.9895,
        timestamp: 570000, // 60s difference
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('classifiedAs', 'bike');
    expect(res.body.tokensAwarded).toBe(50);
  });

  test('POST /api/v1/track/location detects bus speed classification (10-20 km/h)', async () => {
    // 0.22 km in 60 seconds -> 13.2 km/h -> Bus speed
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.764,
        longitude: -73.991,
        timestamp: 630000, // 60s difference
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('classifiedAs', 'bus');
    expect(res.body.tokensAwarded).toBe(0);
  });

  test('POST /api/v1/track/location detects walking speed & awards 50 tokens', async () => {
    // 0.05 km in 120 seconds -> 1.5 km/h -> Walking speed (<10)
    const res = await request(app)
      .post('/api/v1/track/location')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 40.7641,
        longitude: -73.9915,
        timestamp: 750000, // 120s difference
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('classifiedAs', 'walking');
    expect(res.body.tokensAwarded).toBe(50);
  });

  test('GET /api/v1/track/commutes lists GPS detected commutes', async () => {
    const res = await request(app)
      .get('/api/v1/track/commutes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/devices/sync logs smart meter watts and updates live status', async () => {
    const res = await request(app)
      .post('/api/v1/devices/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        watts: 720,
        devices: { lights: 154, ac: 0, fridge: 255, media: 311 },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'synced');
  });

  test('GET /api/v1/devices/energy/live retrieves latest synced smart meter readings', async () => {
    const res = await request(app)
      .get('/api/v1/devices/energy/live')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('watts', 720);
    expect(res.body.devices).toHaveProperty('lights', 154);
  });

  test('GET /api/v1/devices/energy/live returns empty schema for users with no IoT data', async () => {
    // Create new temporary user with no smart meter logs
    const tempReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'tempuser@example.com',
        password: 'password123',
        name: 'Temporary User',
      });
    const tempToken = tempReg.body.token;

    const res = await request(app)
      .get('/api/v1/devices/energy/live')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('watts', 0);
    expect(res.body.devices).toHaveProperty('lights', 0);
  });

  test('GET /api/v1/tokens/balance returns EcoToken balance and Seed NFT tier', async () => {
    const res = await request(app)
      .get('/api/v1/tokens/balance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balanceECO', 400); // 150 (offline scans) + 150 (genAI scans) + 100 (commutes) = 400 ECO
    expect(res.body).toHaveProperty('nftTier', '🌳 Tree');
  });

  test('GET /api/v1/tokens/leaderboard lists user standings', async () => {
    const res = await request(app)
      .get('/api/v1/tokens/leaderboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Standings should show the top user first
    expect(res.body.some((u: any) => u.name === testUser.name && u.balanceECO === 400)).toBe(true);
  });

  test('GET /api/v1/test-error returns 500 triggered server error', async () => {
    const res = await request(app).get('/api/v1/test-error');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('requestId');
    expect(res.body.error).toHaveProperty('message', 'Triggered server error');
  });

  test('errorHandler production logging branch test', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/api/v1/test-error');
    expect(res.status).toBe(500);

    process.env.NODE_ENV = originalEnv;
  });

  // --- SECTION D: Digital Carbon Twin Profile & AI Carbon Story ---

  test('GET /api/v1/twin/profile returns 401 when unauthorized', async () => {
    const res = await request(app).get('/api/v1/twin/profile');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/twin/profile returns 200 with Sustainability Champion persona for 0 emissions', async () => {
    const championReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'champion@example.com',
        password: 'password123',
        name: 'Eco Champion',
      });
    const championToken = championReg.body.token;

    const res = await request(app)
      .get('/api/v1/twin/profile')
      .set('Authorization', `Bearer ${championToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score', 100);
    expect(res.body).toHaveProperty('persona', 'Sustainability Champion');
    expect(res.body).toHaveProperty('risk', 'Low');
    expect(res.body).toHaveProperty('monthlyFootprint', 0);
  });

  test('GET /api/v1/twin/profile returns 200 and Green Crusader persona for intermediate emissions', async () => {
    const crusaderReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'crusader@example.com',
        password: 'password123',
        name: 'Eco Crusader',
      });
    const crusaderToken = crusaderReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${crusaderToken}`)
      .send({
        category: 'energy',
        type: 'electricity',
        value: 180 / 0.233,
        unit: 'kWh',
      });

    const res = await request(app)
      .get('/api/v1/twin/profile')
      .set('Authorization', `Bearer ${crusaderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(70);
    expect(res.body.score).toBeLessThan(85);
    expect(res.body.persona).toBe('Green Crusader');
    expect(res.body.risk).toBe('Low');
  });

  test('GET /api/v1/twin/profile returns 200 and Eco Explorer persona for moderate emissions', async () => {
    const explorerReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'explorer@example.com',
        password: 'password123',
        name: 'Eco Explorer',
      });
    const explorerToken = explorerReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${explorerToken}`)
      .send({
        category: 'energy',
        type: 'electricity',
        value: 360 / 0.233,
        unit: 'kWh',
      });

    const res = await request(app)
      .get('/api/v1/twin/profile')
      .set('Authorization', `Bearer ${explorerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(50);
    expect(res.body.score).toBeLessThan(70);
    expect(res.body.persona).toBe('Eco Explorer');
    expect(res.body.risk).toBe('Moderate');
  });

  test('GET /api/v1/twin/profile returns 200 and Carbon Conscious persona for high emissions', async () => {
    const consciousReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'conscious@example.com',
        password: 'password123',
        name: 'Carbon Conscious User',
      });
    const consciousToken = consciousReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${consciousToken}`)
      .send({
        category: 'energy',
        type: 'electricity',
        value: 720 / 0.233,
        unit: 'kWh',
      });

    const res = await request(app)
      .get('/api/v1/twin/profile')
      .set('Authorization', `Bearer ${consciousToken}`);

    expect(res.status).toBe(200);
    expect(res.body.score).toBeLessThan(50);
    expect(res.body.persona).toBe('Carbon Conscious');
    expect(res.body.risk).toBe('High');
  });

  test('GET /api/v1/agent/story returns 401 when unauthorized', async () => {
    const res = await request(app).get('/api/v1/agent/story');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/agent/story returns 200 and uses Gemini API mock when key is set', async () => {
    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test-coverage-boost';

    const res = await request(app)
      .get('/api/v1/agent/story')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('story');
    expect(res.body.story).toContain('NextEnergy');
  });

  test('GET /api/v1/agent/story fallback: transport-heavy story', async () => {
    delete process.env.GEMINI_API_KEY;

    const transportReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'transportstory@example.com',
        password: 'password123',
        name: 'Transport Story User',
      });
    const transportToken = transportReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${transportToken}`)
      .send({
        category: 'transport',
        type: 'car',
        value: 500,
        unit: 'km',
      });
    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${transportToken}`)
      .send({
        category: 'food',
        type: 'vegetables',
        value: 1,
        unit: 'kg',
      });

    const res = await request(app)
      .get('/api/v1/agent/story')
      .set('Authorization', `Bearer ${transportToken}`);

    expect(res.status).toBe(200);
    expect(res.body.story).toContain('Transportation is your highest contributor');
  });

  test('GET /api/v1/agent/story fallback: food-heavy story', async () => {
    delete process.env.GEMINI_API_KEY;

    const foodReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'foodstory@example.com',
        password: 'password123',
        name: 'Food Story User',
      });
    const foodToken = foodReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${foodToken}`)
      .send({
        category: 'food',
        type: 'beef',
        value: 10,
        unit: 'kg',
      });

    const res = await request(app)
      .get('/api/v1/agent/story')
      .set('Authorization', `Bearer ${foodToken}`);

    expect(res.status).toBe(200);
    expect(res.body.story).toContain('Your diet is driving your emissions');
  });

  test('GET /api/v1/agent/story fallback: energy-heavy story', async () => {
    delete process.env.GEMINI_API_KEY;

    const energyReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'energystory@example.com',
        password: 'password123',
        name: 'Energy Story User',
      });
    const energyToken = energyReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${energyToken}`)
      .send({
        category: 'energy',
        type: 'electricity',
        value: 1000,
        unit: 'kWh',
      });

    const res = await request(app)
      .get('/api/v1/agent/story')
      .set('Authorization', `Bearer ${energyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.story).toContain('Energy use in your household is above average');
  });

  test('GET /api/v1/agent/story fallback: even distribution story', async () => {
    delete process.env.GEMINI_API_KEY;

    const evenReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'evenstory@example.com',
        password: 'password123',
        name: 'Even Story User',
      });
    const evenToken = evenReg.body.token;

    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${evenToken}`)
      .send({
        category: 'transport',
        type: 'car',
        value: 100,
        unit: 'km',
      });
    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${evenToken}`)
      .send({
        category: 'food',
        type: 'beef',
        value: 1,
        unit: 'kg',
      });
    await request(app)
      .post('/api/v1/carbon/entries')
      .set('Authorization', `Bearer ${evenToken}`)
      .send({
        category: 'energy',
        type: 'electricity',
        value: 100,
        unit: 'kWh',
      });

    const res = await request(app)
      .get('/api/v1/agent/story')
      .set('Authorization', `Bearer ${evenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.story).toContain('Your footprint is distributed evenly');
  });

  // --- SECTION E: Auth Extra Corner Cases ---

  test('POST /api/v1/auth/login returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'doesnotexist@example.com',
        password: 'password123',
      });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/auth/me returns 404 if user was deleted from DB', async () => {
    const tempReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'deleteduser@example.com',
        password: 'password123',
        name: 'Soon To Be Deleted',
      });
    const tempToken = tempReg.body.token;
    const tempUserId = tempReg.body.user.id;

    await prisma.user.delete({ where: { id: tempUserId } });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(res.status).toBe(404);
  });
});
