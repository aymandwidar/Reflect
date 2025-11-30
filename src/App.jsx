import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import {
  MessageSquare,
  Activity,
  Send,
  Plus,
  Loader2,
  AlertCircle,
  History,
  BarChart2,
  Mic,
  MicOff,
  Volume2,
  Wind,
  Lock,
  Unlock,
  Bell,
  Settings
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Configuration & Constants ---

const APP_NAME = 'Reflect';
const MOODS = [
  { emoji: '😄', label: 'Joyful', color: 'bg-green-400/20 text-green-100', score: 5 },
  { emoji: '😌', label: 'Calm', color: 'bg-blue-400/20 text-blue-100', score: 4 },
  { emoji: '😐', label: 'Neutral', color: 'bg-gray-400/20 text-gray-100', score: 3 },
  { emoji: '😟', label: 'Anxious', color: 'bg-orange-400/20 text-orange-100', score: 2 },
  { emoji: '😭', label: 'Distressed', color: 'bg-red-400/20 text-red-100', score: 1 },
];

const SYSTEM_INSTRUCTION = `You are a warm, empathetic, non-judgemental CBT coach. Your goal is to guide the user through the Cognitive Restructuring process.
1. Help identifying Automatic Negative Thoughts (ANTs).
2. Challenge evidence for/against these thoughts.
3. Identify cognitive distortions.
4. Find a balanced replacement thought.
Use Socratic dialogue. Keep responses concise (2-3 sentences max).`;

const QUOTES = [
  "The only journey is the one within.",
  "Peace comes from within. Do not seek it without.",
  "Your mind will answer most questions if you learn to relax and wait for the answer.",
  "Feelings are something you have; not something you are.",
  "This too shall pass.",
  "Be kind to your mind.",
  "What you think, you become.",
  "Happiness depends upon ourselves.",
  "Turn your wounds into wisdom.",
  "Every moment is a fresh beginning.",
  "Believe you can and you're halfway there.",
  "You are enough just as you are."
];

// --- Helper Functions ---

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

// --- Sub-Components (Internal) ---

const LockScreen = ({ onUnlock, isSettingUp }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handlePress = (num) => {
    if (pin.length < 4) setPin(prev => prev + num);
  };

  const handleBackspace = () => setPin(prev => prev.slice(0, -1));

  const handleSubmit = () => {
    if (isSettingUp) {
      if (!confirmPin) {
        setConfirmPin(pin);
        setPin('');
        return;
      }
      if (pin === confirmPin) {
        onUnlock(pin);
      } else {
        setError("PINs don't match");
        setPin('');
        setConfirmPin('');
      }
    } else {
      onUnlock(pin);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white">
      <div className="mb-8 text-center">
        <Lock className="w-12 h-12 mx-auto mb-4 text-indigo-400" />
        <h2 className="text-2xl font-bold">
          {isSettingUp
            ? (confirmPin ? "Confirm PIN" : "Create a PIN")
            : "Enter PIN"}
        </h2>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      <div className="flex gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 border-white/30 ${i < pin.length ? 'bg-white' : ''}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handlePress(num)}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-medium transition-colors"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePress(0)}
          className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-2xl font-medium transition-colors"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          ⌫
        </button>
      </div>

      {pin.length === 4 && (
        <button
          onClick={handleSubmit}
          className="mt-8 px-8 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-medium transition-colors"
        >
          {isSettingUp && !confirmPin ? "Next" : "Unlock"}
        </button>
      )}
    </div>
  );
};

const BreathingExercise = () => {
  const [phase, setPhase] = useState('Inhale'); // Inhale, Hold, Exhale
  const [count, setCount] = useState(4);

  useEffect(() => {
    let timer;
    if (phase === 'Inhale') {
      if (count > 0) timer = setTimeout(() => setCount(c => c - 1), 1000);
      else { setPhase('Hold'); setCount(7); }
    } else if (phase === 'Hold') {
      if (count > 0) timer = setTimeout(() => setCount(c => c - 1), 1000);
      else { setPhase('Exhale'); setCount(8); }
    } else if (phase === 'Exhale') {
      if (count > 0) timer = setTimeout(() => setCount(c => c - 1), 1000);
      else { setPhase('Inhale'); setCount(4); }
    }
    return () => clearTimeout(timer);
  }, [phase, count]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className={`relative flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${phase === 'Inhale' ? 'w-64 h-64' : phase === 'Hold' ? 'w-64 h-64' : 'w-32 h-32'
        }`}>
        <div className={`absolute inset-0 bg-white/20 rounded-full blur-xl transition-all duration-[4000ms] ${phase === 'Inhale' ? 'scale-110 opacity-80' : phase === 'Hold' ? 'scale-110 opacity-80' : 'scale-100 opacity-40'
          }`} />
        <div className="relative z-10 text-center">
          <div className="text-3xl font-bold text-white mb-2">{phase}</div>
          <div className="text-6xl font-mono text-white/80">{count}</div>
        </div>
      </div>
      <p className="mt-12 text-white/60 text-center max-w-xs">
        Focus on the expanding light. Breathe in deeply, hold, and release slowly.
      </p>
    </div>
  );
};

const InsightsView = ({ logs }) => {
  const data = logs.slice().reverse().map(log => ({
    name: new Date(log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleDateString(undefined, { weekday: 'short' }),
    score: log.mood.score
  }));

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-xl font-bold text-white mb-6">Mood Trends</h2>
      <div className="flex-1 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'white', fontSize: 10 }} />
            <YAxis domain={[1, 5]} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'white', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: 'white' }}
            />
            <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={3} dot={{ fill: 'white' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 glass-card p-4 rounded-xl">
        <h3 className="font-medium text-white mb-2">AI Insight</h3>
        <p className="text-sm text-white/70">
          {data.length > 3
            ? "Your mood seems to be stabilizing. Great job logging consistently!"
            : "Log more moods to unlock personalized AI insights."}
        </p>
      </div>
    </div>
  );
};

// --- Main Component ---

const SettingsView = ({ settings, onSave, loading }) => {
  const [formData, setFormData] = useState(settings || { age: '', groqKey: '', deepseekKey: '', geminiKey: '' });
  const [showKeys, setShowKeys] = useState({ groq: false, deepseek: false, gemini: false });

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleShowKey = (key) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Info */}
        <div className="glass-card p-4 rounded-xl space-y-4">
          <h3 className="font-medium text-white/90 flex items-center gap-2">
            <Activity className="w-4 h-4" /> User Profile
          </h3>
          <div>
            <label className="block text-xs text-white/60 mb-1">Age</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              placeholder="Enter your age"
              className="w-full glass-input px-4 py-2 rounded-lg"
            />
          </div>
        </div>

        {/* API Keys */}
        <div className="glass-card p-4 rounded-xl space-y-4">
          <h3 className="font-medium text-white/90 flex items-center gap-2">
            <Lock className="w-4 h-4" /> API Keys (BYOK)
          </h3>
          <p className="text-xs text-white/50">
            Your keys are stored securely in your private database.
          </p>

          {/* Groq */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Groq API Key (Fast Response)</label>
            <div className="relative">
              <input
                type={showKeys.groq ? "text" : "password"}
                name="groqKey"
                value={formData.groqKey}
                onChange={handleChange}
                placeholder="gsk_..."
                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('groq')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <span className="text-[10px]">{showKeys.groq ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>

          {/* Deepseek */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Deepseek API Key (Deep Think)</label>
            <div className="relative">
              <input
                type={showKeys.deepseek ? "text" : "password"}
                name="deepseekKey"
                value={formData.deepseekKey}
                onChange={handleChange}
                placeholder="sk-..."
                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('deepseek')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <span className="text-[10px]">{showKeys.deepseek ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>

          {/* Gemini */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Gemini API Key (Multimodal/Fallback)</label>
            <div className="relative">
              <input
                type={showKeys.gemini ? "text" : "password"}
                name="geminiKey"
                value={formData.geminiKey}
                onChange={handleChange}
                placeholder="AIza..."
                className="w-full glass-input px-4 py-2 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('gemini')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <span className="text-[10px]">{showKeys.gemini ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full glass-button py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4" />}
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default function App() {
  // State
  const [user, setUser] = useState(null);
  const [view, setView] = useState('coach'); // 'coach' | 'mood' | 'insights' | 'breathing'
  const [messages, setMessages] = useState([]);
  const [moodLogs, setMoodLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [moodCaption, setMoodCaption] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [dailyQuote, setDailyQuote] = useState('');
  const [showDailyCheckin, setShowDailyCheckin] = useState(false);

  // V2 Features State
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState(localStorage.getItem('reflect_pin'));
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userSettings, setUserSettings] = useState(null);

  const messagesEndRef = useRef(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, view]);

  // Lock Screen Logic
  useEffect(() => {
    if (pin) setIsLocked(true);
  }, []);

  // Daily Quote & Check-in Logic
  useEffect(() => {
    const fetchDailyQuote = async () => {
      const today = new Date().toDateString();
      const storedQuoteData = localStorage.getItem('reflect_daily_quote');

      if (storedQuoteData) {
        const { date, quote } = JSON.parse(storedQuoteData);
        if (date === today) {
          setDailyQuote(quote);
          return;
        }
      }

      // Fallback first
      const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      setDailyQuote(randomQuote);

      // Try to get AI quote if we have mood data
      if (moodLogs.length > 0 && !demoMode) {
        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!apiKey) return;

          const recentMoods = moodLogs.slice(0, 3).map(l => l.mood.label).join(', ');
          const prompt = `Generate a short, inspiring quote (max 15 words) for someone who has been feeling: ${recentMoods}. Return ONLY the quote text.`;

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });

          const data = await response.json();
          const aiQuote = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (aiQuote) {
            setDailyQuote(aiQuote);
            localStorage.setItem('reflect_daily_quote', JSON.stringify({ date: today, quote: aiQuote }));
          }
        } catch (e) {
          console.error("Failed to fetch AI quote", e);
        }
      } else {
        localStorage.setItem('reflect_daily_quote', JSON.stringify({ date: today, quote: randomQuote }));
      }
    };

    fetchDailyQuote();
  }, [moodLogs, demoMode]);

  useEffect(() => {
    const checkDailyStatus = () => {
      const lastDismissed = localStorage.getItem('reflect_last_dismissed');
      const isDismissedToday = lastDismissed && isSameDay(new Date(lastDismissed), new Date());

      if (isDismissedToday) {
        setShowDailyCheckin(false);
        return;
      }

      let shouldCheckIn = false;
      if (moodLogs.length > 0) {
        const lastLog = moodLogs[0];
        const lastDate = lastLog.timestamp.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
        if (!isSameDay(lastDate, new Date())) {
          shouldCheckIn = true;
        }
      } else if (user) {
        shouldCheckIn = true;
      }

      setShowDailyCheckin(shouldCheckIn);

      // Local Notification
      if (shouldCheckIn && 'Notification' in window && Notification.permission === "granted") {
        const lastNotified = localStorage.getItem('reflect_last_notified');
        if (!lastNotified || !isSameDay(new Date(lastNotified), new Date())) {
          new Notification("Reflect", { body: "Time to check in with yourself." });
          localStorage.setItem('reflect_last_notified', new Date().toISOString());
        }
      }
    };

    checkDailyStatus();
  }, [moodLogs, user]);

  const dismissCheckin = () => {
    setShowDailyCheckin(false);
    localStorage.setItem('reflect_last_dismissed', new Date().toISOString());
  };

  // Initialize Firebase & Auth
  useEffect(() => {
    const initApp = async () => {
      try {
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        const appId = import.meta.env.VITE_FIREBASE_APP_ID;

        if (!apiKey || !appId) {
          console.warn("Missing Firebase config in .env. Switching to Demo Mode.");
          setDemoMode(true);
          setUser({ uid: 'demo-user' });
          setAuthLoading(false);
          return;
        }

        const config = {
          apiKey: apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: appId
        };

        const app = initializeApp(config);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        setAuth(authInstance);
        setDb(dbInstance);

        await signInAnonymously(authInstance);
      } catch (err) {
        console.error("Initialization Error:", err);
        setDemoMode(true);
        setUser({ uid: 'demo-user' });
        setError(`Firebase Init Failed: ${err.message}. Running in Demo Mode.`);
      } finally {
        setAuthLoading(false);
      }
    };

    initApp();
  }, []);

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, [auth]);

  // Firestore Listeners
  useEffect(() => {
    if (demoMode || !user || !db) return;

    const appId = import.meta.env.VITE_FIREBASE_APP_ID;
    const userId = user.uid;

    const sessionRef = doc(db, `artifacts/${appId}/users/${userId}/cbt_sessions/current_session`);
    const unsubChat = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.history) setMessages(data.history);
      } else {
        setMessages([]);
      }
    }, (err) => console.error("Chat Snapshot Error:", err));

    const moodRef = collection(db, `artifacts/${appId}/users/${userId}/mood_logs`);
    const q = query(moodRef, orderBy('timestamp', 'desc'), limit(20));
    const unsubMood = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMoodLogs(logs);
    }, (err) => console.error("Mood Snapshot Error:", err));

    return () => {
      unsubChat();
      unsubMood();
    };
  }, [user, db, demoMode]);

  // Load User Settings
  useEffect(() => {
    if (demoMode) {
      // In Demo Mode, load from localStorage
      const stored = localStorage.getItem('reflect_user_settings');
      if (stored) {
        try {
          setUserSettings(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored settings:", e);
        }
      }
      return;
    }

    if (!user || !db) return;
    const appId = import.meta.env.VITE_FIREBASE_APP_ID;
    const userId = user.uid;
    const settingsRef = doc(db, `artifacts/${appId}/users/${userId}/user_settings/keys`);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserSettings(docSnap.data());
      }
    }, (err) => console.error("Settings Snapshot Error:", err));

    return () => unsubSettings();
  }, [user, db, demoMode]);

  // --- Actions ---

  const handleSaveSettings = async (newSettings) => {
    if (!user) return;
    setLoading(true);

    if (demoMode) {
      // In Demo Mode, save to localStorage
      try {
        localStorage.setItem('reflect_user_settings', JSON.stringify(newSettings));
        setUserSettings(newSettings);
        alert("Settings saved successfully! (Demo Mode - stored locally)");
      } catch (err) {
        console.error("Save Settings Error (Demo):", err);
        setError("Failed to save settings.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const appId = import.meta.env.VITE_FIREBASE_APP_ID;
      const userId = user.uid;
      const settingsRef = doc(db, `artifacts/${appId}/users/${userId}/user_settings/keys`);

      await setDoc(settingsRef, newSettings, { merge: true });
      // setUserSettings will be updated by onSnapshot
      alert("Settings saved successfully!");
    } catch (err) {
      console.error("Save Settings Error:", err);
      setError("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const [modelMode, setModelMode] = useState('fast'); // 'fast' | 'deep'

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const newMessage = { role: 'user', content: inputText };
    const updatedMessages = [...messages, newMessage];

    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    try {
      // Save to Firestore if not in demo mode
      if (!demoMode) {
        const appId = import.meta.env.VITE_FIREBASE_APP_ID;
        const userId = user.uid;
        const sessionRef = doc(db, `artifacts/${appId}/users/${userId}/cbt_sessions/current_session`);
        await setDoc(sessionRef, { history: updatedMessages }, { merge: true });
      }

      let aiContent = "";

      // 1. Try Groq (Fast) - Note: May fail due to CORS in browser
      if (modelMode === 'fast') {
        if (userSettings?.groqKey) {
          try {
            aiContent = await callGroqAPI(updatedMessages, userSettings.groqKey);
          } catch (e) {
            console.error("Groq Failed:", e);
            // Fallback to Gemini if Groq fails (likely CORS issue)
            if (userSettings?.geminiKey) {
              console.log("Falling back to Gemini...");
              try {
                aiContent = await callGeminiAPI(updatedMessages, userSettings.geminiKey);
              } catch (geminiErr) {
                console.error("Gemini Fallback Failed:", geminiErr);
                setError("Fast mode failed. CORS issue - Groq doesn't work from browser. Use Gemini key instead.");
                setLoading(false);
                return;
              }
            } else {
              setError("Fast mode failed (CORS issue). Please add a Gemini API Key in Settings as fallback.");
              setLoading(false);
              return;
            }
          }
        } else if (userSettings?.geminiKey) {
          // Use Gemini directly if no Groq key
          try {
            aiContent = await callGeminiAPI(updatedMessages, userSettings.geminiKey);
          } catch (e) {
            console.error("Gemini Failed:", e);
            setError("Failed to get response. Check your Gemini Key in Settings.");
            setLoading(false);
            return;
          }
        } else {
          setError("No API Key found. Please add Groq or Gemini API Key in Settings.");
          setLoading(false);
          return;
        }
      }
      // 2. Try Deepseek (Deep) - Note: May fail due to CORS in browser
      else if (modelMode === 'deep') {
        if (userSettings?.deepseekKey) {
          try {
            aiContent = await callDeepseekAPI(updatedMessages, userSettings.deepseekKey);
          } catch (e) {
            console.error("Deepseek Failed:", e);
            // Fallback to Gemini if Deepseek fails (likely CORS issue)
            if (userSettings?.geminiKey) {
              console.log("Falling back to Gemini...");
              try {
                aiContent = await callGeminiAPI(updatedMessages, userSettings.geminiKey);
              } catch (geminiErr) {
                console.error("Gemini Fallback Failed:", geminiErr);
                setError("Deep mode failed. CORS issue - Deepseek doesn't work from browser. Use Gemini key instead.");
                setLoading(false);
                return;
              }
            } else {
              setError("Deep mode failed (CORS issue). Please add a Gemini API Key in Settings as fallback.");
              setLoading(false);
              return;
            }
          }
        } else if (userSettings?.geminiKey) {
          // Use Gemini directly if no Deepseek key
          try {
            aiContent = await callGeminiAPI(updatedMessages, userSettings.geminiKey);
          } catch (e) {
            console.error("Gemini Failed:", e);
            setError("Failed to get response. Check your Gemini Key in Settings.");
            setLoading(false);
            return;
          }
        } else {
          setError("No API Key found. Please add Deepseek or Gemini API Key in Settings.");
          setLoading(false);
          return;
        }
      }

      if (!aiContent) {
        throw new Error("No response generated.");
      }

      const aiMessage = { role: 'model', content: aiContent };
      const finalMessages = [...updatedMessages, aiMessage];

      // Save final messages to Firestore if not in demo mode
      if (!demoMode) {
        const appId = import.meta.env.VITE_FIREBASE_APP_ID;
        const userId = user.uid;
        const sessionRef = doc(db, `artifacts/${appId}/users/${userId}/cbt_sessions/current_session`);
        await setDoc(sessionRef, { history: finalMessages }, { merge: true });
      } else {
        // In demo mode, just update local state
        setMessages(finalMessages);
      }

    } catch (err) {
      console.error("LLM Error:", err);
      setError("Failed to get response from AI: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithBackoff = async (url, options, retries = 3, delay = 1000) => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        if (res.status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, delay));
          return fetchWithBackoff(url, options, retries - 1, delay * 2);
        }
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return fetchWithBackoff(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const callGroqAPI = async (messages, apiKey) => {
    const response = await fetchWithBackoff('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...messages
        ],
        temperature: 0.6,
        max_tokens: 1024
      })
    });
    const data = await response.json();

    // Log the full response for debugging
    if (!data.choices || !data.choices[0]) {
      console.error("Groq API Error Response:", data);
      throw new Error(data.error?.message || "Invalid response from Groq API");
    }

    return data.choices[0].message.content;
  };

  const callDeepseekAPI = async (messages, apiKey) => {
    const response = await fetchWithBackoff('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...messages
        ],
        temperature: 0.7
      })
    });
    if (!confirm("Start a new session? Current chat will be archived.")) return;

    setLoading(true);

    if (demoMode) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const appId = import.meta.env.VITE_FIREBASE_APP_ID;
      const userId = user.uid;
      const currentRef = doc(db, `artifacts/${appId}/users/${userId}/cbt_sessions/current_session`);
      const archiveRef = collection(db, `artifacts/${appId}/users/${userId}/archived_cbt_sessions`);

      if (messages.length > 0) {
        await addDoc(archiveRef, {
          history: messages,
          archivedAt: serverTimestamp()
        });
      }

      await setDoc(currentRef, { history: [] });
      setMessages([]);

    } catch (err) {
      console.error("New Session Error:", err);
      setError("Failed to start new session.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMood = async () => {
    if (!selectedMood || !moodCaption.trim() || !user) return;

    setLoading(true);

    if (demoMode) {
      const newLog = {
        id: Date.now().toString(),
        mood: selectedMood,
        caption: moodCaption,
        timestamp: new Date()
      };
      setMoodLogs([newLog, ...moodLogs]);
      setMoodCaption('');
      setSelectedMood(null);
      setView('mood');
      setLoading(false);
      return;
    }

    try {
      const appId = import.meta.env.VITE_FIREBASE_APP_ID;
      const userId = user.uid;
      const moodRef = collection(db, `artifacts/${appId}/users/${userId}/mood_logs`);

      await addDoc(moodRef, {
        mood: selectedMood,
        caption: moodCaption,
        timestamp: serverTimestamp()
      });

      setMoodCaption('');
      setSelectedMood(null);
      setView('mood');
    } catch (err) {
      console.error("Save Mood Error:", err);
      setError("Failed to save mood log.");
    } finally {
      setLoading(false);
    }
  };

  // V2 Feature Actions
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      // Stop logic handled by recognition.onend
    } else {
      setIsListening(true);
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    }
  };

  const speakMessage = (text) => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSetPin = (newPin) => {
    localStorage.setItem('reflect_pin', newPin);
    setPin(newPin);
    setIsLocked(false);
  };

  const handleUnlock = (inputPin) => {
    if (inputPin === pin) setIsLocked(false);
    else alert("Incorrect PIN");
  };

  const requestNotification = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notification");
      return;
    }

    let permission = Notification.permission;
    if (permission !== 'granted' && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }

    if (permission === "granted") {
      new Notification("Reflect", { body: "Notifications enabled! We'll remind you to check in." });
    }
  };

  // --- Render ---

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  if (isLocked) return <LockScreen onUnlock={handleUnlock} isSettingUp={false} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500/80 to-purple-400/80 text-white font-sans selection:bg-pink-500/30">
      <div className="max-w-md mx-auto h-screen flex flex-col p-4 relative">

        {/* Header */}
        <header className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-white/30 rounded-full blur-sm"></div>
              <div className="relative bg-white/20 backdrop-blur-md rounded-full w-full h-full flex items-center justify-center border border-white/40 shadow-lg">
                <span className="text-xl font-bold bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">R</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{APP_NAME}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={requestNotification} className="glass-icon-button">
              <Bell className="w-4 h-4 text-white/70" />
            </button>
            {!pin && (
              <button
                onClick={() => setView('lock_setup')}
                className="glass-icon-button"
                title="Set PIN"
              >
                <Unlock className="w-4 h-4 text-white/70" />
              </button>
            )}
            {pin && (
              <button
                onClick={() => setIsLocked(true)}
                className="glass-icon-button"
                title="Lock App"
              >
                <Lock className="w-4 h-4 text-white/70" />
              </button>
            )}
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl flex items-center gap-2 text-sm text-red-100">
            <AlertCircle className="w-4 h-4" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:bg-red-500/20 p-1 rounded-full">×</button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative z-10">

          {/* View Switcher */}
          <div className="flex p-1 bg-black/10 backdrop-blur-md rounded-2xl mb-4 border border-white/10 overflow-x-auto">
            {[
              { id: 'coach', icon: MessageSquare, label: 'Coach' },
              { id: 'mood', icon: Activity, label: 'Mood' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex-1 min-w-[80px] flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-all duration-300 ${view === tab.id
                  ? 'bg-white/20 text-white shadow-lg border border-white/20'
                  : 'text-white/60 hover:bg-white/5'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Views */}
          <div className="flex-1 overflow-hidden relative glass-panel rounded-3xl flex flex-col">

            {view === 'lock_setup' && (
              <div className="absolute inset-0 z-20">
                <LockScreen onUnlock={handleSetPin} isSettingUp={true} />
              </div>
            )}

            {view === 'settings' && (
              <SettingsView settings={userSettings} onSave={handleSaveSettings} loading={loading} />
            )}

            {view === 'coach' && (
              <div className="flex flex-col h-full">
                {/* Model Selector */}
                <div className="flex items-center justify-center p-2 border-b border-white/10">
                  <div className="flex bg-black/20 rounded-lg p-1">
                    <button
                      onClick={() => setModelMode('fast')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${modelMode === 'fast' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                    >
                      Fast (Groq)
                    </button>
                    <button
                      onClick={() => setModelMode('deep')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${modelMode === 'deep' ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                    >
                      Deep (Deepseek)
                    </button>
                  </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                      <MessageSquare className="w-12 h-12 mb-4 text-white/40" />
                      <p className="text-lg font-medium">How are you feeling?</p>
                      <p className="text-sm">I'm here to listen and help.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user'
                          ? 'bg-indigo-500/80 text-white rounded-br-none'
                          : 'bg-white/10 backdrop-blur-md text-white/90 rounded-bl-none'
                          }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl rounded-bl-none flex gap-2 items-center">
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/10 backdrop-blur-md border-t border-white/10">
                  <div className="flex gap-2">
                    <button
                      onClick={handleNewSession}
                      className="glass-icon-button"
                      title="New Session"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="w-full glass-input h-10 pl-4 pr-10 rounded-full text-sm"
                        disabled={loading}
                      />
                      <button
                        onClick={toggleListening}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-500/50 text-white' : 'hover:bg-white/10 text-white/60'
                          }`}
                      >
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={loading || !inputText.trim()}
                      className="glass-button w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'breathing' && <BreathingExercise />}

            {view === 'insights' && <InsightsView logs={moodLogs} />}



            {view === 'mood' && (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                  <h2 className="text-lg font-medium mb-4 text-white/90">How are you feeling?</h2>

                  <div className="flex justify-between mb-6">
                    {MOODS.map((m) => (
                      <button
                        key={m.label}
                        onClick={() => setSelectedMood(m)}
                        className={`flex flex-col items-center gap-2 transition-all duration-300 ${selectedMood?.label === m.label
                          ? 'transform scale-110 opacity-100'
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                          }`}
                      >
                        <span className="text-3xl drop-shadow-md filter">{m.emoji}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={moodCaption}
                      onChange={(e) => setMoodCaption(e.target.value)}
                      placeholder="Why do you feel this way?"
                      className="w-full h-24 bg-black/10 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                    />
                    <button
                      onClick={handleSaveMood}
                      disabled={!selectedMood || !moodCaption.trim() || loading}
                      className="w-full py-3 bg-white/20 hover:bg-white/25 border border-white/30 rounded-xl font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Log Mood'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 px-1">Recent Logs</h3>
                  {moodLogs.map((log) => (
                    <div key={log.id} className="glass-card rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{log.mood.emoji}</span>
                          <span className="font-medium text-sm">{log.mood.label}</span>
                        </div>
                        <span className="text-xs text-white/40 font-mono">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">{log.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
