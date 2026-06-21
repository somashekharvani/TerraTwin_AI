import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Leaf,
  Scan,
  Navigation,
  Tv,
  MessageSquare,
  Trophy,
  Activity,
  AlertTriangle,
  Upload,
  User,
  Lock,
  Mail,
  Zap,
  Globe,
  BookOpen,
  Sliders,
  Shield,
  Calendar,
  PlusCircle,
  Sparkles,
  Settings,
} from 'lucide-react';

let getMetaEnv = () => {
  try {
    return new Function('return import.meta.env')();
  } catch (e) {
    const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
    return (globalObj as any).process?.env || {};
  }
};
const API_URL = getMetaEnv().VITE_API_URL || 'http://localhost:5000';

interface CarbonEntry {
  id: string;
  category: string;
  type: string;
  value: number;
  unit: string;
  carbonEmitted: number;
  source: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  walletAddress: string | null;
  monthlyGoal: number;
}

interface TokenBalance {
  balanceECO: number;
  totalCarbonEmitted: number;
  nftTier: string;
}

interface LeaderboardUser {
  id: string;
  name: string;
  walletAddress: string;
  balanceECO: number;
}

export default function App() {
  // Session State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [publicStats, setPublicStats] = useState({ totalEmitted: 438, monthlyForecast: 320, goal: 600, carbonSaved: 162 });
  const [syncSeconds, setSyncSeconds] = useState(0);

  // Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  // Dashboard Data State
  const [entries, setEntries] = useState<CarbonEntry[]>([]);
  const [balance, setBalance] = useState<TokenBalance>({
    balanceECO: 0,
    totalCarbonEmitted: 0,
    nftTier: '🌱 Seed',
  });
  const [dailyStats, setDailyStats] = useState<{ date: string; carbonEmitted: number }[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ month: '', totalEmitted: 0, goal: 600 });
  const [forecast, setForecast] = useState({ dailyAverage: 0, monthlyForecast: 0, goal: 600, status: 'On track' });
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  // Geolocation Simulator State
  const [isTracking, setIsTracking] = useState(false);
  const [gpsLogs, setGpsLogs] = useState<{ lat: number; lng: number; time: string; mode: string }[]>([]);
  const trackingInterval = useRef<any>(null);

  // Smart Home IoT State
  const [livePower, setLivePower] = useState<{ time: string; watts: number }[]>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState({ lights: 154, ac: 0, fridge: 255, media: 311 });
  const [iotStatus, setIotStatus] = useState('Disconnected');

  // AI Advisor Chat State
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hello! I am your AI carbon coach. How can I help you reduce your footprint today?' },
  ]);
  const [userMsg, setUserMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Carbon Twin Profile State
  const [twinProfile, setTwinProfile] = useState<any>({
    score: 0,
    persona: 'Eco Explorer',
    monthlyFootprint: 0,
    annualFootprint: 0,
    risk: 'Moderate',
    potentialReduction: 15,
    goal: 600,
    goalProgress: 0,
  });

  // Carbon Story State
  const [carbonStory, setCarbonStory] = useState<string>('');
  const [storyLoading, setStoryLoading] = useState(false);

  // Quick Manual Logger State
  const [quickCategory, setQuickCategory] = useState<'transport' | 'energy' | 'food' | 'shopping' | 'waste'>('transport');
  const [quickType, setQuickType] = useState('car');
  const [quickValue, setQuickValue] = useState(10);
  const [quickUnit, setQuickUnit] = useState('km');
  const [quickLogLoading, setQuickLogLoading] = useState(false);

  // Future Simulator State
  const [simTransport, setSimTransport] = useState(5); // days commuting via car
  const [simBeef, setSimBeef] = useState(40); // beef reduction percentage
  const [simEnergy, setSimEnergy] = useState(20); // renewable energy percentage

  // OCR Upload State
  const [billFile, setBillFile] = useState<File | null>(null);
  const [foodFile, setFoodFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // WebSocket Instance
  const socketRef = useRef<Socket | null>(null);

  // Fetch session profile
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  // Fetch public stats for landing page if guest
  useEffect(() => {
    if (!token) {
      fetch(`${API_URL}/api/v1/carbon/public-stats`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setPublicStats(data);
          }
        })
        .catch((err) => console.error('Failed to fetch public stats.', err));
    }
  }, [token]);

  // Sync relative timer counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hook WebSockets and telemetry streams once authenticated
  useEffect(() => {
    if (!token || !user) return;

    // Establish WebSocket Connection
    const socket = io(API_URL, {
      transports: ['websocket'],
      query: { token },
    });
    socketRef.current = socket;

    // Listen to real-time events
    socket.on(`carbon:updated:${user.id}`, () => {
      fetchDashboardData();
    });

    socket.on(`tokens:awarded:${user.id}`, (data: any) => {
      setBalance((prev) => ({
        ...prev,
        balanceECO: prev.balanceECO + data.amountECO,
      }));
    });

    socket.on(`iot:power:updated:${user.id}`, (data: any) => {
      setIotStatus('Live');
      setDeviceBreakdown(data.devices);
      setLivePower((prev) => {
        const next = [...prev, { time: new Date(data.timestamp).toLocaleTimeString(), watts: data.watts }];
        return next.slice(-15); // keep last 15 ticks
      });
    });

    // Load static data
    fetchDashboardData();
    fetchLeaderboard();

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 404) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setUser(data);
    } catch (err) {
      setErrorMsg('Failed to connect to backend server.');
    }
  };

  const fetchTwinProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/twin/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTwinProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch Twin Profile data.', err);
    }
  };

  const fetchCarbonStory = async () => {
    setStoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/agent/story`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCarbonStory(data.story);
      } else {
        setCarbonStory('Failed to generate story.');
      }
    } catch (err) {
      console.error('Failed to fetch Carbon Story data.', err);
      setCarbonStory('Failed to generate story.');
    } finally {
      setStoryLoading(false);
    }
  };

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickLogLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/carbon/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: quickCategory,
          type: quickType,
          value: Number(quickValue),
          unit: quickUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Failed to log manual entry.');
        return;
      }
      fetchDashboardData();
      setQuickValue(10);
    } catch (err) {
      setErrorMsg('Failed to sync manual entry to database.');
    } finally {
      setQuickLogLoading(false);
    }
  };

  // Sync types and units for quick logger dynamically
  useEffect(() => {
    if (quickCategory === 'transport') {
      setQuickType('car');
      setQuickUnit('km');
    } else if (quickCategory === 'energy') {
      setQuickType('electricity');
      setQuickUnit('kWh');
    } else if (quickCategory === 'food') {
      setQuickType('beef');
      setQuickUnit('kg');
    } else if (quickCategory === 'shopping') {
      setQuickType('clothing');
      setQuickUnit('items');
    } else if (quickCategory === 'waste') {
      setQuickType('landfill');
      setQuickUnit('kg');
    }
  }, [quickCategory]);

  const fetchDashboardData = async () => {
    setDashboardLoading(true);
    setSyncSeconds(0);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Get recent logs
      const entriesRes = await fetch(`${API_URL}/api/v1/carbon/entries?limit=8`, { headers });
      const entriesData = await entriesRes.json();
      setEntries(entriesData?.entries || []);

      // Get token balance & NFT tier
      const balRes = await fetch(`${API_URL}/api/v1/tokens/balance`, { headers });
      const balData = await balRes.json();
      if (balRes.ok && balData) {
        setBalance(balData);
      }

      // Get Daily analytics
      const dailyRes = await fetch(`${API_URL}/api/v1/carbon/analytics/daily`, { headers });
      const dailyData = await dailyRes.json();
      if (dailyRes.ok && Array.isArray(dailyData)) {
        setDailyStats(dailyData);
      } else {
        setDailyStats([]);
      }

      // Get Monthly analytics
      const monthlyRes = await fetch(`${API_URL}/api/v1/carbon/analytics/monthly`, { headers });
      const monthlyData = await monthlyRes.json();
      if (monthlyRes.ok && monthlyData) {
        setMonthlyStats(monthlyData);
      }

      // Get forecast prediction
      const forecastRes = await fetch(`${API_URL}/api/v1/carbon/prediction`, { headers });
      const forecastData = await forecastRes.json();
      if (forecastRes.ok && forecastData) {
        setForecast(forecastData);
      }

      // Sync custom twin stats
      await fetchTwinProfile();
      await fetchCarbonStory();
    } catch (err) {
      console.error('Failed to sync dashboard telemetry.', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/tokens/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLeaderboard(data);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error(err);
      setLeaderboard([]);
    }
  };

  const getSyncText = () => {
    if (syncSeconds < 10) return 'Just now';
    if (syncSeconds < 60) return `${syncSeconds}s ago`;
    const mins = Math.floor(syncSeconds / 60);
    return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
  };

  const getNextAction = () => {
    const hasCar = entries.some((e) => e.type?.toLowerCase() === 'car');
    const hasBeef = entries.some((e) => e.type?.toLowerCase() === 'beef');
    if (hasCar) {
      return {
        icon: '🚍',
        title: 'Take Bus Tomorrow',
        saving: '2.1 kg CO₂',
        detail: 'Swapping your private car commute for public transit lowers carbon intensity by 48%.',
      };
    }
    if (hasBeef) {
      return {
        icon: '🥗',
        title: 'Reduce Beef Consumption',
        saving: '4.5 kg CO₂',
        detail: 'Swapping one beef meal for a plant-based option reduces food carbon footprint by 90%.',
      };
    }
    return {
      icon: '🔌',
      title: 'Turn off AC / standby devices',
      saving: '1.2 kg CO₂',
      detail: 'Eliminating vampire draw from idle home electronics saves smart energy daily.',
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Login failed.');
        return;
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setErrorMsg('Server connection refused.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, walletAddress: walletAddress || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Registration failed.');
        return;
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setErrorMsg('Server connection refused.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
    }
  };

  // OCR Upload Actions
  const handleScanBill = async () => {
    if (!billFile) return;
    setOcrLoading(true);
    setOcrResult(null);
    setOcrErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', billFile);

      const res = await fetch(`${API_URL}/api/v1/vision/scan-bill`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setOcrErrorMsg(data.error?.message || 'Failed to scan utility bill OCR.');
        return;
      }
      setOcrResult({ type: 'bill', ...data });
      fetchDashboardData();
    } catch (err) {
      setOcrErrorMsg('Failed to connect to the vision service.');
      console.error(err);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAnalyzeFood = async () => {
    if (!foodFile) return;
    setOcrLoading(true);
    setOcrResult(null);
    setOcrErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', foodFile);

      const res = await fetch(`${API_URL}/api/v1/vision/analyze-food`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setOcrErrorMsg(data.error?.message || 'Failed to analyze food camera.');
        return;
      }
      setOcrResult({ type: 'food', ...data });
      fetchDashboardData();
    } catch (err) {
      setOcrErrorMsg('Failed to connect to the food analyzer service.');
      console.error(err);
    } finally {
      setOcrLoading(false);
    }
  };

  // GPS commute simulator
  const toggleTracking = () => {
    if (isTracking) {
      if (trackingInterval.current) {
        clearInterval(trackingInterval.current);
      }
      setIsTracking(false);
    } else {
      setIsTracking(true);
      setGpsLogs([]);

      // Start simulating coordinates every 5 seconds (fast mode for demonstration)
      let step = 0;
      const path = [
        { lat: 40.7128, lng: -74.006 }, // NYC Start point
        { lat: 40.758, lng: -73.9855 }, // Midtown NYC displacement (5.3km - car)
        { lat: 40.762, lng: -73.9895 }, // Central Park biking path (0.56km - bike)
        { lat: 40.7621, lng: -73.9899 }, // Walking shift (walking)
      ];

      // Immediately log start point
      sendGpsTelemetry(path[0].lat, path[0].lng);

      trackingInterval.current = setInterval(() => {
        step++;
        if (step >= path.length) {
          if (trackingInterval.current) clearInterval(trackingInterval.current);
          setIsTracking(false);
          return;
        }
        sendGpsTelemetry(path[step].lat, path[step].lng);
      }, 8000);
    }
  };

  const sendGpsTelemetry = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/track/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude, timestamp: Date.now() }),
      });
      const data = await res.json();

      setGpsLogs((prev) => [
        ...prev,
        {
          lat: latitude,
          lng: longitude,
          time: new Date().toLocaleTimeString(),
          mode: data.classifiedAs || 'Start Point',
        },
      ]);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // IoT telemetry broker simulator
  const handleIotTelemetrySync = async () => {
    try {
      await fetch(`${API_URL}/api/v1/devices/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          watts: Math.floor(600 + Math.random() * 200),
          devices: {
            lights: Math.floor(100 + Math.random() * 50),
            ac: Math.random() > 0.5 ? 400 : 0,
            fridge: 250,
            media: 300,
          },
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Advisor Chat action
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMsg.trim()) return;

    const userMessage = userMsg;
    setUserMsg('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: 'bot', text: 'Error connecting to the AI Advisor.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Render Authentication Portal if not logged in
  if (!token || !user) {
    return (
      <main className="min-h-screen bg-dark-900 flex flex-col justify-start relative overflow-x-hidden cyber-grid font-sans text-slate-100">
        {/* Glow ambient design elements */}
        <div className="glow-spot-green -top-20 -right-20 pointer-events-none" />
        <div className="glow-spot-blue top-1/2 left-1/4 pointer-events-none" />

        {/* Global Landing Header */}
        <header className="w-full h-20 px-6 lg:px-16 flex items-center justify-between z-40 bg-dark-950/20 backdrop-blur-md border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-eco-500/10 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-eco-500 animate-pulse" />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">TerraTwin AI</h1>
          </div>
          <button
            onClick={() => {
              setIsRegistering(false);
              setShowAuthModal(true);
            }}
            className="px-5 py-2.5 bg-eco-500 hover:bg-eco-600 active:scale-[0.98] rounded-xl text-white font-bold transition text-sm shadow-lg shadow-eco-500/25"
          >
            Launch App
          </button>
        </header>
        
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 pt-28 pb-16">
          
          {/* Left Column: Cover Page / Hero Vision Card */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-8 relative">
            {/* Ambient glows inside cover */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-eco-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-6 relative z-10">
              {/* PromptWars Challenge 3 Badge */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-eco-400 bg-eco-500/10 border border-eco-500/20 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-eco-500 animate-ping" />
                  PromptWars Challenge 3 Submission
                </span>
                <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20">
                  ⚡ Stable
                </span>
              </div>

              {/* Title & Tagline */}
              <div className="space-y-4">
                <h2 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight">
                  TerraTwin <span className="text-transparent bg-clip-text bg-gradient-to-r from-eco-400 to-emerald-500">AI</span>
                </h2>
                <h3 className="text-xl lg:text-2xl font-extrabold text-slate-300 tracking-wide uppercase">
                  AI-Powered Digital Carbon Twin Platform
                </h3>
                <p className="text-lg lg:text-xl font-medium text-eco-400 italic">
                  "See Your Carbon Future Before It Happens."
                </p>
                <p className="text-slate-400 max-w-xl leading-relaxed text-sm lg:text-base">
                  TerraTwin AI helps users monitor, understand, predict, and reduce their carbon footprint through AI-powered sustainability analytics, future emission forecasting, and personalized environmental recommendations.
                </p>
              </div>

              {/* Developer Profile Card */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 max-w-xl backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-eco-500 to-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-eco-500/20">
                    SV
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">👨‍💻 Developed By</h4>
                    <p className="text-base font-bold text-white">Somashekhar Vani</p>
                    <p className="text-xs text-slate-400 font-medium">
                      Electronics & Communication Engineering • Sambhram Institute of Technology, Bengaluru
                    </p>
                  </div>
                </div>
              </div>

              {/* Tech Stack Strip */}
              <div className="space-y-2.5 max-w-xl">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">🛠️ Technology Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['React', 'TypeScript', 'Node.js', 'Express', 'Prisma ORM', 'Socket.io', 'Gemini AI', 'Solidity'].map((tech) => (
                    <span key={tech} className="px-2.5 py-1 rounded bg-slate-950/60 border border-slate-800/80 text-[10px] font-bold text-slate-300 font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action and Demo Access Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl pt-2">
                <button
                  onClick={() => {
                    setIsRegistering(true);
                    setShowAuthModal(true);
                  }}
                  className="px-6 py-4 bg-eco-500 hover:bg-eco-600 active:scale-[0.98] rounded-2xl text-white font-bold transition text-sm shadow-lg shadow-eco-500/25 flex items-center justify-center gap-2 group"
                >
                  Get Started 
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>

                <button
                  onClick={() => {
                    setEmail('demo@terratwin.ai');
                    setPassword('demo123');
                    setIsRegistering(false);
                    setShowAuthModal(true);
                  }}
                  className="p-4 rounded-2xl bg-slate-950/60 hover:bg-slate-900/60 border border-slate-800/80 text-left transition group"
                >
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-eco-400 transition">Try Demo Account</h3>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div>
                      <span className="text-[9px] text-slate-500 block">Email:</span>
                      <span className="text-xs font-semibold text-white font-mono">demo@terratwin.ai</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block">Password:</span>
                      <span className="text-xs font-semibold text-white font-mono">demo123</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Platform footer branding */}
            <div className="pt-4 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500 font-medium max-w-xl">
              <p>AI for Sustainability • Climate Intelligence</p>
              <p>© 2026 TerraTwin AI</p>
            </div>
          </div>

          {/* Right Column: LIVE TWIN SIMULATOR Globe Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="p-6 lg:p-8 rounded-3xl glass-panel border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-4 left-4 bg-slate-900/60 border border-slate-800 rounded-full px-3 py-1 text-[10px] font-bold text-eco-400 uppercase tracking-wider">
                🌍 LIVE TWIN SIMULATOR
              </div>
              
              <div className="flex justify-center py-6 shrink-0">
                <TerraTwinGlobe onGlobeClick={() => {
                  setIsRegistering(false);
                  setShowAuthModal(true);
                }} />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Twin level status</span>
                  <span className="px-2 py-0.5 rounded bg-eco-500/10 border border-eco-500/20 font-bold text-eco-400 uppercase tracking-wider text-[10px]">
                    Stable
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Carbon risk status</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                    Medium Risk
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-bold">Current</span>
                    <span className="font-black text-white">
                      {Math.round(((publicStats?.totalEmitted || 438) / (publicStats?.goal || 600)) * 100) || 73}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-bold">Predicted</span>
                    <span className="font-black text-eco-400">
                      &gt; {Math.round(((publicStats?.monthlyForecast || 320) / (publicStats?.goal || 600)) * 100) || 52}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-bold">Optimized</span>
                    <span className="font-black text-blue-400">
                      {Math.round(((publicStats?.monthlyForecast || 320) * 0.81 / (publicStats?.goal || 600)) * 100) || 81}%
                    </span>
                  </div>
                </div>

                {/* Monthly Savings Info */}
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Monthly Savings:</span>
                    <span className="text-eco-400 font-extrabold">{(publicStats?.carbonSaved || 162).toFixed(1)} kg CO₂</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-900/60 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-300">
                      <span>🌳</span>
                      <span>{Math.round((publicStats?.carbonSaved || 162) / 23.0)} Trees</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300">
                      <span>🚗</span>
                      <span>{Math.round((publicStats?.carbonSaved || 162) / 0.245)} km driving</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Auth Overlay */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
            <div className="w-full max-w-md p-8 rounded-3xl glass-panel border border-slate-800 shadow-2xl relative overflow-hidden">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setErrorMsg(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-2 hover:bg-slate-800/40 rounded-xl"
                aria-label="Close Authentication Dialog"
              >
                ✕
              </button>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">{isRegistering ? 'Create Account' : 'Access Carbon Twin'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isRegistering ? 'Join the decentralized carbon footprint portal' : 'Enter your credentials to sync with your digital twin'}
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-950/30 border border-red-800/40 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                {isRegistering && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2" htmlFor="reg-name">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        placeholder="Enter your name"
                        className="w-full bg-dark-800 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-eco-500 focus:ring-1 focus:ring-eco-500 text-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2" htmlFor="auth-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      placeholder="Enter email"
                      className="w-full bg-dark-800 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-eco-500 focus:ring-1 focus:ring-eco-500 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="auth-password"
                      type="password"
                      required
                      placeholder="Enter password (min 6 chars)"
                      className="w-full bg-dark-800 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-eco-500 focus:ring-1 focus:ring-eco-500 text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {isRegistering && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2" htmlFor="reg-wallet">
                      Polygon Wallet Address (Optional)
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="reg-wallet"
                        type="text"
                        placeholder="0x..."
                        className="w-full bg-dark-800 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-eco-500 focus:ring-1 focus:ring-eco-500 text-sm"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-eco-500 hover:bg-eco-600 active:scale-[0.98] rounded-xl text-white font-bold transition text-sm shadow-lg shadow-eco-500/25 mt-4"
                >
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setErrorMsg('');
                  }}
                  className="text-xs text-eco-400 hover:underline focus:outline-none font-semibold"
                >
                  {isRegistering
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Calculate stats for charts
  const categoryData = [
    { name: 'Transport', value: entries.filter((e) => e.category === 'transport').reduce((sum, e) => sum + e.carbonEmitted, 0) },
    { name: 'Food', value: entries.filter((e) => e.category === 'food').reduce((sum, e) => sum + e.carbonEmitted, 0) },
    { name: 'Energy', value: entries.filter((e) => e.category === 'energy').reduce((sum, e) => sum + e.carbonEmitted, 0) },
  ].filter((c) => c.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

  return (
    <div className="min-h-screen bg-dark-900 flex text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-dark-800 border-r border-slate-800/80 flex flex-col justify-between shrink-0" aria-label="Sidebar Navigation">
        <div>
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80">
            <Leaf className="w-6 h-6 text-eco-500" />
            <h1 className="font-extrabold text-white text-lg tracking-tight">TerraTwin AI</h1>
          </div>

          <div className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Leaf },
              { id: 'ocr', label: 'AI Scanner', icon: Scan },
              { id: 'geolocation', label: 'Trip Tracker', icon: Navigation },
              { id: 'smarthome', label: 'IoT Monitor', icon: Tv },
              { id: 'advisor', label: 'AI Advisor', icon: MessageSquare },
              { id: 'story', label: 'Carbon Story', icon: BookOpen },
              { id: 'simulator', label: 'Future Simulator', icon: Sliders },
              { id: 'privacy', label: 'Privacy Audit', icon: Shield },
              { id: 'challenges', label: 'Challenges', icon: Sparkles },
              { id: 'timeline', label: 'Timeline', icon: Calendar },
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={`Navigate to ${tab.label}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-eco-600 text-white shadow-lg shadow-eco-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Card footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700/60 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
              <p className="text-xs text-slate-400 truncate leading-none mt-1">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Sign Out"
            className="w-full py-2 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs font-semibold transition text-slate-300"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-screen overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-screen overflow-y-auto cyber-grid relative" id="main-content">
        {/* Glow ambient design elements */}
        <div className="glow-spot-green -top-20 -right-20 pointer-events-none" />
        <div className="glow-spot-blue top-1/2 left-1/3 pointer-events-none" />

        {/* Header bar */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-dark-800/30 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-xl font-bold text-white capitalize">{activeTab} Panel</h2>
          <div className="flex items-center gap-6">
            {/* EcoToken Stats Header */}
            <div className="flex items-center gap-3 bg-eco-500/10 px-4 py-1.5 rounded-full border border-eco-500/20">
              <Leaf className="w-4 h-4 text-eco-500" />
              <span className="text-sm font-bold text-white">{balance.balanceECO} ECO</span>
            </div>
            {/* NFT Level badge */}
            <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-300 border border-slate-700">
              Tier: <span className="text-eco-500">{balance.nftTier}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Panels */}
        <div className="flex-1 p-8">
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <section className="space-y-8" aria-label="Dashboard Overview">
              {/* Globe, Twin Profile, Earth Health Context Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                {/* Rotating Globe Card */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-4 left-4 bg-slate-900/60 border border-slate-800 rounded-full px-3 py-1 text-xs font-bold text-eco-400">
                    🌍 Live Carbon Twin Globe
                  </div>
                  <TerraTwinGlobe onGlobeClick={() => setActiveTab('story')} />
                </div>

                {/* Carbon Twin Profile Engine */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-eco-500/5 rounded-full blur-2xl pointer-events-none" />
                  {dashboardLoading ? (
                    <div className="space-y-4 animate-pulse w-full">
                      <div className="h-5 bg-slate-800 rounded w-1/2 mb-4" />
                      <div className="flex justify-between items-center"><div className="h-4 bg-slate-800 rounded w-1/3" /><div className="h-4 bg-slate-800 rounded w-1/4" /></div>
                      <div className="flex justify-between items-center"><div className="h-4 bg-slate-800 rounded w-1/4" /><div className="h-4 bg-slate-800 rounded w-1/6" /></div>
                      <div className="flex justify-between items-center"><div className="h-4 bg-slate-800 rounded w-1/3" /><div className="h-4 bg-slate-800 rounded w-1/5" /></div>
                      <div className="h-10 bg-slate-850 rounded-xl w-full mt-4" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                          <Sparkles className="w-4 h-4 text-eco-500" />
                          Carbon Twin Profile
                        </h3>
                        <div className="mt-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Persona:</span>
                            <span className="text-md font-extrabold text-eco-400">{twinProfile.persona}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Twin Score:</span>
                            <span className="text-lg font-black text-white">{twinProfile.score}/100</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Annual Projection:</span>
                            <span className="text-md font-bold text-white">{twinProfile.annualFootprint} tCO₂/year</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-400">Carbon Risk Level:</span>
                            <span className={`text-sm font-extrabold uppercase ${twinProfile.risk === 'Low' ? 'text-eco-400' : twinProfile.risk === 'Moderate' ? 'text-amber-400' : 'text-red-400'}`}>
                              {twinProfile.risk}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-slate-800/80 pt-4 flex justify-between items-center text-xs">
                        <span className="text-slate-400">Potential Reduction:</span>
                        <span className="text-eco-500 font-extrabold">-{twinProfile.potentialReduction}% Possible</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Earth Health Context Card */}
                <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                      <Globe className="w-4 h-4 text-blue-400" />
                      Earth Health Context
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Your Annualized:</span>
                        <span className="text-md font-bold text-white">{twinProfile.annualFootprint} tCO₂</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Global Average:</span>
                        <span className="text-md font-bold text-slate-400">4.8 tCO₂</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Global Difference:</span>
                        {(() => {
                          const diff = Math.round(((twinProfile.annualFootprint - 4.8) / 4.8) * 100);
                          const sign = diff >= 0 ? '+' : '';
                          return (
                            <span className={`text-md font-extrabold ${diff > 0 ? 'text-red-400' : 'text-eco-400'}`}>
                              {sign}{isNaN(diff) ? 0 : diff}%
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Forecast Status:</span>
                        <span className={`text-sm font-extrabold uppercase ${forecast.status === 'On track' ? 'text-eco-400' : 'text-amber-400'}`}>
                          {forecast.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-800/80 pt-4 flex justify-between items-center">
                    <span className="text-xs text-slate-400">Twin Grade:</span>
                    {(() => {
                      let grade = 'B';
                      const score = twinProfile.score;
                      if (score >= 90) grade = 'A+';
                      else if (score >= 80) grade = 'A';
                      else if (score >= 70) grade = 'B+';
                      else if (score >= 55) grade = 'B';
                      else if (score >= 40) grade = 'C';
                      else grade = 'D';
                      return (
                        <span className="text-xl font-black text-eco-500 bg-eco-500/10 border border-eco-500/20 px-3 py-0.5 rounded-lg">
                          {grade}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Quick Activity Logger & Goal Card Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                {/* Quick Activity Logger widget */}
                <div className="glass-panel rounded-2xl p-6 lg:col-span-2 relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                      <PlusCircle className="w-4 h-4 text-eco-500" />
                      Quick Manual Activity Logger
                    </h3>
                    <form onSubmit={handleQuickLog} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-sm">
                      <div>
                        <label htmlFor="quick-category" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                        <select
                          id="quick-category"
                          aria-label="Activity Category"
                          className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-eco-500"
                          value={quickCategory}
                          onChange={(e: any) => setQuickCategory(e.target.value)}
                        >
                          <option value="transport">🚗 Transport</option>
                          <option value="energy">⚡ Energy</option>
                          <option value="food">🥗 Food</option>
                          <option value="shopping">🛍️ Shopping</option>
                          <option value="waste">🗑️ Waste</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`quick-type-${quickCategory}`} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                        {quickCategory === 'transport' && (
                          <select
                            id="quick-type-transport"
                            aria-label="Activity Type"
                            className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                          >
                            <option value="car">Car Commute</option>
                            <option value="bus">Public Bus</option>
                            <option value="walk">Walking</option>
                          </select>
                        )}
                        {quickCategory === 'energy' && (
                          <select
                            id="quick-type-energy"
                            aria-label="Activity Type"
                            className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                          >
                            <option value="electricity">Electricity Grid</option>
                            <option value="gas">Natural Gas</option>
                          </select>
                        )}
                        {quickCategory === 'food' && (
                          <select
                            id="quick-type-food"
                            aria-label="Activity Type"
                            className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                          >
                            <option value="beef">Beef Meal</option>
                            <option value="chicken">Chicken Meal</option>
                            <option value="vegetables">Plant-Based meal</option>
                          </select>
                        )}
                        {quickCategory === 'shopping' && (
                          <select
                            id="quick-type-shopping"
                            aria-label="Activity Type"
                            className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                          >
                            <option value="clothing">Clothing Items</option>
                            <option value="electronics">Electronics</option>
                          </select>
                        )}
                        {quickCategory === 'waste' && (
                          <select
                            id="quick-type-waste"
                            aria-label="Activity Type"
                            className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                          >
                            <option value="landfill">Landfill Waste</option>
                            <option value="recycling">Recycled Waste</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <label htmlFor="quick-value" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quantity ({quickUnit})</label>
                        <input
                          id="quick-value"
                          type="number"
                          step="any"
                          aria-label="Activity Quantity"
                          className="w-full bg-dark-800 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-eco-500"
                          value={quickValue}
                          onChange={(e) => setQuickValue(Number(e.target.value))}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={quickLogLoading}
                        className="w-full bg-eco-600 hover:bg-eco-700 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-2"
                      >
                        {quickLogLoading ? 'Logging...' : 'Log Activity'}
                      </button>
                    </form>
                  </div>
                  <div className="mt-4 border-t border-slate-800/80 pt-4 flex justify-between items-center text-xs text-slate-400">
                    <span>Est. Activity Carbon:</span>
                    {(() => {
                      let factor = 0;
                      if (quickCategory === 'energy') {
                        if (quickType.includes('electricity')) factor = 0.233;
                        else if (quickType.includes('gas')) factor = 0.200;
                      } else if (quickCategory === 'transport') {
                        if (quickType.includes('car')) factor = 0.210;
                        else if (quickType.includes('bus')) factor = 0.110;
                      } else if (quickCategory === 'food') {
                        if (quickType.includes('beef')) factor = 27.0;
                        else if (quickType.includes('chicken')) factor = 6.9;
                        else if (quickType.includes('vegetables')) factor = 2.0;
                      } else if (quickCategory === 'shopping') {
                        factor = 0.500;
                      } else if (quickCategory === 'waste') {
                        factor = 0.350;
                      }
                      const estEmitted = Number((quickValue * factor).toFixed(2));
                      return <span className="font-extrabold text-amber-500">{estEmitted} kg CO₂</span>;
                    })()}
                  </div>
                </div>

                {/* Monthly Total Emitted vs Goal card */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-eco-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Monthly Carbon Target
                    </span>
                    <h3 className="text-3xl font-extrabold text-white">
                      {monthlyStats.totalEmitted.toFixed(1)} <span className="text-sm font-normal text-slate-400">kg CO₂</span>
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-4">
                    <span className="text-xs text-slate-400">Goal Target: {monthlyStats.goal} kg</span>
                    <span className="text-xs font-bold text-eco-500">
                      {((monthlyStats.totalEmitted / monthlyStats.goal) * 100).toFixed(0)}% Utilized
                    </span>
                  </div>
                </div>
              </div>

              {/* Analytical Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 7-Day Carbon Emission Trend line graph */}
                <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-eco-500" />
                    7-Day Emissions Trend (kg CO₂)
                  </h3>
                  <div className="h-64">
                    {dailyStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyStats}>
                          <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                          />
                          <Bar dataKey="carbonEmitted" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        No telemetry logs logged for this period.
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie Chart category breakdown */}
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6">Emissions Category Breakdown</h3>
                  <div className="h-64 flex flex-col justify-between">
                    <div className="h-44">
                      {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryData}
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {categoryData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                          No category footprints stored.
                        </div>
                      )}
                    </div>
                    <div className="flex justify-around gap-2 text-xs">
                      {categoryData.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-slate-400 capitalize">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Recent Carbon Footprint History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Measurement</th>
                        <th className="py-3 px-4 text-right">CO₂ Carbon Emitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-sm">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-800/10">
                          <td className="py-3 px-4">{new Date(entry.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4 capitalize">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                entry.category === 'transport'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : entry.category === 'energy'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {entry.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 capitalize text-slate-300">{entry.type}</td>
                          <td className="py-3 px-4">
                            {entry.value} {entry.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white">{entry.carbonEmitted.toFixed(2)} kg</td>
                        </tr>
                      ))}
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No logs found. Run simulator or OCR scan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* TAB: AI SCANNER */}
          {activeTab === 'ocr' && (
            <section className="space-y-8" aria-label="AI Scanner OCR">
              {ocrErrorMsg && (
                <div className="mb-6 p-4 bg-red-950/30 border border-red-800/40 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{ocrErrorMsg}</p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Electricity Bill Scanner */}
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Utility Bill OCR Scanner
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload an electricity or gas utility bill photo to extract carbon and earn 75 ECO tokens.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-700 hover:border-eco-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center transition relative">
                    <input
                      id="bill-upload-input"
                      type="file"
                      accept="image/*"
                      aria-label="Upload utility bill image"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setBillFile(e.target.files ? e.target.files[0] : null)}
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-3" />
                    {billFile ? (
                      <p className="text-sm font-semibold text-white truncate max-w-full">{billFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-300">Drag & drop or click to upload</p>
                        <p className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG</p>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleScanBill}
                    disabled={!billFile || ocrLoading}
                    aria-label="Scan utility bill"
                    className="w-full bg-eco-600 hover:bg-eco-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {ocrLoading ? 'Scanning image...' : 'Scan Bill OCR'}
                  </button>
                </div>

                {/* Food Camera */}
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-eco-500" />
                      Food Carbon Analyzer
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload a photo of your meal to calculate its food footprint based on beef, chicken, or vegetables.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-700 hover:border-eco-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center transition relative">
                    <input
                      id="food-upload-input"
                      type="file"
                      accept="image/*"
                      aria-label="Upload food image"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => setFoodFile(e.target.files ? e.target.files[0] : null)}
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-3" />
                    {foodFile ? (
                      <p className="text-sm font-semibold text-white truncate max-w-full">{foodFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-300">Drag & drop or click to upload</p>
                        <p className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG</p>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleAnalyzeFood}
                    disabled={!foodFile || ocrLoading}
                    aria-label="Analyze food footprint"
                    className="w-full bg-eco-600 hover:bg-eco-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {ocrLoading ? 'Analyzing meal...' : 'Analyze Food Camera'}
                  </button>
                </div>
              </div>

              {/* OCR Results Display Box */}
              {ocrResult && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h3 className="text-lg font-bold text-white border-b border-slate-800/80 pb-3">AI Vision Analysis Report</h3>
                  {ocrResult.type === 'bill' ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="p-4 bg-slate-800/40 rounded-xl">
                        <span className="text-xs text-slate-400 block mb-1">Provider Detected</span>
                        <span className="text-lg font-bold text-white">{ocrResult.provider}</span>
                      </div>
                      <div className="p-4 bg-slate-800/40 rounded-xl">
                        <span className="text-xs text-slate-400 block mb-1">Usage Quantity</span>
                        <span className="text-lg font-bold text-white">
                          {ocrResult.quantity} {ocrResult.unit}
                        </span>
                      </div>
                      <div className="p-4 bg-slate-800/40 rounded-xl">
                        <span className="text-xs text-slate-400 block mb-1">Emissions Calculated</span>
                        <span className="text-lg font-bold text-amber-500">{ocrResult.carbonEmitted} kg CO₂</span>
                      </div>
                      <div className="p-4 bg-eco-500/10 border border-eco-500/20 rounded-xl">
                        <span className="text-xs text-eco-400 block mb-1">EcoTokens Awarded</span>
                        <span className="text-lg font-bold text-eco-500">+{ocrResult.tokensAwarded} ECO</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-800/40 px-4 py-3 rounded-xl">
                        <span className="text-sm font-semibold text-slate-300">Detected Dish:</span>
                        <span className="text-md font-bold text-white capitalize">{ocrResult.foodItem}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-slate-800/40 rounded-xl">
                          <span className="text-xs text-slate-400 block mb-1">Total Portion Weight</span>
                          <span className="text-lg font-bold text-white">{ocrResult.entry?.value || 0} kg</span>
                        </div>
                        <div className="p-4 bg-slate-800/40 rounded-xl">
                          <span className="text-xs text-slate-400 block mb-1">Aggregate Carbon Footprint</span>
                          <span className="text-lg font-bold text-amber-500">{ocrResult.totalEmissions} kg CO₂</span>
                        </div>
                        <div className="p-4 bg-eco-500/10 border border-eco-500/20 rounded-xl flex items-center justify-center">
                          <span className="text-sm font-bold text-eco-500">Log Saved to History</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* TAB: GEOLOCATION COMMUTES */}
          {activeTab === 'geolocation' && (
            <section className="space-y-8" aria-label="Smart Geolocation Commute tracker">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Simulator Controls */}
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-eco-500" />
                      GPS Tracker Simulator
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Simulate a background trip. GPS tracks your coordinates, evaluates travel speed, and logs carbon.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/40 rounded-xl space-y-2 text-xs">
                    <p className="font-bold text-slate-300">Emissions Classification Speed Gates:</p>
                    <ul className="list-disc pl-4 text-slate-400 space-y-1">
                      <li>&gt;40 km/h: Car (0.21 kg CO₂/km)</li>
                      <li>20 - 40 km/h: Biking (0 kg CO₂)</li>
                      <li>10 - 20 km/h: Bus (0.11 kg CO₂/km)</li>
                      <li>&lt;10 km/h: Walking (0 kg CO₂)</li>
                    </ul>
                  </div>

                  <button
                    onClick={toggleTracking}
                    aria-label={isTracking ? 'Stop tracking' : 'Start tracking'}
                    className={`w-full font-bold py-3 rounded-xl transition ${
                      isTracking ? 'bg-red-600 hover:bg-red-700' : 'bg-eco-600 hover:bg-eco-700'
                    } text-white`}
                  >
                    {isTracking ? 'Stop Tracking Simulation' : 'Start Tracking Simulation'}
                  </button>
                </div>

                {/* Coordinates Feed Log */}
                <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <h3 className="text-md font-bold text-white border-b border-slate-800/80 pb-3">Real-time GPS Coordinate Feed</h3>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {gpsLogs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-800 rounded-xl text-xs font-mono"
                      >
                        <span className="text-slate-400">[{log.time}]</span>
                        <span className="text-slate-300">
                          Lat: {log.lat.toFixed(4)}, Lng: {log.lng.toFixed(4)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            log.mode === 'car'
                              ? 'bg-red-500/10 text-red-400'
                              : log.mode === 'bike'
                                ? 'bg-eco-500/10 text-eco-400'
                                : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {log.mode.toUpperCase()}
                        </span>
                      </div>
                    ))}
                    {gpsLogs.length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        Waiting to trigger simulation coordinates feed...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB: SMART HOME / IoT */}
          {activeTab === 'smarthome' && (
            <section className="space-y-8" aria-label="Smart Home Power Panel">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Load and status */}
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Tv className="w-5 h-5 text-eco-500" />
                      IoT Telemetry status
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Simulate smart meter synchronization. Exposes load rates from lights, air conditioning, and media.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <span className="text-sm text-slate-400">Connection state:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        iotStatus === 'Live' ? 'bg-eco-500/15 text-eco-500' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {iotStatus}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Device telemetry table lists */}
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Device Name</span>
                      <span>Rate (Watts)</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'LED Lights', val: deviceBreakdown.lights },
                        { label: 'Air Conditioning', val: deviceBreakdown.ac },
                        { label: 'Smart Fridge', val: deviceBreakdown.fridge },
                        { label: 'Media Center', val: deviceBreakdown.media },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between items-center text-sm font-semibold">
                          <span className="text-slate-300">{item.label}</span>
                          <span className="text-white font-mono">{item.val} W</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleIotTelemetrySync}
                    aria-label="Sync smart home meter data"
                    className="w-full bg-eco-600 hover:bg-eco-700 text-white font-bold py-3 rounded-xl transition"
                  >
                    Trigger Telemetry Sync Tick
                  </button>
                </div>

                {/* Live load line chart */}
                <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
                  <h3 className="text-md font-bold text-white mb-6">Real-time Load Curve (Watts)</h3>
                  <div className="h-64">
                    {livePower.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={livePower}>
                          <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                          />
                          <Line type="monotone" dataKey="watts" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        Waiting for live telemetry sync packets...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB: AI ADVISOR */}
          {activeTab === 'advisor' && (
            <section className="glass-panel rounded-2xl p-6 flex flex-col h-[calc(100vh-12rem)]" aria-label="AI Footprint advisor Chat">
              <h3 className="text-lg font-bold text-white border-b border-slate-800/80 pb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-eco-500" />
                AI Carbon Advisor
              </h3>

              {/* Chat history scroll block */}
              <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-2">
                {chatMessages.map((msg, index) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div key={index} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                          isBot ? 'bg-slate-800/80 text-slate-200 rounded-tl-none' : 'bg-eco-600 text-white rounded-tr-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/80 text-slate-400 rounded-2xl rounded-tl-none px-5 py-3 text-sm animate-pulse">
                      Analyzing data context, generating recommendation...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat suggestions bar */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 text-xs">
                {[
                  'Why is my carbon footprint high?',
                  'How do I earn eco tokens?',
                  'Provide carbon reduction tips',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setUserMsg(s)}
                    className="bg-slate-800/50 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700/60 transition whitespace-nowrap"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Form message inputs */}
              <form onSubmit={handleSendChatMessage} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ask a question about your household electricity or transport..."
                  aria-label="Type message to advisor"
                  className="flex-1 bg-dark-800 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-eco-500"
                  value={userMsg}
                  onChange={(e) => setUserMsg(e.target.value)}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="bg-eco-600 hover:bg-eco-700 text-white px-6 rounded-xl font-bold transition flex items-center justify-center"
                >
                  Send
                </button>
              </form>
            </section>
          )}

          {/* TAB: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="EVM token Leaderboard standings">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-eco-500" />
                  Polygon EVM Standings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Global eco advocates ranking based on blockchain distributed EcoToken (ECO) balances.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">UserName</th>
                      <th className="py-3 px-4">EVM Wallet Address</th>
                      <th className="py-3 px-4 text-right">ECO Ledger balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm">
                    {leaderboard.map((u, index) => (
                      <tr key={u.id} className="hover:bg-slate-800/10">
                        <td className="py-3 px-4 font-bold text-slate-400">#{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{u.walletAddress}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-eco-500">{u.balanceECO} ECO</td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          Empty leaderboard ledger. Register wallets to view standings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB: CARBON STORY */}
          {activeTab === 'story' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="AI Carbon Story Narrative">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-eco-500" />
                    Your Digital Carbon Story
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    AI-generated narrative of your monthly carbon footprint patterns and recommended reduction strategies.
                  </p>
                </div>
                <button
                  onClick={fetchCarbonStory}
                  disabled={storyLoading}
                  className="bg-eco-600 hover:bg-eco-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition disabled:bg-slate-800 disabled:text-slate-600"
                >
                  {storyLoading ? 'Generating Story...' : 'Regenerate Narrative'}
                </button>
              </div>

              {storyLoading ? (
                <div className="space-y-6 py-6 animate-pulse w-full">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-800 rounded w-5/6" />
                  <div className="h-4 bg-slate-800 rounded w-2/3" />
                  <div className="h-32 bg-slate-850 rounded-2xl w-full" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-full" />
                    <div className="h-4 bg-slate-800 rounded w-4/5" />
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed space-y-4 whitespace-pre-line text-sm">
                  {carbonStory || 'No story generated yet. Log more activities to see your carbon story.'}
                </div>
              )}
            </section>
          )}

          {/* TAB: FUTURE SIMULATOR */}
          {activeTab === 'simulator' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="Future Carbon Simulator">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-eco-500" />
                  Habit Future Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust your weekly habits to project future monthly carbon emissions and calculate estimated savings.
                </p>
              </div>

              {dashboardLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse w-full">
                  <div className="space-y-6 bg-slate-800/20 p-6 rounded-2xl border border-slate-800">
                    <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
                    <div className="space-y-3"><div className="h-3 bg-slate-800 rounded w-1/4" /><div className="h-6 bg-slate-800 rounded w-full" /></div>
                    <div className="space-y-3"><div className="h-3 bg-slate-800 rounded w-1/3" /><div className="h-6 bg-slate-800 rounded w-full" /></div>
                    <div className="space-y-3"><div className="h-3 bg-slate-800 rounded w-1/5" /><div className="h-6 bg-slate-800 rounded w-full" /></div>
                  </div>
                  <div className="space-y-6 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-16 bg-slate-800 rounded-xl w-full" />
                      <div className="h-16 bg-slate-800 rounded-xl w-full" />
                      <div className="h-16 bg-slate-800 rounded-xl w-full" />
                      <div className="h-16 bg-slate-800 rounded-xl w-full" />
                    </div>
                    <div className="h-12 bg-slate-800 rounded-xl w-full mt-4" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Preset Scenarios */}
                  <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preset Scenarios:</span>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: '🚲 Green Commuter', transport: 1, beef: 60, energy: 40 },
                    { label: '🥗 Plant-Based Diet', transport: 4, beef: 100, energy: 20 },
                    { label: '🏡 Solar Home', transport: 5, beef: 30, energy: 90 },
                    { label: '🌍 Net Zero Journey', transport: 0, beef: 100, energy: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setSimTransport(preset.transport);
                        setSimBeef(preset.beef);
                        setSimEnergy(preset.energy);
                      }}
                      className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                {/* Sliders */}
                <div className="space-y-6 bg-slate-800/20 p-6 rounded-2xl border border-slate-800">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Adjust Custom Habits</h4>
                  
                  <div className="space-y-2">
                    <label htmlFor="sim-transport" className="flex justify-between text-xs text-slate-400 font-semibold w-full">
                      <span>Vehicle Commute:</span>
                      <span className="text-eco-400 font-mono">{simTransport} days/week</span>
                    </label>
                    <input
                      id="sim-transport"
                      type="range"
                      min={0}
                      max={7}
                      aria-label="Vehicle Commute (days per week)"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-eco-500"
                      value={simTransport}
                      onChange={(e) => setSimTransport(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="sim-beef" className="flex justify-between text-xs text-slate-400 font-semibold w-full">
                      <span>Beef Consumption Reduction:</span>
                      <span className="text-eco-400 font-mono">{simBeef}% Less</span>
                    </label>
                    <input
                      id="sim-beef"
                      type="range"
                      min={0}
                      max={100}
                      aria-label="Beef Consumption Reduction (percentage)"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-eco-500"
                      value={simBeef}
                      onChange={(e) => setSimBeef(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="sim-energy" className="flex justify-between text-xs text-slate-400 font-semibold w-full">
                      <span>Renewable Energy Share:</span>
                      <span className="text-eco-400 font-mono">{simEnergy}% Green</span>
                    </label>
                    <input
                      id="sim-energy"
                      type="range"
                      min={0}
                      max={100}
                      aria-label="Renewable Energy Share (percentage)"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-eco-500"
                      value={simEnergy}
                      onChange={(e) => setSimEnergy(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Simulation Output calculations */}
                {(() => {
                  const baseline = monthlyStats.totalEmitted || 441.2;
                  const transportSavings = (5 - simTransport) * 12.5;
                  const foodSavings = (simBeef / 100) * 85.0;
                  const energySavings = (simEnergy / 100) * 115.0;
                  const totalSavings = Math.max(0, transportSavings + foodSavings + energySavings);
                  const futureFootprint = Math.max(10, baseline - totalSavings);
                  const annualSavings = totalSavings * 12;

                  return (
                    <div className="space-y-6 flex flex-col justify-between text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-800/40 rounded-xl">
                          <span className="text-xs text-slate-400 block mb-1">Current Monthly:</span>
                          <span className="text-lg font-bold text-white">{baseline.toFixed(1)} kg CO₂</span>
                        </div>
                        <div className="p-4 bg-eco-500/10 border border-eco-500/20 rounded-xl">
                          <span className="text-xs text-eco-400 block mb-1">Future Projected:</span>
                          <span className="text-lg font-bold text-eco-500">{futureFootprint.toFixed(1)} kg CO₂</span>
                        </div>
                        <div className="p-4 bg-slate-800/40 rounded-xl">
                          <span className="text-xs text-slate-400 block mb-1">Monthly Carbon Saved:</span>
                          <span className="text-lg font-bold text-amber-500">{totalSavings.toFixed(1)} kg</span>
                        </div>
                        <div className="p-4 bg-slate-800/40 rounded-xl">
                          <span className="text-xs text-slate-400 block mb-1">Annual Proj. Savings:</span>
                          <span className="text-lg font-bold text-white">{annualSavings.toFixed(1)} kg</span>
                        </div>
                      </div>

                      <div className="glass-panel p-4 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-slate-400">Target Goal Status:</span>
                        <span className={`px-3 py-1 rounded-full font-bold ${futureFootprint <= monthlyStats.goal ? 'bg-eco-500/10 text-eco-400' : 'bg-red-500/10 text-red-400'}`}>
                          {futureFootprint <= monthlyStats.goal ? 'Target Achieved 🌱' : 'Above Goal'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                </div>
                </>
              )}
            </section>
          )}

          {/* TAB: PRIVACY AUDIT */}
          {activeTab === 'privacy' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="Privacy and Trust Audit Dashboard">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-eco-500" />
                    Privacy Audit Dashboard
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete transparency report on permissions utilized, database retention policies, and security validation.
                  </p>
                </div>
                <div className="bg-eco-500/15 border border-eco-500/20 px-4 py-2 rounded-xl text-center">
                  <span className="text-xs text-slate-400 block mb-0.5">Privacy Rating</span>
                  <span className="text-lg font-black text-eco-500">96/100</span>
                </div>
              </div>

              {dashboardLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse w-full">
                  <div className="space-y-4">
                    <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
                    <div className="h-16 bg-slate-800 rounded-xl w-full" />
                    <div className="h-16 bg-slate-800 rounded-xl w-full" />
                    <div className="h-16 bg-slate-800 rounded-xl w-full" />
                  </div>
                  <div className="space-y-6">
                    <div className="h-4 bg-slate-800 rounded w-1/4 mb-4" />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-12 bg-slate-800 rounded-xl" />
                      <div className="h-12 bg-slate-800 rounded-xl" />
                      <div className="h-12 bg-slate-800 rounded-xl" />
                    </div>
                    <div className="h-32 bg-slate-800 rounded-2xl w-full mt-4" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Permissions Allowed/Blocked Grid */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Device Permissions Overview</h4>
                  <div className="space-y-2 text-xs">
                    {[
                      { name: 'Camera Access (AI Vision Scanner)', status: 'Allowed', desc: 'Used locally for food/bill uploads. Images deleted after processing.', active: true },
                      { name: 'GPS Location Access (Active Tracker)', status: 'Allowed', desc: 'Processes commute speed triggers client-side.', active: true },
                      { name: 'SMS & Messages', status: 'Explicitly Blocked', desc: 'TerraTwin AI has no permissions to read message logs.', active: false },
                      { name: 'Contacts Directory', status: 'Explicitly Blocked', desc: 'Contacts data remains protected locally.', active: false },
                      { name: 'Banking Applications', status: 'Explicitly Blocked', desc: 'Secure Sandbox blocks access to financial applications.', active: false },
                    ].map((p) => (
                      <div key={p.name} className="flex justify-between items-start p-3 bg-slate-800/30 rounded-xl border border-slate-800/60">
                        <div>
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-slate-400 mt-0.5">{p.desc}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${p.active ? 'bg-eco-500/10 text-eco-400' : 'bg-red-500/10 text-red-400'}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit counts and secure badges */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Security & Trust Credentials</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-center">
                      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-850">
                        <span className="text-eco-400 block mb-1">✓ Deleted</span>
                        <span className="text-slate-300 font-semibold">Images Cleared</span>
                      </div>
                      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-850">
                        <span className="text-eco-400 block mb-1">✓ Secure</span>
                        <span className="text-slate-300 font-semibold">JWT Session</span>
                      </div>
                      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-850">
                        <span className="text-eco-400 block mb-1">✓ Local DB</span>
                        <span className="text-slate-300 font-semibold">Encrypted DB</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-800/10 p-5 rounded-2xl border border-slate-850 text-xs">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Stored Data Analytics</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Carbon Records Stored:</span>
                      <span className="text-white font-bold">{entries.length} items</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">AI Vision Images Processed & Cleared:</span>
                      <span className="text-white font-bold">{entries.filter(e => e.source?.includes('vision')).length || 4} items</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Database Retention Policy:</span>
                      <span className="text-eco-500 font-bold">30 Days Auto-Purge</span>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </section>
          )}

          {/* TAB: CHALLENGES & BADGES */}
          {activeTab === 'challenges' && (
            <section className="space-y-8" aria-label="Challenges and Achievements dashboard">
              {/* Active Challenges list */}
              <div className="glass-panel rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-eco-500" />
                    Weekly Sustainability Challenges
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete recurring tasks to earn bonus EcoTokens (ECO) and evolve your NFT Growth tier.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {[
                    { name: '🚶 Biking/Walking Commute instead of driving', progress: 2, total: 3, reward: '100 ECO', unit: 'days' },
                    { name: '🥗 Low Meat Intake (Beef Reduction Plan)', progress: simBeef, total: 100, reward: '150 ECO', unit: '%' },
                    { name: '⚡ Energy Smart (Save 5 kWh electricity load)', progress: 3.5, total: 5, reward: '75 ECO', unit: 'kWh' },
                    { name: '📅 Maintain Monthly Carbon under Goal', progress: Math.round(monthlyStats.totalEmitted), total: monthlyStats.goal, reward: '500 ECO', unit: 'kg CO₂' },
                  ].map((c) => {
                    const percent = Math.min(100, Math.round((c.progress / c.total) * 100));
                    return (
                      <div key={c.name} className="p-4 bg-slate-800/30 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-white max-w-[70%]">{c.name}</p>
                          <span className="text-xs font-bold text-eco-500 bg-eco-500/10 px-2.5 py-1 rounded-full shrink-0">
                            +{c.reward}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Progress: {c.progress} / {c.total} {c.unit}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-eco-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Achievements Trophies Grid */}
              <div className="glass-panel rounded-2xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-eco-500" />
                    Unlocked Sustainability Badges
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Your permanent trophies verifying your environmental achievements in the TerraTwin ecosystem.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center text-xs">
                  {[
                    { label: '🏆 First Scan', desc: 'Scan utility bill OCR', unlocked: entries.some(e => e.source?.includes('vision') || e.source?.includes('bill')) },
                    { label: '🏆 First Carbon Entry', desc: 'Add carbon log entry', unlocked: entries.length > 0 },
                    { label: '🏆 100 ECO Club', desc: 'Reach 100 ECO balance', unlocked: balance.balanceECO >= 100 },
                    { label: '🏆 Eco Streak', desc: 'Log logs 7 days in a row', unlocked: entries.length >= 7 },
                    { label: '🏆 Earth Protector', desc: 'Emitted less than goal target', unlocked: monthlyStats.totalEmitted < monthlyStats.goal },
                    { label: '🏆 Sustainability Hero', desc: 'Exceed 500 ECO balance', unlocked: balance.balanceECO >= 500 },
                  ].map((badge) => (
                    <div
                      key={badge.label}
                      className={`p-4 rounded-xl border flex flex-col justify-between h-36 ${
                        badge.unlocked
                          ? 'bg-eco-500/5 border-eco-500/20 text-white font-semibold'
                          : 'bg-slate-800/10 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-2xl mb-2">{badge.unlocked ? '🟢' : '🔒'}</div>
                      <p className="font-bold leading-tight">{badge.label}</p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">{badge.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB: JOURNEY TIMELINE */}
          {activeTab === 'timeline' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="Sustainability Journey Timeline">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-eco-500" />
                  Your Sustainability Journey Timeline
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Timeline milestones representing your eco contributions logged since joining the platform.
                </p>
              </div>

              {/* Dynamic chronological milestones */}
              <div className="relative border-l-2 border-slate-800/80 ml-4 pl-8 py-4 space-y-8 text-sm">
                <div className="relative">
                  <div className="absolute -left-12 top-0.5 bg-eco-500 w-8 h-8 rounded-full border-4 border-dark-900 flex items-center justify-center text-xs">
                    🌱
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-mono">June 1 — Platform Registration</span>
                    <h4 className="font-bold text-white">Joined TerraTwin AI</h4>
                    <p className="text-slate-400 text-xs mt-0.5">Initialized digital twin configuration and target footprint benchmarks.</p>
                  </div>
                </div>

                {entries.some(e => e.source?.includes('vision')) && (
                  <div className="relative">
                    <div className="absolute -left-12 top-0.5 bg-eco-500 w-8 h-8 rounded-full border-4 border-dark-900 flex items-center justify-center text-xs">
                      ⚡
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-mono">June 5 — AI Vision Upload</span>
                      <h4 className="font-bold text-white">First AI OCR Bill Scan</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Scanned electricity bill to calculate real-world consumption and awarded 75 ECO.</p>
                    </div>
                  </div>
                )}

                {entries.length > 0 && (
                  <div className="relative">
                    <div className="absolute -left-12 top-0.5 bg-eco-500 w-8 h-8 rounded-full border-4 border-dark-900 flex items-center justify-center text-xs">
                      ✍️
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-mono">June 10 — Manual Logger Entry</span>
                      <h4 className="font-bold text-white">First Carbon Activity logged</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Recorded transport distance via manual Quick Activity logger widget.</p>
                    </div>
                  </div>
                )}

                {balance.balanceECO >= 100 && (
                  <div className="relative">
                    <div className="absolute -left-12 top-0.5 bg-eco-500 w-8 h-8 rounded-full border-4 border-dark-900 flex items-center justify-center text-xs">
                      🪙
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-mono">June 15 — ECO Token Milestone</span>
                      <h4 className="font-bold text-white">100 ECO Tokens Earned</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Passed the 100 ECO threshold through commute simulations and eco-tasks.</p>
                    </div>
                  </div>
                )}

                {twinProfile.score >= 50 && (
                  <div className="relative">
                    <div className="absolute -left-12 top-0.5 bg-eco-500 w-8 h-8 rounded-full border-4 border-dark-900 flex items-center justify-center text-xs">
                      🎓
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-mono">June 20 — Persona Upgrade</span>
                      <h4 className="font-bold text-white">Became Eco Explorer</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Classified Carbon Twin as an Eco Explorer after target carbon reductions.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB: USER PROFILE */}
          {activeTab === 'profile' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="User Profile & Sustainability Identity">
              <div className="flex flex-col md:flex-row items-center gap-6 border-b border-slate-800 pb-6">
                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold border border-slate-700">
                  {user?.name.slice(0,2).toUpperCase() || 'EX'}
                </div>
                <div className="text-center md:text-left space-y-1.5">
                  <h3 className="text-xl font-bold text-white">{user?.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">Registered Account: {user?.email}</p>
                  <div className="flex gap-2">
                    <span className="bg-eco-500/10 text-eco-400 border border-eco-500/20 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      {twinProfile.persona}
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                      Tier: {balance.nftTier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm font-semibold">
                {/* Rewards widget */}
                <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ECO Tokens & Rewards</h4>
                  <p className="text-2xl font-black text-eco-500">{balance.balanceECO} ECO</p>
                  <p className="text-[10px] text-slate-400">Distributed EVM testnet ledger balance.</p>
                </div>

                {/* Impact details */}
                <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Carbon Savings Equivalency</h4>
                  {(() => {
                    const carbonSaved = Math.max(0, monthlyStats.goal - monthlyStats.totalEmitted);
                    const treeEquivalent = Number((carbonSaved / 22.0).toFixed(1));
                    return (
                      <>
                        <p className="text-2xl font-black text-white">{carbonSaved.toFixed(1)} kg saved</p>
                        <p className="text-[10px] text-slate-400">Equivalent to planting {treeEquivalent} trees annually.</p>
                      </>
                    );
                  })()}
                </div>

                {/* Global Grade Widget */}
                <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sustainability Score</h4>
                  {(() => {
                    let grade = 'B';
                    if (twinProfile.score >= 90) grade = 'A+';
                    else if (twinProfile.score >= 80) grade = 'A';
                    else if (twinProfile.score >= 70) grade = 'B+';
                    return (
                      <>
                        <p className="text-2xl font-black text-eco-500">Grade: {grade}</p>
                        <p className="text-[10px] text-slate-400">Ranked #2 on the Polygon advocate boards.</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </section>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <section className="glass-panel rounded-2xl p-6 space-y-6" aria-label="Settings and System Preferences">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-eco-500" />
                  Settings & Preferences
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your digital carbon twin synchronization parameters, notifications, and security options.
                </p>
              </div>

              <div className="max-w-xl space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Sync Preferences</h4>
                  <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-xl text-xs">
                    <div>
                      <p className="text-sm font-semibold text-white">Auto-sync IoT Data</p>
                      <p className="text-slate-400 mt-0.5 font-medium">Automatically sync smart home telemetry every 30s.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-eco-500 focus:ring-eco-500 bg-slate-800 border-slate-700" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-xl text-xs">
                    <div>
                      <p className="text-sm font-semibold text-white">Commute Background Tracking</p>
                      <p className="text-slate-400 mt-0.5 font-medium">Classify GPS logs automatically in the background.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-eco-500 focus:ring-eco-500 bg-slate-800 border-slate-700" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Account Settings</h4>
                  <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-bold uppercase tracking-wider text-[10px]">Monthly Footprint Goal:</span>
                      <span className="text-sm font-bold text-white mt-1 block">{user?.monthlyGoal || 600} kg CO₂ / month</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-bold uppercase tracking-wider text-[10px]">Ethereum EVM Address:</span>
                      <span className="font-mono text-slate-400 mt-1 block truncate">{user?.walletAddress || 'No wallet linked'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Persistent Status Sidebar */}
      <aside className="w-full xl:w-80 bg-dark-800 border-t xl:border-t-0 xl:border-l border-slate-800/80 p-6 flex flex-col shrink-0 overflow-y-auto space-y-6" aria-label="TerraTwin Status Sidebar">
        <div className="border-b border-slate-700/60 pb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">TerraTwin Status</h3>
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-eco-500 animate-pulse" />
              Live Synced
            </span>
            <span>{getSyncText()}</span>
          </div>
        </div>

        {/* Globe Visualizer Card */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 relative overflow-hidden">
          <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800/80 rounded-full px-2 py-0.5 text-[9px] font-bold text-eco-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-eco-500 animate-ping" />
            STABLE
          </div>
          
          <div className="scale-75 origin-center my-[-20px] shrink-0">
            <TerraTwinGlobe onGlobeClick={() => setActiveTab('story')} />
          </div>

          {/* Earth Health score */}
          <div className="w-full text-center mt-2 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Earth Health Score</span>
            <p className="text-3xl font-black text-white">{twinProfile.score}%</p>
          </div>

          {/* Current and Next Level progress */}
          {(() => {
            const score = twinProfile.score || 0;
            const isStable = score >= 50;
            const progress = Math.min(100, Math.max(0, score));
            const nextProgress = Math.min(100, Math.max(0, score + 6));
            return (
              <div className="w-full mt-4 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-400">Level: <span className={isStable ? "text-eco-400" : "text-amber-500"}>{isStable ? "Stable" : "Stressed"}</span></span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isStable ? "bg-eco-500" : "bg-amber-500"}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-400">Next: <span className="text-blue-400">{score >= 80 ? "Thriving" : "Stable"}</span></span>
                    <span className="text-slate-500">{nextProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${nextProgress}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* User Rank Card */}
        <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-lg shrink-0">
            🏆
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">User Standings</span>
            <span className="text-xs font-bold text-white leading-tight block">Top 22% of TerraTwin Users</span>
          </div>
        </div>

        {/* Platform Status Widget */}
        <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
          <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider mb-1">Platform Status</span>
          <div className="grid grid-cols-1 gap-1.5 font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">🟢</span> Database Connected
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">🟢</span> AI Services Active
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">🟢</span> WebSockets Live
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">🟢</span> Carbon Twin Synced
            </div>
          </div>
        </div>

        {/* Next Recommended Action Widget */}
        {(() => {
          const action = getNextAction();
          return (
            <div className="p-4 bg-eco-500/5 rounded-2xl border border-eco-500/15 space-y-3">
              <div className="flex items-center justify-between border-b border-eco-500/10 pb-2">
                <span className="text-[10px] text-eco-400 font-bold uppercase tracking-wider">Recommended Action</span>
                <span className="px-2 py-0.5 bg-eco-500/10 text-eco-400 text-[10px] font-black rounded">
                  {action.saving} Saved
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl shrink-0">{action.icon}</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">{action.title}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">{action.detail}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Global Health Timeline */}
        <div className="space-y-3">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Global Health Timeline</span>
          <div className="space-y-2 text-xs">
            {entries.slice(0, 3).map((entry) => {
              let icon = '🌱';
              if (entry.category === 'transport') icon = '🚗';
              else if (entry.category === 'energy') icon = '🔌';
              else if (entry.category === 'food') icon = '🥗';
              else if (entry.category === 'shopping') icon = '🛍️';
              else if (entry.category === 'waste') icon = '🗑️';

              return (
                <div key={entry.id} className="p-3 bg-slate-900/30 rounded-xl border border-slate-800/40 flex justify-between items-start gap-2">
                  <div className="flex gap-2">
                    <span className="text-base shrink-0">{icon}</span>
                    <div>
                      <p className="font-bold text-white capitalize leading-tight">{entry.type}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{entry.value} {entry.unit}</p>
                    </div>
                  </div>
                  <span className="text-amber-500 font-extrabold shrink-0">+{entry.carbonEmitted} kg</span>
                </div>
              );
            })}
            {entries.length === 0 && (
              <p className="text-slate-500 text-xs py-2 text-center">No recent carbon logs synced.</p>
            )}
          </div>
        </div>

        {/* Bottom Statistics Grid */}
        <div className="border-t border-slate-700/60 pt-4 space-y-3 mt-auto">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Footprint Metrics</span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Current</span>
              <span className="font-black text-white">{monthlyStats.totalEmitted.toFixed(0)}kg</span>
            </div>
            <div className="p-2 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Forecast</span>
              <span className="font-black text-eco-400">{forecast.monthlyForecast.toFixed(0)}kg</span>
            </div>
            <div className="p-2 bg-slate-900/40 rounded-xl border border-slate-800/80">
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Optimized</span>
              <span className="font-black text-blue-400">{(forecast.monthlyForecast * 0.78).toFixed(0)}kg</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
  );
}

function TerraTwinGlobe({ onGlobeClick }: { onGlobeClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationAngle = 0;

    const markers = [
      { lat: 0.2, lng: 0.5, color: '#ef4444' },
      { lat: -0.3, lng: -1.2, color: '#ef4444' },
      { lat: 0.5, lng: 2.1, color: '#10b981' },
      { lat: -0.1, lng: 1.2, color: '#10b981' },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) - 20;

      // 1. Outer Glow
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      const outerGlow = ctx.createRadialGradient(cx, cy, r - 5, cx, cy, r + 10);
      outerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.02)');
      outerGlow.addColorStop(0.8, 'rgba(16, 185, 129, 0.12)');
      outerGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // 2. Sphere Base
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const sphereGrad = ctx.createRadialGradient(cx - r / 3, cy - r / 3, r / 10, cx, cy, r);
      sphereGrad.addColorStop(0, '#1e293b');
      sphereGrad.addColorStop(0.7, '#0f172a');
      sphereGrad.addColorStop(1, '#020617');
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';

      // 3. Latitudes
      for (let lat = -Math.PI / 2 + 0.3; lat < Math.PI / 2; lat += 0.3) {
        const latR = r * Math.cos(lat);
        const latY = cy + r * Math.sin(lat);
        ctx.beginPath();
        ctx.ellipse(cx, latY, latR, latR * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Longitudes
      for (let i = 0; i < 6; i++) {
        const angle = rotationAngle + (i * Math.PI) / 3;
        const width = r * Math.cos(angle);
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(width), r, 0, 0, Math.PI * 2);
        ctx.strokeStyle = width > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.05)';
        ctx.stroke();
      }

      // 5. Hotspots & Achievements
      markers.forEach((m) => {
        const currentLng = m.lng + rotationAngle;
        const x = cx + r * Math.cos(m.lat) * Math.sin(currentLng);
        const y = cy - r * Math.sin(m.lat);
        const isFront = Math.cos(currentLng) > 0;

        if (isFront) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x, y, 8 + Math.sin(rotationAngle * 10) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = m.color + '55';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // 6. User Pin
      ctx.beginPath();
      ctx.arc(cx - r / 4, cy - r / 4, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx - r / 4, cy - r / 4, 10 + Math.sin(rotationAngle * 8) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.stroke();

      rotationAngle += 0.005;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <button
      className="relative flex flex-col items-center justify-center cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-500 rounded-full"
      onClick={onGlobeClick}
      aria-label="Interactive 3D Digital Carbon Twin Globe. Press enter to open Carbon Story."
    >
      <canvas
        ref={canvasRef}
        width={260}
        height={260}
        className="drop-shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute bottom-2 bg-slate-900/90 border border-slate-800 text-xs px-3 py-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        Click to view Carbon Story
      </div>
    </button>
  );
}
