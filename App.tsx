/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Sparkles, 
  BookOpen, 
  Send, 
  RefreshCcw, 
  HelpCircle,
  Brain,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  LogOut,
  LogIn,
  Menu,
  X,
  Plus,
  UserCircle,
  Settings,
  History,
  Bookmark,
  Trash2,
  Sun,
  Moon,
  Edit3,
  GraduationCap,
  Trash,
  Check,
  LayoutGrid,
  Mic,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc,
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  setDoc, 
  deleteDoc,
  updateDoc,
  writeBatch,
  updateProfile,
  User,
  Timestamp
} from './lib/firebase';

// --- Types ---

interface UnblurResult {
  coreIdea: string;
  analogy: string;
  quickSteps: string;
  teacherPrep: string;
  solution?: string;
}

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: any;
}

interface Participant {
  userId: string;
  userName: string;
  lastSeen: any;
}

interface UserProfile {
  displayName: string;
  studentLevel: string;
  simplifyMode: 'ELI5' | 'Standard';
  showSolutionsImmediately: boolean;
  theme: 'light' | 'dark';
  hasCompletedOnboarding: boolean;
  photoURL?: string;
  updatedAt: any;
}

interface HistoryEntry {
  id: string;
  topic: string;
  createdAt: any;
}

interface Bookmark {
  id: string;
  topic: string;
  content: UnblurResult;
  savedAt: any;
}

// --- AI Initialization ---
// ... (SYSTEM_PROMPT stays the same)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SYSTEM_PROMPT = `You are the "Concept Simplifier" assistant for the educational app 'Unblur'. Your mission is to reduce student anxiety by breaking down complex topics into clear, bite-sized explanations.

