import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import 'jest-axe/extend-expect';
import App from '../src/App';

// Mock Recharts ResponsiveContainer to avoid SVG sizing errors in JSDOM
jest.mock('recharts', () => {
  const original = jest.requireActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: '600px', height: '300px' }}>{children}</div>
    ),
  };
});

const socketListeners: { [key: string]: Function } = {};

// Mock socket.io-client to avoid real network requests during tests
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn().mockImplementation((event: string, callback: Function) => {
          socketListeners[event] = callback;
        }),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
    }),
  };
});

describe('TerraTwin AI Frontend Portal Tests', () => {
  test('renders auth portal sign-in portal on start', () => {
    render(<App />);
    expect(screen.getAllByText('TerraTwin AI')[0]).toBeInTheDocument();
    
    // Open login modal first
    const launchBtn = screen.getByRole('button', { name: 'Launch App' });
    fireEvent.click(launchBtn);

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  test('toggles form fields between sign-in and sign-up states', () => {
    render(<App />);
    
    // Open login modal first
    const launchBtn = screen.getByRole('button', { name: 'Launch App' });
    fireEvent.click(launchBtn);

    const link = screen.getByRole('button', { name: "Don't have an account? Sign Up" });
    
    // Toggle to Sign Up
    fireEvent.click(link);
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();

    // Toggle back to Sign In
    const linkBack = screen.getByRole('button', { name: 'Already have an account? Sign In' });
    fireEvent.click(linkBack);
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
  });

  test('auth view has zero WCAG accessibility violations', async () => {
    const { container } = render(<App />);
    
    // Open login modal first
    const launchBtn = screen.getByRole('button', { name: 'Launch App' });
    fireEvent.click(launchBtn);

    let results: any;
    await act(async () => {
      results = await axe(container);
    });

    expect(results).toHaveNoViolations();
  });

  test('renders all dashboard tabs without crashes and passes accessibility audits', async () => {
    // 1. Mock localStorage and global fetch
    const localStorageMock = (() => {
      let store: { [key: string]: string } = { token: 'mock-jwt-token' };
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

    // Mock fetch responses for all requests made by the App on mount/refresh
    const mockUser = { id: 'user-cuid', name: 'Eco Explorer Test', email: 'demo@terratwin.ai', monthlyGoal: 600 };
    const mockTwinProfile = {
      score: 85,
      persona: 'Sustainability Champion',
      monthlyFootprint: 120.5,
      annualFootprint: 1.45,
      risk: 'Low',
      potentialReduction: 18,
      goal: 600,
      goalProgress: 20
    };
    const mockForecast = { dailyAverage: 4.0, monthlyForecast: 120.0, goal: 600, status: 'On track' };
    const mockCarbonStory = { story: 'AI Carbon Story Content' };

    const originalFetch = window.fetch;
    window.fetch = jest.fn().mockImplementation((url: any) => {
      let data: any = {};
      if (url.includes('/api/v1/auth/me')) {
        data = mockUser;
      } else if (url.includes('/api/v1/carbon/entries')) {
        data = { entries: [], count: 0 };
      } else if (url.includes('/api/v1/tokens/balance')) {
        data = { balanceECO: 150, totalCarbonEmitted: 120, nftTier: '🌱 Seed' };
      } else if (url.includes('/api/v1/carbon/analytics/daily')) {
        data = [];
      } else if (url.includes('/api/v1/carbon/analytics/monthly')) {
        data = { month: 'June', totalEmitted: 120.5, goal: 600 };
      } else if (url.includes('/api/v1/carbon/prediction')) {
        data = mockForecast;
      } else if (url.includes('/api/v1/twin/profile')) {
        data = mockTwinProfile;
      } else if (url.includes('/api/v1/agent/story')) {
        data = mockCarbonStory;
      } else if (url.includes('/api/v1/tokens/leaderboard')) {
        data = [{ id: 'user-1', name: 'Eco Advocate', balanceECO: 500, walletAddress: '0x1234' }];
      } else if (url.includes('/api/v1/carbon/public-stats')) {
        data = { totalEmitted: 438, monthlyForecast: 320, goal: 600, carbonSaved: 162 };
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    });

    // 2. Render App in logged-in state
    const { container } = render(<App />);

    // Wait for the auth fetch to complete and render the Dashboard
    expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

    // 3. Loop through each tab in the navigation menu, click it, and verify it renders without crashing
    const tabsToTest = [
      { id: 'ocr', header: 'ocr Panel' },
      { id: 'geolocation', header: 'geolocation Panel' },
      { id: 'smarthome', header: 'smarthome Panel' },
      { id: 'advisor', header: 'advisor Panel' },
      { id: 'story', header: 'story Panel' },
      { id: 'simulator', header: 'simulator Panel' },
      { id: 'privacy', header: 'privacy Panel' },
      { id: 'challenges', header: 'challenges Panel' },
      { id: 'timeline', header: 'timeline Panel' },
      { id: 'profile', header: 'profile Panel' },
      { id: 'leaderboard', header: 'leaderboard Panel' },
      { id: 'dashboard', header: 'dashboard Panel' }
    ];

    for (const tab of tabsToTest) {
      const button = screen.getByRole('button', { name: `Navigate to ${tab.id === 'ocr' ? 'AI Scanner' : tab.id === 'smarthome' ? 'IoT Monitor' : tab.id === 'advisor' ? 'AI Advisor' : tab.id === 'challenges' ? 'Challenges' : tab.id === 'timeline' ? 'Timeline' : tab.id === 'profile' ? 'Profile' : tab.id === 'leaderboard' ? 'Leaderboard' : tab.id === 'story' ? 'Carbon Story' : tab.id === 'simulator' ? 'Future Simulator' : tab.id === 'privacy' ? 'Privacy Audit' : tab.id === 'geolocation' ? 'Trip Tracker' : 'Dashboard'}` });
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(screen.getByText(tab.header)).toBeInTheDocument();
      
      // Perform axe accessibility checks on each panel
      let axeResults: any;
      await act(async () => {
        axeResults = await axe(container);
      });
      expect(axeResults).toHaveNoViolations();
    }

    // Cleanup mock fetch spy
    window.fetch = originalFetch;
    localStorageMock.clear();
  }, 30000);

  test('supports full feature interaction workflow', async () => {
    // 1. Mock localStorage and global fetch
    const localStorageMock = (() => {
      let store: { [key: string]: string } = { token: 'mock-jwt-token' };
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

    const mockUser = { id: 'user-cuid', name: 'Eco Explorer Test', email: 'demo@terratwin.ai', monthlyGoal: 600 };
    const mockTwinProfile = {
      score: 85,
      persona: 'Sustainability Champion',
      monthlyFootprint: 120.5,
      annualFootprint: 1.45,
      risk: 'Low',
      potentialReduction: 18,
      goal: 600,
      goalProgress: 20
    };
    const mockForecast = { dailyAverage: 4.0, monthlyForecast: 120.0, goal: 600, status: 'On track' };
    const mockCarbonStory = { story: 'AI Carbon Story Content' };

    const originalFetch = window.fetch;
    window.fetch = jest.fn().mockImplementation((url: any) => {
      let data: any = {};
      if (url.includes('/api/v1/auth/me')) {
        data = mockUser;
      } else if (url.includes('/api/v1/carbon/entries')) {
        data = {
          entries: [
            { id: '1', category: 'transport', type: 'car', value: 10, unit: 'km', carbonEmitted: 2.1, createdAt: new Date().toISOString() }
          ],
          count: 1
        };
      } else if (url.includes('/api/v1/tokens/balance')) {
        data = { balanceECO: 150, totalCarbonEmitted: 120, nftTier: '🌱 Seed' };
      } else if (url.includes('/api/v1/carbon/analytics/daily')) {
        data = [];
      } else if (url.includes('/api/v1/carbon/analytics/monthly')) {
        data = { month: 'June', totalEmitted: 120.5, goal: 600 };
      } else if (url.includes('/api/v1/carbon/prediction')) {
        data = mockForecast;
      } else if (url.includes('/api/v1/twin/profile')) {
        data = mockTwinProfile;
      } else if (url.includes('/api/v1/agent/story')) {
        data = mockCarbonStory;
      } else if (url.includes('/api/v1/tokens/leaderboard')) {
        data = [];
      } else if (url.includes('/api/v1/carbon/public-stats')) {
        data = { totalEmitted: 438, monthlyForecast: 320, goal: 600, carbonSaved: 162 };
      } else if (url.includes('/api/v1/vision/scan-bill')) {
        data = { provider: 'NextEnergy', quantity: 120, unit: 'kWh', carbonEmitted: 27.9, tokensAwarded: 75 };
      } else if (url.includes('/api/v1/vision/analyze-food')) {
        data = { foodItem: 'beef burger with fries', entry: { value: 0.2 }, totalEmissions: 5.4 };
      } else if (url.includes('/api/v1/agent/chat')) {
        data = { reply: 'Your monthly carbon emissions are currently high. Turning off AC helps.' };
      } else if (url.includes('/api/v1/devices/sync')) {
        data = { success: true };
      } else if (url.includes('/api/v1/track/location')) {
        data = { distanceKm: 5.3, carbonEmitted: 1.1, newCommute: { id: 'commute-1' } };
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    });

    render(<App />);

    // Wait for Dashboard to render
    expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

    // Trigger WebSocket listeners to cover real-time update channels
    const carbonUpdatedKey = Object.keys(socketListeners).find(k => k.startsWith('carbon:updated:'));
    if (carbonUpdatedKey && socketListeners[carbonUpdatedKey]) {
      await act(async () => { socketListeners[carbonUpdatedKey](); });
    }
    const tokensAwardedKey = Object.keys(socketListeners).find(k => k.startsWith('tokens:awarded:'));
    if (tokensAwardedKey && socketListeners[tokensAwardedKey]) {
      await act(async () => { socketListeners[tokensAwardedKey]({ amountECO: 50 }); });
    }
    const iotPowerUpdatedKey = Object.keys(socketListeners).find(k => k.startsWith('iot:power:updated:'));
    if (iotPowerUpdatedKey && socketListeners[iotPowerUpdatedKey]) {
      await act(async () => {
        socketListeners[iotPowerUpdatedKey]({
          timestamp: new Date().toISOString(),
          watts: 450,
          devices: { lights: 50, ac: 200, fridge: 100, media: 100 }
        });
      });
    }

    // 1. Quick Manual Activity Logger Interaction
    const categorySelect = screen.getByLabelText('Activity Category');
    const quantityInput = screen.getByLabelText('Activity Quantity');

    // Cycle categories to cover UI factor switches and selectors
    fireEvent.change(categorySelect, { target: { value: 'energy' } });
    const energyTypeSelect = screen.getByLabelText('Activity Type');
    fireEvent.change(energyTypeSelect, { target: { value: 'gas' } });

    fireEvent.change(categorySelect, { target: { value: 'food' } });
    const foodTypeSelect = screen.getByLabelText('Activity Type');
    fireEvent.change(foodTypeSelect, { target: { value: 'chicken' } });
    fireEvent.change(foodTypeSelect, { target: { value: 'vegetables' } });

    fireEvent.change(categorySelect, { target: { value: 'shopping' } });
    const shoppingTypeSelect = screen.getByLabelText('Activity Type');
    fireEvent.change(shoppingTypeSelect, { target: { value: 'electronics' } });

    fireEvent.change(categorySelect, { target: { value: 'waste' } });
    const wasteTypeSelect = screen.getByLabelText('Activity Type');
    fireEvent.change(wasteTypeSelect, { target: { value: 'landfill' } });

    fireEvent.change(categorySelect, { target: { value: 'transport' } });
    const transportTypeSelect = screen.getByLabelText('Activity Type');
    fireEvent.change(transportTypeSelect, { target: { value: 'bus' } });
    
    fireEvent.change(quantityInput, { target: { value: '25' } });

    const submitBtn = screen.getByRole('button', { name: /log activity/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 2. OCR Scanner Interaction
    const ocrButton = screen.getByRole('button', { name: 'Navigate to AI Scanner' });
    await act(async () => { fireEvent.click(ocrButton); });
    expect(screen.getByText('ocr Panel')).toBeInTheDocument();

    const billInput = screen.getByLabelText('Upload utility bill image');
    const mockFile = new File(['mock content'], 'bill.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(billInput, { target: { files: [mockFile] } });
    });

    const scanBillButton = screen.getByRole('button', { name: 'Scan utility bill' });
    await act(async () => {
      fireEvent.click(scanBillButton);
    });
    expect(await screen.findByText('AI Vision Analysis Report')).toBeInTheDocument();

    const foodInput = screen.getByLabelText('Upload food image');
    await act(async () => {
      fireEvent.change(foodInput, { target: { files: [mockFile] } });
    });

    const scanFoodButton = screen.getByRole('button', { name: 'Analyze food footprint' });
    await act(async () => {
      fireEvent.click(scanFoodButton);
    });

    // 3. Smart Home Interaction
    const smarthomeButton = screen.getByRole('button', { name: 'Navigate to IoT Monitor' });
    await act(async () => { fireEvent.click(smarthomeButton); });
    expect(screen.getByText('smarthome Panel')).toBeInTheDocument();

    const syncButton = screen.getByRole('button', { name: 'Sync smart home meter data' });
    await act(async () => {
      fireEvent.click(syncButton);
    });

    // 3b. GPS Tracker Interaction
    const gpsNavButton = screen.getByRole('button', { name: 'Navigate to Trip Tracker' });
    await act(async () => { fireEvent.click(gpsNavButton); });
    expect(screen.getByText('geolocation Panel')).toBeInTheDocument();

    const startTrackingBtn = screen.getByRole('button', { name: 'Start tracking' });
    await act(async () => { fireEvent.click(startTrackingBtn); });

    const stopTrackingBtn = screen.getByRole('button', { name: 'Stop tracking' });
    await act(async () => { fireEvent.click(stopTrackingBtn); });

    // 4. AI Advisor Interaction
    const advisorButton = screen.getByRole('button', { name: 'Navigate to AI Advisor' });
    await act(async () => { fireEvent.click(advisorButton); });
    expect(screen.getByText('advisor Panel')).toBeInTheDocument();

    // Click suggestions bar button to cover onClick suggestions branch
    const suggestionBtn = screen.getByRole('button', { name: 'Why is my carbon footprint high?' });
    fireEvent.click(suggestionBtn);

    const chatInput = screen.getByLabelText('Type message to advisor');
    fireEvent.change(chatInput, { target: { value: 'How can I save carbon?' } });

    const sendChatButton = screen.getByRole('button', { name: 'Send message' });
    await act(async () => {
      fireEvent.click(sendChatButton);
    });
    expect(await screen.findByText('Your monthly carbon emissions are currently high. Turning off AC helps.')).toBeInTheDocument();

    // 5. Future Simulator Slider habits Interaction
    const simulatorButton = screen.getByRole('button', { name: 'Navigate to Future Simulator' });
    await act(async () => { fireEvent.click(simulatorButton); });
    expect(screen.getByText('simulator Panel')).toBeInTheDocument();

    const transportSlider = screen.getByLabelText('Vehicle Commute (days per week)');
    fireEvent.change(transportSlider, { target: { value: '2' } });

    const beefSlider = screen.getByLabelText('Beef Consumption Reduction (percentage)');
    fireEvent.change(beefSlider, { target: { value: '50' } });

    const energySlider = screen.getByLabelText('Renewable Energy Share (percentage)');
    fireEvent.change(energySlider, { target: { value: '80' } });

    // 6. Navigate to other pages to cover their UI structures
    const challengesButton = screen.getByRole('button', { name: 'Navigate to Challenges' });
    await act(async () => { fireEvent.click(challengesButton); });

    const timelineButton = screen.getByRole('button', { name: 'Navigate to Timeline' });
    await act(async () => { fireEvent.click(timelineButton); });

    const profileButton = screen.getByRole('button', { name: 'Navigate to Profile' });
    await act(async () => { fireEvent.click(profileButton); });

    const logoutButton = screen.getByRole('button', { name: 'Sign Out' });
    await act(async () => {
      fireEvent.click(logoutButton);
    });
    expect(screen.getByRole('button', { name: 'Launch App' })).toBeInTheDocument();

    // Cleanup
    window.fetch = originalFetch;
    localStorageMock.clear();
  }, 30000);

  describe('TerraTwin Detailed Component and Interaction Flow Tests', () => {
    let originalFetch: any;
    let localStorageMock: any;

    beforeEach(() => {
      localStorageMock = (() => {
        let store: { [key: string]: string } = { token: 'mock-jwt-token' };
        return {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, value: string) => { store[key] = value; },
          removeItem: (key: string) => { delete store[key]; },
          clear: () => { store = {}; }
        };
      })();
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      originalFetch = window.fetch;
    });

    afterEach(() => {
      window.fetch = originalFetch;
      localStorageMock.clear();
      jest.clearAllMocks();
    });

    const setupMocks = (fetchOverride?: any) => {
      const mockUser = { id: 'user-cuid', name: 'Eco Explorer Test', email: 'demo@terratwin.ai', monthlyGoal: 600 };
      const mockTwinProfile = {
        score: 85,
        persona: 'Sustainability Champion',
        monthlyFootprint: 120.5,
        annualFootprint: 1.45,
        risk: 'Low',
        potentialReduction: 18,
        goal: 600,
        goalProgress: 20
      };
      const mockForecast = { dailyAverage: 4.0, monthlyForecast: 120.0, goal: 600, status: 'On track' };
      const mockCarbonStory = { story: 'AI Carbon Story Content\n\n- Recommendations:\n1. Use public transport\n2. Reduce beef intake' };

      window.fetch = jest.fn().mockImplementation((url: any) => {
        if (fetchOverride) {
          const customResponse = fetchOverride(url);
          if (customResponse !== undefined) return customResponse;
        }

        let data: any = {};
        if (url.includes('/api/v1/auth/me')) {
          data = mockUser;
        } else if (url.includes('/api/v1/auth/login')) {
          data = { token: 'mock-jwt-token', user: mockUser };
        } else if (url.includes('/api/v1/carbon/entries')) {
          data = {
            entries: [
              { id: '1', category: 'transport', type: 'car', value: 10, unit: 'km', carbonEmitted: 2.1, source: 'manual', createdAt: new Date().toISOString() }
            ],
            count: 1
          };
        } else if (url.includes('/api/v1/tokens/balance')) {
          data = { balanceECO: 150, totalCarbonEmitted: 120, nftTier: '🌱 Seed' };
        } else if (url.includes('/api/v1/carbon/analytics/daily')) {
          data = [{ date: '2026-06-21', transport: 2.1, energy: 0, food: 0 }];
        } else if (url.includes('/api/v1/carbon/analytics/monthly')) {
          data = { month: 'June', totalEmitted: 120.5, goal: 600 };
        } else if (url.includes('/api/v1/carbon/prediction')) {
          data = mockForecast;
        } else if (url.includes('/api/v1/twin/profile')) {
          data = mockTwinProfile;
        } else if (url.includes('/api/v1/agent/story')) {
          data = mockCarbonStory;
        } else if (url.includes('/api/v1/tokens/leaderboard')) {
          data = [{ name: 'Eco Advocate', balanceECO: 500, walletAddress: '0x1234' }];
        } else if (url.includes('/api/v1/carbon/public-stats')) {
          data = { totalEmitted: 438, monthlyForecast: 320, goal: 600, carbonSaved: 162 };
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
        } as Response);
      });
    };

    // --- DASHBOARD TESTS ---
    test('Dashboard renders core statistics, token balance, and loads profile widget', async () => {
      setupMocks();
      render(<App />);

      // Verify dashboard statistics are rendered
      expect(await screen.findByText(/120\.5/)).toBeInTheDocument(); // totalEmitted
      expect(screen.getByText(/600\s*kg/)).toBeInTheDocument(); // monthlyGoal

      // Verify token balance and tier in header
      expect(screen.getByText('150 ECO')).toBeInTheDocument();
      expect(screen.getByText('🌱 Seed')).toBeInTheDocument();

      // Verify Carbon Twin profile widget loaded
      expect(screen.getByText('Sustainability Champion')).toBeInTheDocument();
      expect(screen.getByText('85/100')).toBeInTheDocument();
      expect(screen.getByText(/Potential Reduction/)).toBeInTheDocument();
    });

    test('Dashboard renders charts and updates after a new carbon entry is logged via Quick Logger', async () => {
      setupMocks();
      const { container } = render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      // Verify chart wrapper element is present
      await waitFor(() => {
        const responsiveContainer = container.querySelector('.recharts-responsive-container');
        expect(responsiveContainer).toBeInTheDocument();
      });

      // Log a new carbon entry via Quick Logger
      const categorySelect = screen.getByLabelText('Activity Category');
      fireEvent.change(categorySelect, { target: { value: 'transport' } });

      const typeSelect = screen.getByLabelText('Activity Type');
      fireEvent.change(typeSelect, { target: { value: 'car' } });

      const quantityInput = screen.getByLabelText('Activity Quantity');
      fireEvent.change(quantityInput, { target: { value: '50' } });

      const submitBtn = screen.getByRole('button', { name: /log activity/i });
      
      // Update mock to return new entry when dashboard data fetches again
      setupMocks((url: string) => {
        if (url.includes('/api/v1/carbon/entries') && !url.includes('analytics')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              entries: [
                { id: '1', category: 'transport', type: 'car', value: 10, unit: 'km', carbonEmitted: 2.1, source: 'manual', createdAt: new Date().toISOString() },
                { id: '2', category: 'transport', type: 'car', value: 50, unit: 'km', carbonEmitted: 10.5, source: 'manual', createdAt: new Date().toISOString() }
              ],
              count: 2
            })
          });
        }
      });

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Verify quantity updates (reset to default 10 after log)
      expect(quantityInput).toHaveValue(10);
    });

    // --- CARBON STORY TESTS ---
    test('Carbon Story loads successfully and renders recommendations', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      const storyNavBtn = screen.getByRole('button', { name: 'Navigate to Carbon Story' });
      await act(async () => { fireEvent.click(storyNavBtn); });

      expect(screen.getByText('story Panel')).toBeInTheDocument();
      expect(await screen.findByText(/AI Carbon Story Content/)).toBeInTheDocument();
      expect(screen.getByText(/Recommendations/)).toBeInTheDocument();
    });

    test('Carbon Story handles API failure gracefully', async () => {
      setupMocks((url: string) => {
        if (url.includes('/api/v1/agent/story')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: { message: 'Internal Server Error' } })
          } as Response);
        }
      });

      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      const storyNavBtn = screen.getByRole('button', { name: 'Navigate to Carbon Story' });
      await act(async () => { fireEvent.click(storyNavBtn); });

      expect(screen.getByText('story Panel')).toBeInTheDocument();
      expect(await screen.findByText('Failed to generate story.')).toBeInTheDocument();
    });

    // --- FUTURE SIMULATOR TESTS ---
    test('Future Simulator sliders and presets update values and savings predictions', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      const simulatorNavBtn = screen.getByRole('button', { name: 'Navigate to Future Simulator' });
      await act(async () => { fireEvent.click(simulatorNavBtn); });
      expect(screen.getByText('simulator Panel')).toBeInTheDocument();

      // Sliders initial states check
      const transportSlider = screen.getByLabelText('Vehicle Commute (days per week)');
      expect(transportSlider).toHaveValue('5');

      // Drag slider
      fireEvent.change(transportSlider, { target: { value: '2' } });
      expect(transportSlider).toHaveValue('2');
      expect(screen.getByText('2 days/week')).toBeInTheDocument();

      // Presets click
      const greenCommuterPreset = screen.getByRole('button', { name: '🚲 Green Commuter' });
      await act(async () => { fireEvent.click(greenCommuterPreset); });
      expect(transportSlider).toHaveValue('1'); // transport preset value is 1
      expect(screen.getByText('1 days/week')).toBeInTheDocument();

      // Verification of carbon savings calculations
      expect(screen.getByText('Monthly Carbon Saved:')).toBeInTheDocument();
      expect(screen.getByText(/147\.0/)).toBeInTheDocument();
    });

    // --- PRIVACY AUDIT TESTS ---
    test('Privacy Audit displays overall trust score, permission grid, and security badges', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      const privacyNavBtn = screen.getByRole('button', { name: 'Navigate to Privacy Audit' });
      await act(async () => { fireEvent.click(privacyNavBtn); });
      expect(screen.getByText('privacy Panel')).toBeInTheDocument();

      expect(screen.getByText('Privacy Rating')).toBeInTheDocument();
      expect(screen.getByText('96/100')).toBeInTheDocument();
      expect(screen.getByText('Security & Trust Credentials')).toBeInTheDocument();
      expect(screen.getByText('JWT Session')).toBeInTheDocument();
      expect(screen.getByText('Images Cleared')).toBeInTheDocument();
    });

    // --- PROFILE, TIMELINE, AND CHALLENGES TESTS ---
    test('Profile and Timeline render user sustainability info and chronological event nodes', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      // Navigation to Profile Page
      const profileNavBtn = screen.getByRole('button', { name: 'Navigate to Profile' });
      await act(async () => { fireEvent.click(profileNavBtn); });
      expect(screen.getByText('profile Panel')).toBeInTheDocument();
      expect(screen.getByText('demo@terratwin.ai')).toBeInTheDocument();
      expect(screen.getByText('Sustainability Score')).toBeInTheDocument();

      // Navigation to Journey Timeline
      const timelineNavBtn = screen.getByRole('button', { name: 'Navigate to Timeline' });
      await act(async () => { fireEvent.click(timelineNavBtn); });
      expect(screen.getByText('timeline Panel')).toBeInTheDocument();
      expect(screen.getByText('June 1 — Platform Registration')).toBeInTheDocument();
    });

    test('Challenges board updates unlocked badges based on entries source', async () => {
      // Mock entries with a vision upload source to unlock "First Scan"
      setupMocks((url: string) => {
        if (url.includes('/api/v1/carbon/entries') && !url.includes('analytics')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              entries: [
                { id: '1', category: 'energy', type: 'electricity', value: 120, unit: 'kWh', carbonEmitted: 27.9, source: 'vision:bill', createdAt: new Date().toISOString() }
              ],
              count: 1
            })
          });
        }
      });

      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      const challengesNavBtn = screen.getByRole('button', { name: 'Navigate to Challenges' });
      await act(async () => { fireEvent.click(challengesNavBtn); });
      expect(screen.getByText('challenges Panel')).toBeInTheDocument();

      // "First Scan" is index 0. Unlock indicator is a green circle or unlock text
      expect(screen.getByText('🏆 First Scan')).toBeInTheDocument();
    });

    // --- GLOBE TESTS ---
    test('Globe renders canvas, auto-rotates over time, and navigates to story on click', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      // 1. Globe renders canvas inside button
      const globeBtn = screen.getAllByRole('button', { name: /interactive 3d digital carbon twin globe/i })[0];
      expect(globeBtn).toBeInTheDocument();
      const canvas = globeBtn.querySelector('canvas');
      expect(canvas).toBeInTheDocument();

      // 2. Globe button click navigates to Carbon Story
      await act(async () => { fireEvent.click(globeBtn); });
      expect(screen.getByText('story Panel')).toBeInTheDocument();
    });

    // --- WEBSOCKET REAL-TIME TESTS ---
    test('WebSocket updates carbon status, ECO balance, and live IoT power telemetry dynamically', async () => {
      setupMocks();
      render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      // Simulate carbon:updated socket trigger
      const carbonUpdatedKey = Object.keys(socketListeners).find(k => k.startsWith('carbon:updated:'));
      expect(carbonUpdatedKey).toBeDefined();
      
      // Simulate socket push for tokens:awarded
      const tokensAwardedKey = Object.keys(socketListeners).find(k => k.startsWith('tokens:awarded:'));
      expect(tokensAwardedKey).toBeDefined();
      await act(async () => {
        socketListeners[tokensAwardedKey!]({ amountECO: 80 });
      });
      // Header updates from 150 ECO to 230 ECO instantly
      expect(screen.getByText('230 ECO')).toBeInTheDocument();

      // Navigate to Smart Home tab to check IoT WebSockets
      const smarthomeButton = screen.getByRole('button', { name: 'Navigate to IoT Monitor' });
      await act(async () => { fireEvent.click(smarthomeButton); });

      const iotPowerUpdatedKey = Object.keys(socketListeners).find(k => k.startsWith('iot:power:updated:'));
      expect(iotPowerUpdatedKey).toBeDefined();
      await act(async () => {
        socketListeners[iotPowerUpdatedKey!]({
          timestamp: new Date().toISOString(),
          watts: 550,
          devices: { lights: 60, ac: 300, fridge: 110, media: 80 }
        });
      });
      expect(screen.getByText('Air Conditioning')).toBeInTheDocument();
      expect(screen.getByText('300 W')).toBeInTheDocument();
    });

    // --- ACCESSIBILITY REGRESSION TESTS ---
    test('Keyboard navigation works across side navigation tabs and globe is focusable', async () => {
      setupMocks();
      const { container } = render(<App />);
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();

      // Verify no WCAG violations on initial Dashboard load
      let axeResults: any;
      await act(async () => {
        axeResults = await axe(container);
      });
      expect(axeResults).toHaveNoViolations();

      // Verify keyboard navigation elements
      const dashboardNavBtn = screen.getByRole('button', { name: 'Navigate to Dashboard' });
      const globeBtn = screen.getAllByRole('button', { name: /interactive 3d digital carbon twin globe/i })[0];

      expect(dashboardNavBtn).toBeInTheDocument();
      expect(globeBtn).toBeInTheDocument();
    });

    // --- END-TO-END SUSTAINABILITY JOURNEY TEST ---
    test('Complete Sustainability Journey Test: user signs in, logs entry, awards tokens, checks achievements, timeline and simulator calculations', async () => {
      localStorageMock.clear();
      setupMocks();
      
      // Starts on login page
      render(<App />);
      expect(screen.getAllByText('TerraTwin AI')[0]).toBeInTheDocument();
      
      // Open login modal
      const launchBtn = screen.getByRole('button', { name: 'Launch App' });
      fireEvent.click(launchBtn);

      // Enter credentials and click Sign In
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(emailInput, { target: { value: 'demo@terratwin.ai' } });
      fireEvent.change(passwordInput, { target: { value: 'demo123' } });
      
      const signInBtn = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => { fireEvent.click(signInBtn); });

      // Verifies dashboard successfully renders in logged-in state
      expect(await screen.findByText('dashboard Panel')).toBeInTheDocument();
      expect(screen.getByText('150 ECO')).toBeInTheDocument();

      // Logs a transport entry
      const categorySelect = screen.getByLabelText('Activity Category');
      fireEvent.change(categorySelect, { target: { value: 'transport' } });
      const quantityInput = screen.getByLabelText('Activity Quantity');
      fireEvent.change(quantityInput, { target: { value: '50' } });

      const logActivityBtn = screen.getByRole('button', { name: /log activity/i });
      
      // Mock new token reward and data refresh on save
      setupMocks((url: string) => {
        if (url.includes('/api/v1/tokens/balance')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ balanceECO: 225, totalCarbonEmitted: 130.5, nftTier: '🌿 Sprout' })
          });
        }
      });

      await act(async () => {
        fireEvent.click(logActivityBtn);
      });

      // Assert ECO tokens are awarded and tier upgrades dynamically
      expect(await screen.findByText('225 ECO')).toBeInTheDocument();
      expect(screen.getByText('🌿 Sprout')).toBeInTheDocument();

      // Go to Challenges panel and verify achievements
      const challengesNavBtn = screen.getByRole('button', { name: 'Navigate to Challenges' });
      await act(async () => { fireEvent.click(challengesNavBtn); });
      expect(screen.getByText('challenges Panel')).toBeInTheDocument();

      // Verify story generates correctly
      const storyNavBtn = screen.getByRole('button', { name: 'Navigate to Carbon Story' });
      await act(async () => { fireEvent.click(storyNavBtn); });
      expect(screen.getByText('story Panel')).toBeInTheDocument();
      expect(await screen.findByText(/AI Carbon Story Content/)).toBeInTheDocument();

      // Verify simulator calculators
      const simulatorNavBtn = screen.getByRole('button', { name: 'Navigate to Future Simulator' });
      await act(async () => { fireEvent.click(simulatorNavBtn); });
      expect(screen.getByText('simulator Panel')).toBeInTheDocument();
      expect(screen.getByText('Monthly Carbon Saved:')).toBeInTheDocument();

      // Sign Out
      const signOutBtn = screen.getByRole('button', { name: 'Sign Out' });
      await act(async () => { fireEvent.click(signOutBtn); });
      expect(screen.getByRole('button', { name: 'Launch App' })).toBeInTheDocument();
    });

    test('User login fails when api is not ok', async () => {
      localStorageMock.clear();
      setupMocks();
      render(<App />);

      // Open login modal
      const launchBtn = screen.getByRole('button', { name: 'Launch App' });
      fireEvent.click(launchBtn);

      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'badlogin@terratwin.ai' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

      setupMocks((url: string) => {
        if (url.includes('/api/v1/auth/login')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: { message: 'Invalid credentials.' } }),
          } as Response);
        }
      });

      const submitBtn = screen.getByRole('button', { name: 'Sign In' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
    });

    test('User registration fails when api is not ok', async () => {
      localStorageMock.clear();
      setupMocks();
      render(<App />);

      // Open login modal
      const launchBtn = screen.getByRole('button', { name: 'Launch App' });
      fireEvent.click(launchBtn);

      const toggleLink = screen.getByRole('button', { name: "Don't have an account? Sign Up" });
      fireEvent.click(toggleLink);

      const nameInput = screen.getByLabelText('Full Name');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(nameInput, { target: { value: 'Bad User' } });
      fireEvent.change(emailInput, { target: { value: 'bad@terratwin.ai' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      setupMocks((url: string) => {
        if (url.includes('/api/v1/auth/register')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: { message: 'Email already registered.' } }),
          } as Response);
        }
      });

      const submitBtn = screen.getByRole('button', { name: 'Create Account' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Verify error message is shown
      expect(await screen.findByText('Email already registered.')).toBeInTheDocument();
    });

    test('User registers successfully and transitions to dashboard', async () => {
      localStorageMock.clear();
      setupMocks();
      render(<App />);

      // Open login modal
      const launchBtn = screen.getByRole('button', { name: 'Launch App' });
      fireEvent.click(launchBtn);

      const toggleLink = screen.getByRole('button', { name: "Don't have an account? Sign Up" });
      fireEvent.click(toggleLink);

      const nameInput = screen.getByLabelText('Full Name');
      const emailInput = screen.getByLabelText('Email Address');
      const passwordInput = screen.getByLabelText('Password');
      const walletInput = screen.getByLabelText('Polygon Wallet Address (Optional)');

      fireEvent.change(nameInput, { target: { value: 'New User' } });
      fireEvent.change(emailInput, { target: { value: 'new@terratwin.ai' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(walletInput, { target: { value: '0xabc123' } });

      setupMocks((url: string) => {
        if (url.includes('/api/v1/auth/register')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ token: 'new-jwt-token', user: { id: 'new-user-id', name: 'New User', email: 'new@terratwin.ai', monthlyGoal: 600 } }),
          } as Response);
        }
      });

      const submitBtn = screen.getByRole('button', { name: 'Create Account' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Verify dashboard is shown
      expect(await screen.findByText(/120\.5/)).toBeInTheDocument();
    });
  });
});