### STYLE GUIDELINES:
- Tone: Encouraging, supportive, and clear.
- Language: Simple prose (Explain Like I'm 10). Define jargon immediately.
- Headers: Use exactly the headers listed below. Do NOT use all caps.
- Color/Formatting: Use Markdown bolding for headers.
- Math: Use LaTeX for all mathematical expressions (e.g., $E=mc^2$).

### MANDATORY RESPONSE STRUCTURE:
For every response, you must use EXACTLY these markers in this order, and include the styled headers exactly as shown:

[CORE_IDEA]
<span style="color: #D4AF37;">**The core idea**</span>
(One sentence explanation for a 10-year-old)

[ANALOGY]
<span style="color: #D4AF37;">**The analogy**</span>
(A comparison to a real-world object or situation)

[QUICK_STEPS]
<span style="color: #D4AF37;">**Quick steps**</span>
(Bulleted list of 3 facts)

[TEACHER_PREP]
<span style="color: #D4AF37;">**Teacher prep**</span>
(One specific question the student should ask their teacher)

[SOLUTION]
<span style="color: #D4AF37;">**The solution**</span>
(Provide a step-by-step walk-through using LaTeX for any math involved. ONLY if the user provided a specific problem/question to solve. Otherwise, omit this section.)`;

function OnboardingOverlay({ onComplete, theme }: { onComplete: () => void, theme?: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Welcome to Unblur!",
      description: "Unblur is your safe space to understand complex topics without anxiety. Since you're at least 10 years old, you're ready to start exploring!",
      icon: <Sparkles className="text-yellow-500" size={48} />,
      actionLabel: "I'm 10 or older - Let's go!"
    },
    {
      title: "Simplify Anything",
      description: "Feeling stuck? Type your doubt, use your camera, or just speak! Our 'Concept Simplifier' breaks it down using clear analogies and step-by-step logic.",
      icon: <Brain className="text-purple-500" size={48} />,
      actionLabel: "Got it!"
    },
    {
      title: "Join Study Circles",
      description: "Learning is better together. Join global or private study circles to discuss your doubts with others in real-time.",
      icon: <Users className="text-blue-500" size={48} />,
      actionLabel: "Clear!"
    },
    {
      title: "Account Sovereignty",
      description: "You're in control of your data. Bookmark important unblurs and wipe your records anytime from your profile.",
      icon: <Trash2 className="text-red-500" size={48} />,
      actionLabel: "Start My Journey"
    }
  ];

  const currentStep = steps[step];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className={cn(
          "max-w-md w-full rounded-[40px] p-10 shadow-2xl relative overflow-hidden",
          theme === 'dark' ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"
        )}
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-zinc-100 dark:bg-white/5">
          <motion.div 
            className="h-full bg-[var(--color-brand-accent)]"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex flex-col items-center text-center space-y-8 mt-4">
          <div className="p-6 bg-zinc-50 dark:bg-white/5 rounded-[32px]">
            {currentStep.icon}
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-serif font-bold tracking-tight">{currentStep.title}</h2>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{currentStep.description}</p>
          </div>

          <button 
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                onComplete();
              }
            }}
            className="w-full py-5 rounded-3xl bg-black text-white dark:bg-white dark:text-black font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {currentStep.actionLabel}
            <ArrowRight size={18} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Components ---

function MathMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkMath]} 
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SectionCard({ 
  title, 
  icon: Icon, 
  content, 
  delay = 0,
  variant = 'default',
  theme = 'light'
}: { 
  title: string; 
  icon: any; 
  content: string; 
  delay?: number;
  variant?: 'default' | 'analogy' | 'steps' | 'prep';
  theme?: 'light' | 'dark';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex flex-col gap-2 group"
    >
      <div className={cn(
        "flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest",
        theme === 'dark' ? "text-zinc-500" : "text-[var(--color-text-muted)]"
      )}>
        <span className={cn(
          "flex items-center gap-2 whitespace-nowrap",
          theme === 'dark' ? "text-white" : "text-[#D4AF37]"
        )}>
          <Icon size={14} strokeWidth={2.5} />
          {title}
        </span>
        <div className={cn(
          "flex-1 h-px",
          theme === 'dark' ? "bg-white/5" : "bg-[var(--color-bg-base)]"
        )} />
      </div>
      
      <div className={cn(
        "text-lg leading-relaxed",
        variant === 'analogy' && (theme === 'dark' ? "bg-white/5 p-5 rounded-2xl italic border-l-4 border-white" : "bg-[var(--color-bg-base)] p-5 rounded-2xl italic border-l-4 border-[var(--color-brand-accent)]"),
        variant === 'prep' && (theme === 'dark' ? "border-2 border-dashed border-white/10 p-5 rounded-2xl bg-white/5" : "border-2 border-dashed border-[var(--color-highlight)] p-5 rounded-2xl bg-white"),
        variant === 'steps' && "grid-list mt-1",
        variant === 'default' && "mt-1",
        theme === 'dark' ? "text-zinc-200" : "text-[var(--color-text-main)]"
      )}>
        <MathMarkdown content={content} />
      </div>
    </motion.div>
  );
}

function CircleChat({ user, profileName, circleId, onClose, title, topic, theme = 'light' }: { user: User, profileName?: string, circleId: string, onClose: () => void, title?: string, topic?: string, theme?: 'light' | 'dark' }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Listen for messages
    const q = query(
      collection(db, 'circles', circleId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    // 2. Presence Heartbeat
    const presenceRef = doc(db, 'circles', circleId, 'presence', user.uid);
    const heartbeat = setInterval(() => {
      setDoc(presenceRef, {
        userId: user.uid,
        userName: profileName || user.displayName || 'Anonymous',
        lastSeen: serverTimestamp()
      });
    }, 10000);

    // Initial heartbeat
    setDoc(presenceRef, {
      userId: user.uid,
      userName: profileName || user.displayName || 'Anonymous',
      lastSeen: serverTimestamp()
    });

    // 3. Listen for participants
    const qPresence = collection(db, 'circles', circleId, 'presence');
    const unsubPresence = onSnapshot(qPresence, (snapshot) => {
      const p: Participant[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Simple 30s timeout for presence
        const lastSeen = data.lastSeen?.toMillis() || 0;
        if (Date.now() - lastSeen < 30000) {
          p.push(data as Participant);
        }
      });
      setParticipants(p);
    });

    return () => {
      unsubMessages();
      unsubPresence();
      clearInterval(heartbeat);
      // Attempt cleanup, but ignore failures (common on logout)
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [circleId, user.uid, user.displayName, profileName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!msgInput.trim()) return;
    const text = msgInput;
    setMsgInput('');
    try {
      await addDoc(collection(db, 'circles', circleId, 'messages'), {
        text,
        userId: user.uid,
        userName: profileName || user.displayName || 'Anonymous',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col h-full rounded-3xl shadow-xl border overflow-hidden",
        theme === 'dark' ? "bg-zinc-900 border-white/10" : "bg-white border-[var(--color-highlight)]"
      )}
    >
      <div className={cn(
        "p-4 flex justify-between items-center",
        theme === 'dark' ? "bg-zinc-800 text-white" : "bg-[var(--color-brand-accent)] text-white"
      )}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span className="font-bold text-xs tracking-wider uppercase truncate max-w-[150px]">{title || 'Study Circle'}</span>
          </div>
          {topic && <span className="text-[10px] text-white/70 italic truncate max-w-[150px]">{topic}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{participants.length} Active</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-1", m.userId === user.uid ? "items-end" : "items-start")}>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter mx-1">{m.userName}</span>
            <div className={cn(
              "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
              m.userId === user.uid 
                ? (theme === 'dark' ? "bg-white text-black" : "bg-[var(--color-brand-accent)] text-white")
                : (theme === 'dark' ? "bg-white/10 text-white" : "bg-[var(--color-bg-base)] text-zinc-800")
            )}>
              <MathMarkdown content={m.text} />
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className={cn(
        "p-4 border-t",
        theme === 'dark' ? "border-white/10 bg-zinc-800/50" : "border-zinc-100 bg-zinc-50"
      )}>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={msgInput} 
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className={cn(
              "flex-1 bg-transparent border-none focus:ring-0 text-sm",
              theme === 'dark' ? "text-white placeholder:text-white/30" : "text-zinc-800 placeholder:text-zinc-400"
            )}
          />
          <button onClick={sendMessage} className={cn(
            "p-2 rounded-xl transition-all",
            theme === 'dark' ? "bg-white text-black" : "bg-[var(--color-brand-accent)] text-white"
          )}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<UnblurResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isCircleOpen, setIsCircleOpen] = useState(false);
  const [activeCircleId, setActiveCircleId] = useState('global-unblur');
  const [userCircles, setUserCircles] = useState<any[]>([]);
  const [isCreatingCircle, setIsCreatingCircle] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleTopic, setNewCircleTopic] = useState('');
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStagedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setUserCircles([]);
      setProfile(null);
      setHistory([]);
      setBookmarks([]);
      return;
    }

    // Circles
    const qCircles = query(collection(db, 'circles'), orderBy('createdAt', 'desc'));
    const unsubCircles = onSnapshot(qCircles, (snapshot) => {
      const circles: any[] = [];
      snapshot.forEach(doc => {
        circles.push({ id: doc.id, ...doc.data() });
      });
      setUserCircles(circles);
    });

    // Profile
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      } else {
        // Init profile
        const initialProfile: UserProfile = {
          displayName: user.displayName || 'Guest',
          studentLevel: 'Elementary School',
          simplifyMode: 'Standard',
          showSolutionsImmediately: true,
          theme: 'light',
          hasCompletedOnboarding: false,
          updatedAt: serverTimestamp()
        };
        setDoc(doc(db, 'users', user.uid), initialProfile);
      }
    });

    // History
    const qHistory = query(collection(db, 'users', user.uid, 'history'), orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const h: HistoryEntry[] = [];
      snapshot.forEach(doc => {
        h.push({ id: doc.id, ...doc.data() } as HistoryEntry);
      });
      setHistory(h);
    });

    // Bookmarks
    const qBookmarks = query(collection(db, 'users', user.uid, 'bookmarks'), orderBy('savedAt', 'desc'));
    const unsubBookmarks = onSnapshot(qBookmarks, (snapshot) => {
      const b: Bookmark[] = [];
      snapshot.forEach(doc => {
        b.push({ id: doc.id, ...doc.data() } as Bookmark);
      });
      setBookmarks(b);
    });

    return () => {
      unsubCircles();
      unsubProfile();
      unsubHistory();
      unsubBookmarks();
    };
  }, [user]);

  const toggleTheme = async () => {
    if (!user || !profile) return;
    const newTheme = profile.theme === 'light' ? 'dark' : 'light';
    await setDoc(doc(db, 'users', user.uid), {
      ...profile,
      theme: newTheme,
      updatedAt: serverTimestamp()
    });
  };

  const updateProfileFields = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;
    await setDoc(doc(db, 'users', user.uid), {
      ...profile,
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const handleUpdateName = async () => {
    if (!user || !editName.trim()) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateProfile(user, { displayName: editName.trim() });
      await updateProfileFields({ displayName: editName.trim() });
      setIsEditingName(false);
    } catch (err) {
      console.error("Update name failed:", err);
    }
  };

  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      if (file.size > 800000) {
        alert("Image is too large (max 800KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await updateProfileFields({ photoURL: base64 });
        } catch (err) {
          console.error("Update avatar failed:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addToHistory = async (topic: string) => {
    if (!user) return;
    await addDoc(collection(db, 'users', user.uid, 'history'), {
      topic,
      createdAt: serverTimestamp()
    });
  };

  const deleteHistoryItem = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'history', itemId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const completeOnboarding = async () => {
    if (!user || !profile) return;
    await updateProfileFields({ hasCompletedOnboarding: true });
  };

  const toggleBookmark = async (topic: string, content: UnblurResult) => {
    if (!user) return;
    const existing = bookmarks.find(b => b.topic === topic);
    if (existing) {
      await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', existing.id));
    } else {
      await addDoc(collection(db, 'users', user.uid, 'bookmarks'), {
        topic,
        content,
        savedAt: serverTimestamp()
      });
    }
  };

  const resetData = async () => {
    if (!user || !window.confirm("Are you sure you want to clear all your history and saved solutions? This cannot be undone.")) return;
    
    // In a real app we'd batch delete, but here let's just delete the sub-collections we track
    for (const h of history) {
      await deleteDoc(doc(db, 'users', user.uid, 'history', h.id));
    }
    for (const b of bookmarks) {
      await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', b.id));
    }
  };


  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const parseResponse = (text: string): UnblurResult => {
    const sections = {
      coreIdea: '',
      analogy: '',
      quickSteps: '',
      teacherPrep: '',
      solution: undefined as string | undefined
    };

    const markers = {
      coreIdea: '[CORE_IDEA]',
      analogy: '[ANALOGY]',
      quickSteps: '[QUICK_STEPS]',
      teacherPrep: '[TEACHER_PREP]',
      solution: '[SOLUTION]'
    };

    const getTextBetween = (startMarker: string, endMarker?: string) => {
      const startIndex = text.indexOf(startMarker);
      if (startIndex === -1) return '';
      
      const realStart = startIndex + startMarker.length;
      const endIndex = endMarker ? text.indexOf(endMarker, realStart) : text.length;
      
      return text.substring(realStart, endIndex).trim();
    };

    const cleanContent = (content: string, prefixToRemove: string) => {
      let cleaned = content.trim();
      if (cleaned.startsWith(prefixToRemove)) {
        cleaned = cleaned.substring(prefixToRemove.length).trim();
      }
      return cleaned;
    };

    sections.coreIdea = cleanContent(getTextBetween(markers.coreIdea, markers.analogy), '<span style="color: #D4AF37;">**The core idea**</span>');
    sections.analogy = cleanContent(getTextBetween(markers.analogy, markers.quickSteps), '<span style="color: #D4AF37;">**The analogy**</span>');
    sections.quickSteps = cleanContent(getTextBetween(markers.quickSteps, markers.teacherPrep), '<span style="color: #D4AF37;">**Quick steps**</span>');
    sections.teacherPrep = cleanContent(getTextBetween(markers.teacherPrep, markers.solution), '<span style="color: #D4AF37;">**Teacher prep**</span>');
    
    if (text.includes(markers.solution)) {
      sections.solution = cleanContent(getTextBetween(markers.solution), '<span style="color: #D4AF37;">**The solution**</span>');
    }

    return sections;
  };

  const handleUnblur = async () => {
    if (!input.trim() && !stagedImage) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const historyTopic = input.trim() || (stagedImage ? "Visual Query" : "New Doubt");
      await addToHistory(historyTopic);
      
      const contents: any[] = [];
      const parts: any[] = [];
      
      if (input.trim()) {
        parts.push({ text: input });
      }
      
      if (stagedImage) {
        const mimeType = stagedImage.split(';')[0].split(':')[1];
        const base64Data = stagedImage.split(',')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
        }
      });

      const parsed = parseResponse(response.text || '');
      setResult(parsed);
      setStagedImage(null);
      
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError("Oops! My brain got a bit blurry. Can you try asking that again?");
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className={cn(
      "fixed inset-0 flex flex-col transition-colors duration-300 overflow-hidden",
      profile?.theme === 'dark' ? "bg-zinc-950 text-white" : "bg-[var(--color-bg-base)] text-[var(--color-text-main)]"
    )}>
      {/* Header */}
      <header className="px-6 md:px-10 pt-6 pb-4 flex justify-between items-center shrink-0 z-10">
        <div 
          className="flex items-center gap-3 group cursor-pointer" 
          onClick={() => { 
            if (view === 'profile') setView('dashboard');
            else {
              setActiveCircleId('global-unblur'); 
              setIsCircleOpen(false); 
            }
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand-accent)] flex items-center justify-center text-white font-serif font-black text-2xl shadow-xl shadow-black/10 group-hover:rotate-6 transition-transform">U</div>
          <span className="font-serif text-3xl font-bold tracking-tight">Unblur.</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className={cn(
              "p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95",
              profile?.theme === 'dark' ? "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-500 hover:text-black"
            )}
          >
            {profile?.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {user ? (
            <div 
              className="flex items-center gap-4 pl-6 border-l border-zinc-200 dark:border-white/10 cursor-pointer active:scale-95 transition-transform"
              onClick={() => setView('profile')}
            >
              <div className="text-right hidden sm:block leading-tight">
                <div className="text-[10px] font-black tracking-widest uppercase opacity-40">{profile?.studentLevel}</div>
                <div className="text-sm font-bold">{profile?.displayName || user.displayName}</div>
              </div>
              <div className="w-12 h-12 rounded-[18px] bg-gradient-to-tr from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center font-bold text-lg border dark:border-white/10 shadow-sm overflow-hidden">
                {profile?.photoURL || user.photoURL ? (
                  <img src={profile?.photoURL || user.photoURL || ""} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.displayName?.[0] || user.displayName?.[0]
                )}
              </div>
            </div>
          ) : (
            <button onClick={handleSignIn} className="px-6 py-3 rounded-2xl bg-black text-white dark:bg-white dark:text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all">Sign In</button>
          )}
        </div>
      </header>

      {/* Bento Layout */}
      <main className="flex-1 p-6 md:p-10 pt-2 overflow-hidden h-full">
        {!user ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8 pb-20">
            <motion.div 
              animate={{ y: [0, -20, 0] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 rounded-[32px] bg-[var(--color-brand-accent)] flex items-center justify-center text-white shadow-2xl shadow-black/20"
            >
              <Sparkles size={48} />
            </motion.div>
            <div className="space-y-4">
              <h1 className="text-5xl font-serif font-bold tracking-tight leading-[1.1]">Focus on curiosity,<br/><span className="italic opacity-60">not confusion.</span></h1>
              <p className="text-zinc-500 text-lg font-medium max-w-sm mx-auto">One minimalist dashboard to unblur your doubts, join circles, and track progress.</p>
            </div>
            <button 
              onClick={handleSignIn}
              className="px-10 py-5 bg-black text-white dark:bg-white dark:text-black rounded-[24px] font-black uppercase tracking-widest text-sm shadow-2xl hover:scale-105 transition-all flex items-center gap-4"
            >
              Start Learning
              <ArrowRight size={20} />
            </button>
          </div>
        ) : view === 'profile' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full overflow-y-auto custom-scrollbar pb-20"
          >
            <div className="max-w-4xl mx-auto space-y-12">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b dark:border-white/5">
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 rounded-[40px] bg-gradient-to-tr from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center font-bold text-4xl border dark:border-white/10 shadow-xl overflow-hidden relative group">
                    {profile?.photoURL || user.photoURL ? (
                      <img src={profile?.photoURL || user.photoURL || ""} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      profile?.displayName?.[0] || user.displayName?.[0]
                    )}
                    <div 
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Edit3 size={24} />
                    </div>
                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      onChange={handleUpdateAvatar} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateName();
                              if (e.key === 'Escape') setIsEditingName(false);
                            }}
                            className="text-4xl font-serif font-bold bg-transparent border-b-2 border-[var(--color-brand-accent)] focus:outline-none min-w-[200px]"
                          />
                          <button 
                            onClick={handleUpdateName}
                            className="p-2 rounded-xl bg-[var(--color-brand-accent)] text-white hover:scale-105 transition-all"
                          >
                            <Check size={20} />
                          </button>
                          <button 
                            onClick={() => setIsEditingName(false)}
                            className="p-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:scale-105 transition-all"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h1 className="text-4xl font-serif font-bold">{profile?.displayName || user.displayName}</h1>
                          <button 
                            onClick={() => { setEditName(profile?.displayName || user.displayName || ''); setIsEditingName(true); }}
                            className="p-2 rounded-xl bg-zinc-50 dark:bg-white/5 text-zinc-400 hover:text-black dark:hover:text-white transition-all outline-none"
                          >
                            <Edit3 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-zinc-500 font-medium">{user.email}</p>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-[var(--color-highlight)] text-[var(--color-brand-accent)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-brand-accent)]/10">
                        {profile?.studentLevel || 'Standard Track'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Member since {new Date(user.metadata.creationTime || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setView('dashboard')}
                  className="px-6 py-3 rounded-2xl bg-zinc-100 dark:bg-white/5 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all self-start"
                >
                  <LayoutGrid size={16} />
                  Dashboard
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                <div className="space-y-10">
                  <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Academic Focus</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['Elementary School', 'Middle School', 'High School', 'College', 'Lifelong Learner'].map(l => (
                        <button 
                          key={l}
                          onClick={() => updateProfileFields({ studentLevel: l })}
                          className={cn(
                            "px-5 py-4 rounded-2xl text-xs font-bold text-left transition-all border",
                            profile?.studentLevel === l 
                              ? "bg-black text-white dark:bg-white dark:text-black border-transparent shadow-xl" 
                              : "bg-transparent border-zinc-200 dark:border-white/5 text-zinc-500 hover:border-zinc-300 dark:hover:border-white/20"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Intelligence Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border dark:border-white/5">
                        <div className="space-y-1">
                          <div className="font-bold">Simplification Mode</div>
                          <div className="text-xs text-zinc-500">"Explain Like I'm Five" for all insights.</div>
                        </div>
                        <button 
                          onClick={() => updateProfileFields({ simplifyMode: profile?.simplifyMode === 'ELI5' ? 'Standard' : 'ELI5' })}
                          className={cn(
                            "w-14 h-8 rounded-full transition-all relative shrink-0",
                            profile?.simplifyMode === 'ELI5' ? "bg-[var(--color-brand-accent)]" : "bg-zinc-200 dark:bg-zinc-800"
                          )}
                        >
                          <motion.div 
                            animate={{ x: profile?.simplifyMode === 'ELI5' ? 26 : 4 }}
                            className="absolute top-1 left-0 w-6 h-6 rounded-full bg-white shadow-xl"
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border dark:border-white/5">
                        <div className="space-y-1">
                          <div className="font-bold">Instant Logic</div>
                          <div className="text-xs text-zinc-500">Show step-by-step solutions without asking.</div>
                        </div>
                        <button 
                          onClick={() => updateProfileFields({ showSolutionsImmediately: !profile?.showSolutionsImmediately })}
                          className={cn(
                            "w-14 h-8 rounded-full transition-all relative shrink-0",
                            profile?.showSolutionsImmediately ? "bg-[var(--color-brand-accent)]" : "bg-zinc-200 dark:bg-zinc-800"
                          )}
                        >
                          <motion.div 
                            animate={{ x: profile?.showSolutionsImmediately ? 26 : 4 }}
                            className="absolute top-1 left-0 w-6 h-6 rounded-full bg-white shadow-xl"
                          />
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-10">
                  <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Account Sovereignty</h3>
                    <div className="space-y-4">
                      <button 
                        onClick={async () => {
                          if (!user) return;
                          if (confirm("Delete all history and bookmarks? This cannot be undone.")) {
                            try {
                              const batch = writeBatch(db);
                              
                              // Add history to batch
                              history.forEach(h => {
                                const hRef = doc(db, 'users', user.uid, 'history', h.id);
                                batch.delete(hRef);
                              });
                              
                              // Add bookmarks to batch
                              bookmarks.forEach(b => {
                                const bRef = doc(db, 'users', user.uid, 'bookmarks', b.id);
                                batch.delete(bRef);
                              });
                              
                              await batch.commit();
                              alert("Your curiosity records have been wiped clean.");
                            } catch (error) {
                              console.error("Wipe failed:", error);
                              alert("Failed to wipe records. Please try again.");
                            }
                          }
                        }}
                        className="w-full p-6 rounded-3xl bg-zinc-50 dark:bg-white/5 border dark:border-white/5 text-left flex items-center justify-between group hover:border-red-500/30 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="font-bold group-hover:text-red-500 transition-colors">Wipe Curiosity Records</div>
                          <div className="text-xs text-zinc-500">Deletes all doubt history and bookmarks permanently.</div>
                        </div>
                        <Trash2 size={20} className="text-zinc-300 group-hover:text-red-500 transition-colors" />
                      </button>

                      <button 
                        onClick={() => alert("Help system coming soon!")}
                        className="w-full p-6 rounded-3xl bg-zinc-50 dark:bg-white/5 border dark:border-white/5 text-left flex items-center justify-between group transition-all"
                      >
                        <div className="space-y-1">
                          <div className="font-bold">Help & Reflection</div>
                          <div className="text-xs text-zinc-500">Report an error or suggest an improvement.</div>
                        </div>
                        <HelpCircle size={20} className="text-zinc-300" />
                      </button>

                      <button 
                        onClick={() => signOut(auth)}
                        className="w-full p-6 rounded-3xl bg-red-500/[0.03] border border-red-500/10 text-left flex items-center justify-between group hover:bg-red-500/5 transition-all mt-6"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-red-500">Terminate Session</div>
                          <div className="text-xs text-red-500/50">Log out of your current account.</div>
                        </div>
                        <LogOut size={20} className="text-red-500" />
                      </button>
                    </div>
                  </section>

                  <section className="p-8 rounded-[40px] bg-[var(--color-brand-accent)] text-white relative overflow-hidden shadow-2xl">
                    <div className="relative z-10 space-y-4">
                      <h3 className="text-2xl font-serif italic text-white/90">Keep unblurring.</h3>
                      <p className="text-sm font-medium text-white/70 leading-relaxed">
                        Every question asked is a step towards absolute clarity. Your growth as a {profile?.studentLevel?.toLowerCase() || 'student'} is tracked through your curiosity.
                      </p>
                      <div className="flex items-center gap-6 pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-black">{history.length}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Doubts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black">{bookmarks.length}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Saved</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black">{userCircles.length}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Circles</div>
                        </div>
                      </div>
                    </div>
                    <Sparkles size={120} className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12" />
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            
            {/* TILE 1: Primary Work Area (Main Doubt or Chat) */}
            <div className="lg:col-span-1 flex flex-col gap-6 h-full overflow-hidden">
              <section className={cn(
                "flex-1 rounded-[32px] border shadow-sm relative overflow-hidden flex flex-col transition-all duration-700",
                profile?.theme === 'dark' ? "bg-zinc-900/50 border-white/5" : "bg-white border-zinc-200/50"
              )}>
                {isCircleOpen ? (
                  <CircleChat 
                    user={user} 
                    profileName={profile?.displayName}
                    circleId={activeCircleId} 
                    title={activeCircleId === 'global-unblur' ? 'Main Hub' : userCircles.find(c => c.id === activeCircleId)?.name}
                    topic={activeCircleId === 'global-unblur' ? 'General Discussion' : userCircles.find(c => c.id === activeCircleId)?.topic}
                    onClose={() => setIsCircleOpen(false)} 
                    theme={profile?.theme}
                  />
                ) : (
                  <div className="h-full flex flex-col relative overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                      <AnimatePresence mode="wait">
                        {!result ? (
                          <motion.div 
                            key="input"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-10"
                          >
                            <div className="space-y-4">
                              <h2 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight">
                                What's feeling <span className="text-[var(--color-brand-accent)] italic">blurry?</span>
                              </h2>
                              <p className="text-zinc-500 text-base md:text-lg font-medium opacity-60">
                                Explain it in your own words, or just paste the problem.
                              </p>
                            </div>
                            
                            <div className="w-full relative group">
                              <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="E.g. How does photosynthesis work in deep sea plants?"
                                className={cn(
                                  "w-full h-48 p-10 pr-24 rounded-[40px] border-2 text-xl font-medium resize-none transition-all outline-none",
                                  profile?.theme === 'dark' 
                                    ? "bg-zinc-950 border-white/5 focus:border-white/20 text-white" 
                                    : "bg-zinc-50 border-zinc-100 focus:border-[var(--color-brand-accent)] text-zinc-900 shadow-inner"
                                )}
                              />
                              
                              {/* Quick Actions Bar */}
                              <div className="absolute left-8 bottom-8 flex items-center gap-3">
                                <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  onChange={handleFileSelect} 
                                  accept="image/*" 
                                  className="hidden" 
                                />
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-[var(--color-brand-accent)] transition-all"
                                  title="Gallery"
                                >
                                  <ImageIcon size={18} />
                                </button>
                                <button 
                                  onClick={() => setIsCameraOpen(true)}
                                  className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-[var(--color-brand-accent)] transition-all"
                                  title="Camera"
                                >
                                  <Camera size={18} />
                                </button>
                                <button 
                                  onClick={startSpeechRecognition}
                                  className={cn(
                                    "p-3 rounded-2xl transition-all",
                                    isRecording 
                                      ? "bg-red-500 text-white animate-pulse" 
                                      : "bg-zinc-100 dark:bg-white/5 text-zinc-500 hover:text-[var(--color-brand-accent)]"
                                  )}
                                  title="Voice"
                                >
                                  <Mic size={18} />
                                </button>
                              </div>

                              <button 
                                onClick={handleUnblur}
                                disabled={(!input.trim() && !stagedImage) || isLoading}
                                className={cn(
                                  "absolute bottom-8 right-8 px-8 py-4 rounded-[20px] shadow-2xl transition-all flex items-center gap-3",
                                  (input.trim() || stagedImage)
                                    ? "bg-black text-white dark:bg-white dark:text-black scale-100 hover:scale-105 active:scale-95" 
                                    : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 scale-90 opacity-50 pointer-events-none"
                                )}
                              >
                                {isLoading ? <RefreshCcw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                <span className="text-sm font-black uppercase tracking-widest">Unblur</span>
                              </button>

                              {stagedImage && (
                                <div className="absolute top-8 right-8 w-20 h-20 rounded-2xl overflow-hidden border-2 border-[var(--color-brand-accent)] shadow-xl animate-in zoom-in">
                                  <img src={stagedImage} className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => setStagedImage(null)}
                                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="result"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-4xl mx-auto space-y-12 py-4"
                          >
                            <div className="flex items-center justify-between border-b pb-8 dark:border-white/5 sticky top-0 bg-transparent backdrop-blur-md z-20 pt-2">
                              <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-brand-accent)] mb-2">Unblurred Analysis</div>
                                <h2 className="text-3xl font-serif font-bold truncate max-w-lg">{input}</h2>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => toggleBookmark(input, result)}
                                  className={cn(
                                    "p-4 rounded-[20px] transition-all",
                                    bookmarks.find(b => b.topic === input)
                                      ? "bg-[var(--color-brand-accent)] text-white"
                                      : (profile?.theme === 'dark' ? "bg-white/5 text-white hover:bg-white/10" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200")
                                  )}
                                >
                                  <Bookmark size={22} fill={bookmarks.find(b => b.topic === input) ? "currentColor" : "none"} />
                                </button>
                                <button 
                                  onClick={() => { setResult(null); setInput(''); }}
                                  className="p-4 rounded-[20px] bg-zinc-900 text-white hover:bg-black transition-all shadow-xl"
                                >
                                  <RefreshCcw size={22} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-12 pb-20">
                              <SectionCard title="The core idea" icon={Lightbulb} content={result.coreIdea} delay={0.1} theme={profile?.theme} />
                              <SectionCard title="The analogy" icon={RefreshCcw} content={result.analogy} delay={0.2} variant="analogy" theme={profile?.theme} />
                              <SectionCard title="Quick steps" icon={CheckCircle2} content={result.quickSteps} delay={0.3} variant="steps" theme={profile?.theme} />
                              {result.solution && (profile?.showSolutionsImmediately) && (
                                <div className="bg-zinc-900 text-white rounded-[32px] p-10 shadow-2xl relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 blur-[60px] group-hover:bg-[#D4AF37]/20 transition-all" />
                                  <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white mb-8 flex items-center gap-3">
                                    <CheckCircle2 size={16} className="text-[#D4AF37]" />
                                    The solution
                                  </h3>
                                  <div className="prose prose-invert prose-brand max-w-none prose-p:leading-relaxed text-white [&_*]:!text-white">
                                    <MathMarkdown content={result.solution} />
                                  </div>
                                </div>
                              )}
                              <SectionCard title="Teacher prep" icon={HelpCircle} content={result.teacherPrep} delay={0.5} variant="prep" theme={profile?.theme} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Study Circle Tile (Bigger) */}
            <section className={cn(
              "lg:col-span-1 rounded-[32px] border shadow-sm flex flex-col overflow-hidden",
              profile?.theme === 'dark' ? "bg-zinc-900/50 border-white/5" : "bg-white border-zinc-200/50"
            )}>
                <div className="p-8 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-50 dark:bg-white/5 rounded-xl">
                      <Users size={18} className="text-[var(--color-brand-accent)]" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Study Circles</h3>
                  </div>
                  <button 
                    onClick={() => setIsCreatingCircle(!isCreatingCircle)}
                    className="p-2 rounded-xl bg-zinc-50 dark:bg-white/5 text-zinc-500 hover:text-[var(--color-brand-accent)] transition-all"
                  >
                    {isCreatingCircle ? <X size={20} /> : <Plus size={20} />}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                  <AnimatePresence>
                    {isCreatingCircle ? (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 space-y-4 shadow-inner">
                        <input 
                          placeholder="Circle Name" 
                          className="w-full bg-white dark:bg-zinc-900 p-3 rounded-xl border-none outline-none text-xs font-bold shadow-sm"
                          value={newCircleName} onChange={(e) => setNewCircleName(e.target.value)}
                        />
                        <input 
                          placeholder="Topic (e.g. Physics 101)" 
                          className="w-full bg-white dark:bg-zinc-900 p-3 rounded-xl border-none outline-none text-xs shadow-sm"
                          value={newCircleTopic} onChange={(e) => setNewCircleTopic(e.target.value)}
                        />
                        <button 
                          disabled={!newCircleName || !newCircleTopic}
                          onClick={() => {
                            const circlesRef = collection(db, 'circles');
                            addDoc(circlesRef, {
                              name: newCircleName,
                              topic: newCircleTopic,
                              createdBy: user.uid,
                              createdAt: serverTimestamp()
                            });
                            setNewCircleName('');
                            setNewCircleTopic('');
                            setIsCreatingCircle(false);
                          }}
                          className="w-full py-3 bg-[var(--color-brand-accent)] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
                        >
                          Forge Circle
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        <div 
                          onClick={() => { setActiveCircleId('global-unblur'); setIsCircleOpen(true); }}
                          className={cn(
                            "p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-between group",
                            activeCircleId === 'global-unblur' && isCircleOpen
                              ? "bg-[var(--color-brand-accent)] border-transparent text-white shadow-xl"
                              : "bg-zinc-50 dark:bg-zinc-900/50 border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                          )}
                        >
                          <div>
                            <div className="text-xs font-bold leading-tight italic">Main Global Hub</div>
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-40 mt-1">Public Study Space</div>
                          </div>
                          <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                        </div>
                        {userCircles.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => { setActiveCircleId(c.id); setIsCircleOpen(true); }}
                            className={cn(
                              "p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-between group",
                              activeCircleId === c.id && isCircleOpen
                                ? "bg-[var(--color-brand-accent)] border-transparent text-white shadow-xl"
                                : "bg-zinc-50 dark:bg-zinc-900/50 border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                            )}
                          >
                            <div>
                              <div className="text-xs font-bold leading-tight">{c.name}</div>
                              <div className="text-[9px] font-black uppercase tracking-widest opacity-40 mt-1">{c.topic}</div>
                            </div>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                          </div>
                        ))}
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* History & Backlog Tile */}
              <section className={cn(
                "lg:col-span-1 rounded-[32px] border shadow-sm p-8 flex flex-col overflow-hidden",
                profile?.theme === 'dark' ? "bg-zinc-900/50 border-white/5" : "bg-white border-zinc-200/50"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-widest opacity-30">Knowledge History</h3>
                  <div className="flex items-center gap-3">
                    {history.length > 0 && (
                      <button 
                        onClick={async () => {
                          if (confirm("Clear your entire history?")) {
                            try {
                              const batch = writeBatch(db);
                              history.forEach(h => {
                                const hRef = doc(db, 'users', user.uid, 'history', h.id);
                                batch.delete(hRef);
                              });
                              await batch.commit();
                            } catch (err) {
                              console.error("Clear history failed:", err);
                            }
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-all opacity-40 hover:opacity-100"
                        title="Clear History"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <History size={16} className="opacity-30" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                  {history.slice(0, 10).map(h => (
                    <div 
                      key={h.id}
                      className="group p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex items-center justify-between border border-transparent hover:border-zinc-100 dark:hover:border-white/5"
                    >
                      <div 
                        className="flex-1 flex items-center gap-3 cursor-pointer overflow-hidden"
                        onClick={() => { setInput(h.topic); setIsCircleOpen(false); setActiveCircleId('global-unblur'); handleUnblur(); }}
                      >
                        <div className="p-1.5 bg-zinc-100 dark:bg-white/5 rounded-lg shrink-0">
                          <Brain size={12} className="text-zinc-400 group-hover:text-[var(--color-brand-accent)] transition-colors" />
                        </div>
                        <span className="text-xs font-medium truncate opacity-70 group-hover:opacity-100">{h.topic}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(h.id);
                          }}
                          className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-40 group-hover:opacity-100"
                          title="Remove"
                        >
                          <Trash size={12} />
                        </button>
                        <ArrowRight size={10} className="opacity-0 group-hover:opacity-50 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                      <div className="text-xs font-medium opacity-30 italic">No activity unblurred.</div>
                    </div>
                  )}
                </div>
              </section>
          </div>
        )}
      </main>

      <AnimatePresence>
        {user && profile && !profile.hasCompletedOnboarding && (
          <OnboardingOverlay 
            theme={profile.theme} 
            onComplete={completeOnboarding} 
          />
        )}
      </AnimatePresence>

      <CameraModal 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(img) => setStagedImage(img)}
        theme={profile?.theme}
      />
    </div>
  );
}

function CameraModal({ isOpen, onClose, onCapture, theme }: { isOpen: boolean, onClose: () => void, onCapture: (img: string) => void, theme?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
        .then(s => {
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => {
          console.error("Camera error:", err);
          // Fallback for older devices/browsers that might fail high-res request
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => {
              setStream(s);
              if (videoRef.current) videoRef.current.srcObject = s;
            })
            .catch(() => {
              alert("Could not access camera. Please check permissions.");
              onClose();
            });
        });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        onCapture(canvasRef.current.toDataURL('image/jpeg', 0.9));
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} 
        animate={{ scale: 1, y: 0 }}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl flex flex-col",
          theme === 'dark' ? "bg-zinc-900 border border-white/10" : "bg-white"
        )}
      >
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8 flex items-center justify-center">
          <button 
            onClick={capture} 
            className="w-20 h-20 rounded-full border-4 border-[var(--color-brand-accent)] p-1 flex items-center justify-center active:scale-95 transition-all group"
          >
             <div className="w-full h-full rounded-full bg-[var(--color-brand-accent)] group-hover:scale-110 transition-transform" />
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
}
