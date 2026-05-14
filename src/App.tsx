import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock, 
  Plus, 
  Trash2, 
  Download,
  Info,
  ChevronRight,
  ChevronDown,
  Search,
  LayoutDashboard,
  Users,
  Settings,
  Edit2,
  Check,
  X,
  ArrowRight,
  Palette,
  LayoutGrid,
  Calendar,
  MonitorSmartphone,
  Building2,
  Clock3,
  CircleCheck,
  Pencil,
  Timer,
  Bell,
  Database,
  ShieldAlert,
  ShieldCheck,
  History,
  Lock,
  LogOut,
  Key,
  Eraser,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  isAfter, 
  isBefore,
  differenceInMinutes, 
  isValid, 
  compareAsc, 
  parse, 
  parseISO,
  isWithinInterval, 
  startOfDay,
  startOfWeek,
  endOfWeek,
  getWeekOfMonth,
  startOfYear,
  addDays,
  subDays,
  addMonths,
  startOfMonth,
  subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from './lib/utils';
import { AttendanceRecord, Exception, AnalysisResult, HybridSchedule, GeneralException, ParticularIncident, IncidentType, UploadHistoryItem } from './types';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, query, where, getDocFromServer } from 'firebase/firestore';

const DEFAULT_ENTRY = '08:00';
const DEFAULT_EXIT = '16:00';

const PRELOADED_HORARIOS: Exception[] = [
  { id: '1', employeeName: 'TRICOT NOVOA XIMENA MERCEDES', startDate: '01/02/2026', endDate: '31/12/2026', deferredEntryTime: '08:30', deferredExitTime: '16:30' },
  { id: '2', employeeName: 'TRICOT NOVOA XIMENA MERCEDES', startDate: '01/08/2025', endDate: '31/01/2026', deferredEntryTime: '08:30', deferredExitTime: '16:30' },
  { id: '3', employeeName: 'NUÑEZ SALAZAR JOSE EDUARDO', startDate: '18/02/2026', endDate: '31/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '4', employeeName: 'BAEZ HERNÁNDEZ MATÍAS FERNANDO', startDate: '10/03/2026', endDate: '15/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '5', employeeName: 'CARRASCO CONCHA PRISCILA ANDREA', startDate: '01/01/2026', endDate: '31/03/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '6', employeeName: 'JUBAL MONTENEGRO FELIPE SEBASTIAN', startDate: '31/07/2025', endDate: '01/01/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '7', employeeName: 'JUBAL MONTENEGRO FELIPE SEBASTIAN', startDate: '02/01/2026', endDate: '31/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '8', employeeName: 'MATELUNA VERGARA JOSÉ LUIS', startDate: '21/01/2026', endDate: '31/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '9', employeeName: 'VELASCO SANCHEZ DIEGO GUILLERMO', startDate: '01/01/2026', endDate: '31/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '10', employeeName: 'OLGUIN SALAZAR VERONICA ALICIA', startDate: '31/07/2025', endDate: '01/01/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '11', employeeName: 'OLGUIN SALAZAR VERONICA ALICIA', startDate: '02/01/2026', endDate: '31/12/2026', deferredEntryTime: '07:30', deferredExitTime: '15:30' },
  { id: '12', employeeName: 'BARRA QUEVEDO JAVIERA FABIOLA', startDate: '19/02/2026', endDate: '31/12/2026', deferredEntryTime: '08:30', deferredExitTime: '16:30' },
  { id: '13', employeeName: 'CLARK ROJAS DIEGO ALEXIS', startDate: '31/07/2025', endDate: '01/01/2026', deferredEntryTime: '08:30', deferredExitTime: '16:30' },
  { id: '14', employeeName: 'CLARK ROJAS DIEGO ALEXIS', startDate: '23/03/2026', endDate: '31/12/2026', deferredEntryTime: '08:30', deferredExitTime: '16:30' }
];

// Helper to parse DD/MM/YYYY or YYYY-MM-DD from exceptions
const isInvalidDate = (date: any) => {
  if (date instanceof Date) return isNaN(date.getTime());
  return !date || isNaN(new Date(date).getTime());
};

const parseExDate = (s: string) => {
  if (!s) return new Date();
  const parts = String(s).split(/[\/-]/);
  
  let d: Date;
  if (parts.length < 3) {
    d = new Date(s);
  } else if (parts[0].length === 4) {
    // YYYY-MM-DD
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    // DD/MM/YYYY
    d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  
  if (isInvalidDate(d)) return new Date(); // Fallback to now instead of invalid date
  return d;
};

const safeFormat = (date: Date | null | undefined, formatStr: string, fallback = '-') => {
  if (!date || isInvalidDate(date)) return fallback;
  try {
    return format(date, formatStr, { locale: es });
  } catch (e) {
    return fallback;
  }
};

const safeParseDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  // Handle Excel numbers if they leak through
  if (typeof dateStr === 'number') {
    dateStr = String(dateStr);
  }
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return isInvalidDate(d) ? null : d;
};

const formatToDMY = (s: string) => {
  try {
     const d = parseExDate(s);
     return safeFormat(d, 'dd/MM/yyyy');
  } catch(e) { return s; }
};

const cleanNameForDisplay = (str: string) => {
  if (!str) return "";
  
  // Specific fix for known character corruption (Mojibake)
  // e.g. "JOSE NU䅚" -> "JOSE NUÑEZ" or similar.
  // We'll replace CJK ranges if they appear in names with their probable Spanish equivalents 
  // OR just provide a direct fix for the reported case if it's high priority.
  let cleaned = str
    .replace(/JOSE NU䅚/gi, 'JOSE NUÑEZ')
    .replace(/JOSE NUEZ/gi, 'JOSE NUÑEZ');

  // Removes common Mojibake patterns for 'ñ' and accented characters
  // Often 'ñ' is C3 B1. If broken into C3 (Ã) and B1 (±) or other combinations.
  cleaned = cleaned
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú');

  // Removes standard accents but PRESERVES Ñ
  return cleaned
    .replace(/[áäàâ]/g, 'a')
    .replace(/[éëèê]/g, 'e')
    .replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o')
    .replace(/[úüùû]/g, 'u')
    .replace(/[ÁÄÀÂ]/g, 'A')
    .replace(/[ÉËÈÊ]/g, 'E')
    .replace(/[ÍÏÌÎ]/g, 'I')
    .replace(/[ÓÖÒÔ]/g, 'O')
    .replace(/[ÚÜÙÛ]/g, 'U')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeName = (name: string) => {
  if (!name) return "";
  return name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove tildes
    .replace(/[^a-z0-9\s]/g, "") // Remove non-alphanumeric except spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
};

const normalizeString = (str: string) => {
  if (!str) return "";
  return normalizeName(str);
};

const matchesFlexible = (name: string, search: string) => {
  const nName = normalizeString(name);
  const nSearch = normalizeString(search);
  if (!nSearch) return true;
  
  const searchWords = nSearch.split(' ').filter(w => w.length > 0);
  
  // To be flexible: ALL words in search must be found as substrings in the name
  // This is less strict than exact word matching but more precise than "any 2 words"
  // Alternatively: if user wants "match at least 2 words" regardless of total words:
  if (searchWords.length > 1) {
    let matches = 0;
    searchWords.forEach(sw => {
      if (nName.includes(sw)) matches++;
    });
    return matches >= Math.min(searchWords.length, 2);
  }
  
  return nName.includes(nSearch);
};

const getDaySafe = (date: any) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? 0 : d.getDay();
  } catch (e) {
    return 0;
  }
};

const getSpanishDayAbbr = (date: any) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isInvalidDate(d)) return '-';
    const days = ['DOM', 'LUN', 'MAR', 'MIER', 'JUEV', 'VIER', 'SAB'];
    return days[d.getDay()];
  } catch (e) {
    return '-';
  }
};

const isFuzzyMatch = (s1: string, s2: string) => {
  const n1 = normalizeString(s1);
  const n2 = normalizeString(s2);
  if (n1 === n2) return true;
  
  const words1 = n1.split(/\s+/).filter(w => w.length > 0);
  const words2 = n2.split(/\s+/).filter(w => w.length > 0);
  
  const matches = words1.filter(w => words2.includes(w)).length;
  return matches >= 2;
};

const deduplicateNames = (names: string[]) => {
  if (!names || names.length === 0) return [];
  
  const uniqueNames: string[] = [];
  // Sort by length descending to prefer more complete names
  // Also remove exact duplicates first with Set
  const sortedNames = Array.from(new Set(names)).sort((a, b) => b.length - a.length);
  
  sortedNames.forEach(name => {
    // Check if this name is already represented by a fuzzy match in our unique list
    const isAlreadyRepresented = uniqueNames.some(u => isFuzzyMatch(name, u));
    if (!isAlreadyRepresented) {
      uniqueNames.push(name);
    }
  });
  
  return uniqueNames.sort();
};

const getMonthFromSpanishName = (name: string): number => {
  const months: Record<string, number> = {
    'ene': 1, 'ene.': 1, 'enero': 1,
    'feb': 2, 'feb.': 2, 'febrero': 2,
    'mar': 3, 'mar.': 3, 'marzo': 3,
    'abr': 4, 'abr.': 4, 'abril': 4,
    'may': 5, 'mayo': 5,
    'jun': 6, 'junio': 6,
    'jul': 7, 'julio': 7,
    'ago': 8, 'ago.': 8, 'agosto': 8,
    'sep': 9, 'sep.': 9, 'septiembre': 9,
    'oct': 10, 'oct.': 10, 'octubre': 10,
    'nov': 11, 'nov.': 11, 'noviembre': 11,
    'dic': 12, 'dic.': 12, 'diciembre': 12
  };
  for (const key in months) {
    if (name.toLowerCase().startsWith(key)) return months[key];
  }
  return 1;
};

export default function App() {
  const [data, setData] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('timetrack_data');
    if (!saved) return [];
    try {
      return JSON.parse(saved, (key, value) => {
        if (key === 'date') return new Date(value);
        return value;
      });
    } catch (e) {
      return [];
    }
  });
  const [exceptions, setExceptions] = useState<Exception[]>(() => {
    const saved = localStorage.getItem('timetrack_exceptions');
    return saved ? JSON.parse(saved) : PRELOADED_HORARIOS;
  });
  const [hybridSchedules, setHybridSchedules] = useState<HybridSchedule[]>(() => {
    const saved = localStorage.getItem('timetrack_hybrid');
    return saved ? JSON.parse(saved) : [];
  });
  const [generalExceptions, setGeneralExceptions] = useState<GeneralException[]>(() => {
    const saved = localStorage.getItem('timetrack_general_exceptions');
    return saved ? JSON.parse(saved) : [];
  });
  const [particularIncidents, setParticularIncidents] = useState<ParticularIncident[]>(() => {
    const saved = localStorage.getItem('timetrack_particular_incidents');
    return saved ? JSON.parse(saved) : [];
  });
  const [processedDates, setProcessedDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('timetrack_dates');
    return saved ? JSON.parse(saved) : [];
  });
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>(() => {
    const saved = localStorage.getItem('timetrack_upload_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historySort, setHistorySort] = useState<{ key: keyof UploadHistoryItem | 'dateRangeStart'; direction: 'asc' | 'desc' }>({
    key: 'uploadDate',
    direction: 'desc'
  });

  const sortedUploadHistory = useMemo(() => {
    return [...uploadHistory].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (historySort.key === 'dateRangeStart') {
        aVal = a.dateRange?.start || '';
        bVal = b.dateRange?.start || '';
      } else {
        aVal = a[historySort.key] || '';
        bVal = b[historySort.key] || '';
      }

      if (aVal < bVal) return historySort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return historySort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [uploadHistory, historySort]);

  const toggleHistorySort = (key: keyof UploadHistoryItem | 'dateRangeStart') => {
    setHistorySort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };
  const [selectedUpload, setSelectedUpload] = useState<UploadHistoryItem | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      
      // Auto-admin for the owner
      if (u?.email?.toLowerCase() === 'matiasbaezh@gmail.com') {
        setIsAdmin(true);
        localStorage.setItem('timetrack_is_admin', 'true');
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes o abre la app en una pestaña nueva.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        // Just silent ignore or a small hint
      } else {
        setLoginError("Error al iniciar sesión: " + (error.message || "Intenta nuevamente."));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [dateFilterStart, setDateFilterStart] = useState(safeFormat(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [dateFilterEnd, setDateFilterEnd] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [filterLateness, setFilterLateness] = useState(false);
  const [filterEarlyExit, setFilterEarlyExit] = useState(false);
  const [filterMissing, setFilterMissing] = useState(false);

  const globalDateRange = useMemo(() => {
    if (data.length === 0) return { min: null, max: null };
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    data.forEach(r => {
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      if (isInvalidDate(d)) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });
    return { min: minDate, max: maxDate };
  }, [data]);
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('timetrack_is_admin') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ user: '', password: '' });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedJustification, setSelectedJustification] = useState<ParticularIncident | GeneralException | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHybridId, setEditingHybridId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem('timetrack_schedule');
    return saved ? JSON.parse(saved) : { entry: DEFAULT_ENTRY, exit: DEFAULT_EXIT };
  });
  const [satSchedule, setSatSchedule] = useState(() => {
    const saved = localStorage.getItem('timetrack_sat_schedule');
    return saved ? JSON.parse(saved) : { entry: '09:00', exit: '13:00' };
  });

  const [appOptions, setAppOptions] = useState(() => {
    const saved = localStorage.getItem('timetrack_app_options');
    return saved ? JSON.parse(saved) : {
      autoLate: true,
      earlyExit: true
    };
  });

  const [tolerances, setTolerances] = useState(() => {
    const saved = localStorage.getItem('timetrack_tolerances');
    const defaults = { 
      entryGrace: 10, entryYellow: 15, entryRed: 30,
      exitGrace: 10, exitYellow: 15, exitRed: 30 
    };
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      // Migration: if old format exists, map them to entry
      if (parsed.entry !== undefined && parsed.entryGrace === undefined) {
        return {
          entryGrace: Math.min(parsed.entry, 60),
          entryYellow: Math.min(parsed.yellow || 15, 60),
          entryRed: Math.min(parsed.red || 30, 60),
          exitGrace: 10,
          exitYellow: 15,
          exitRed: 30
        };
      }
      return { ...defaults, ...parsed };
    } catch (e) {
      return defaults;
    }
  });

  const generateId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (e) {}
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('timetrack_theme');
    return saved ? JSON.parse(saved) : {
      primary: 'blue', // blue, teal, purple
    };
  });

  // Persistence is handled by the main useEffect below (line 788 approx)

  // Sync with server logic
  const syncWithServer = async (action: 'load' | 'save', newData?: any) => {
    if (!user) return;
    setIsCloudSyncing(true);
    try {
      if (action === 'save') {
        const payload = newData || {
          exceptions,
          hybridSchedules,
          generalExceptions,
          particularIncidents,
          processedDates,
          uploadHistory,
          config: { schedule, satSchedule, appOptions, tolerances, theme }
        };
        
        // Save config and metadata to a single document
        await setDoc(doc(db, 'settings', 'config'), payload);
        
        // Handle data (AttendanceRecord) separately if it changed
        if (newData?.data || (action === 'save' && !newData)) {
          const recordsToSave = newData?.data || data;
          // Store records as one blob in a dedicated doc if under 1MB.
          await setDoc(doc(db, 'app_data', 'records_blob'), { data: recordsToSave });
        }
      } else {
        // Load from Firestore - using getDocFromServer to attempt recovery from "offline" states
        let configSnap;
        try {
          configSnap = await getDocFromServer(doc(db, 'settings', 'config'));
        } catch (err) {
          console.warn("getDocFromServer failed, falling back to cache", err);
          configSnap = await getDoc(doc(db, 'settings', 'config'));
        }

        if (configSnap.exists()) {
          const cloudData = configSnap.data();
          if (cloudData.exceptions) setExceptions(cloudData.exceptions);
          if (cloudData.hybridSchedules) setHybridSchedules(cloudData.hybridSchedules);
          if (cloudData.generalExceptions) setGeneralExceptions(cloudData.generalExceptions);
          if (cloudData.particularIncidents) setParticularIncidents(cloudData.particularIncidents);
          if (cloudData.processedDates) setProcessedDates(cloudData.processedDates);
          if (cloudData.uploadHistory) setUploadHistory(cloudData.uploadHistory);
          if (cloudData.config) {
            setSchedule(cloudData.config.schedule);
            setSatSchedule(cloudData.config.satSchedule);
            setAppOptions(cloudData.config.appOptions);
            setTolerances(cloudData.config.tolerances);
            setTheme(cloudData.config.theme);
          }
        }
        
        let recordsSnap;
        try {
          recordsSnap = await getDocFromServer(doc(db, 'app_data', 'records_blob'));
        } catch (err) {
          recordsSnap = await getDoc(doc(db, 'app_data', 'records_blob'));
        }

        if (recordsSnap.exists()) {
          const { data: cloudRecords } = recordsSnap.data();
          if (cloudRecords) {
            const parsedData = cloudRecords.map((r: any) => ({
              ...r,
              date: r.date ? (typeof r.date === 'string' ? parseISO(r.date) : new Date(r.date)) : new Date()
            }));
            setData(parsedData);
          }
        }
      }
    } catch (e) {
      console.error('Firestore Sync error:', e);
      // We don't alert here to avoid spamming the user during flaky connectivity
    } finally {
      setIsCloudSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      syncWithServer('load');
    }
  }, [user]);

  useEffect(() => {
    if (globalDateRange.min && globalDateRange.max) {
      // Only auto-init if currently empty or explicitly at placeholder defaults
      const currentStart = dateFilterStart;
      const currentEnd = dateFilterEnd;
      if (!currentStart || !currentEnd || currentStart.includes('2026-01-01')) { // assuming 2026-01-01 is roughly what I set before
         setDateFilterStart(safeFormat(globalDateRange.min, 'yyyy-MM-dd'));
         setDateFilterEnd(safeFormat(globalDateRange.max, 'yyyy-MM-dd'));
      }
    }
  }, [globalDateRange, dateFilterStart, dateFilterEnd]);

  // Debounced auto-save to cloud
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only save if we are not currently loading
      if (!isCloudSyncing) {
        syncWithServer('save');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [data, exceptions, hybridSchedules, generalExceptions, particularIncidents, processedDates, uploadHistory, schedule, satSchedule, appOptions, tolerances, theme]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'report' | 'workers' | 'horarios' | 'hybrid' | 'justifications' | 'datos' | 'config'>('report');
  const [bulkText, setBulkText] = useState('');

  const extractTime = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return safeFormat(val, 'HH:mm');
    }
    // Handle Excel serial numbers (fractions represent time)
    if (typeof val === 'number') {
      const fractionalPart = val % 1;
      // If there's no fraction and it's a large number, it's just a date
      if (fractionalPart === 0 && val >= 1) return null;
      
      const totalSeconds = Math.round(fractionalPart * 86400);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const str = String(val).trim();
    // Try to find HH:mm pattern in string
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return null;
  };

  const extractDate = (val: any): Date | null => {
    if (!val) return null;
    
    if (val instanceof Date && !isNaN(val.getTime())) {
      return new Date(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
    }

    if (typeof val === 'number') {
      try {
        const dateObj = XLSX.SSF.parse_date_code(val);
        if (dateObj) return new Date(dateObj.y, dateObj.m - 1, dateObj.d);
      } catch (e) {}
    }

    const str = String(val).trim();
    if (!str || str.length < 5) return null;

    // Try standard formats like 15/03/2026, 15-03-2026, or 15.03.2026
    const match = str.match(/(\d{1,2})[\/\-\.]([a-zA-Z0-9]{2,10})[\/\-\.](\d{2,4})/);
    if (match) {
      let d = parseInt(match[1]);
      let mStr = match[2].toLowerCase();
      let m = isNaN(Number(mStr)) ? getMonthFromSpanishName(mStr) : parseInt(mStr);
      let y = parseInt(match[3]);
      if (y < 100) y += 2000;
      
      const dObj = new Date(y, m - 1, d);
      return isNaN(dObj.getTime()) ? null : dObj;
    }

    // Try verbose formats like "15 de marzo 2026" or "15 de marzo de 2026"
    const verboseMatch = str.match(/(\d{1,2})\s+de\s+([a-zA-ZñÑ]{3,12})\s+(?:de\s+)?(\d{2,4})/i);
    if (verboseMatch) {
      let d = parseInt(verboseMatch[1]);
      let m = getMonthFromSpanishName(verboseMatch[2]);
      let y = parseInt(verboseMatch[3]);
      if (y < 100) y += 2000;
      const dObj = new Date(y, m - 1, d);
      return isNaN(dObj.getTime()) ? null : dObj;
    }

    // Fallback for YYYY-MM-DD or YYYY.MM.DD
    const isoMatch = str.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (isoMatch) {
      let y = parseInt(isoMatch[1]);
      let m = parseInt(isoMatch[2]);
      let d = parseInt(isoMatch[3]);
      const dObj = new Date(y, m - 1, d);
      return isNaN(dObj.getTime()) ? null : dObj;
    }

    return null;
  };

  const exportToExcel = (results: AnalysisResult[]) => {
    const flatData = results.flatMap(worker => 
      worker.details.map(d => ({
        Trabajador: worker.employeeName,
        Fecha: safeFormat(d.date, 'dd/MM/yyyy'),
        Dia: d.dayName,
        'Hora Ingreso': d.actualEntry || '--:--',
        'Hora Salida': d.actualExit || '--:--',
        'Horas Trabajadas': d.isJustifiedAbsence ? 0 : (d.hoursWorked || 0),
        'Atraso (min)': d.lateStatus === 'justified' ? 0 : (d.lateMinutes > 0 ? d.lateMinutes : 0),
        'Salida Anticipada (min)': d.exitStatus === 'justified' ? 0 : (d.earlyExitMinutes > 0 ? d.earlyExitMinutes : 0),
        'Estado': d.isJustifiedAbsence ? 'AUSENCIA JUSTIFICADA' : (d.isMissing ? (!d.actualEntry && !d.actualExit ? 'AUSENCIA' : (!d.actualEntry ? 'NO MARCA ENTRADA' : 'NO MARCA SALIDA')) : (d.lateStatus === 'justified' || d.exitStatus === 'justified' ? 'JUSTIFICADO' : 'REGULAR')),
        'Tipo Jornada': d.isHybrid ? 'Híbrida' : (d.scheduledEntry !== (getDaySafe(d.date) === 6 ? satSchedule.entry : schedule.entry) ? 'Flexible' : 'Regular')
      }))
    );

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Asistencia_${safeFormat(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // Corporate Blue
    doc.text(`Reporte de Asistencia de Personal`, 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${safeFormat(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 25);
    doc.text(`Filtro: ${safeFormat(safeParseDate(dateFilterStart), 'dd/MM/yyyy')} al ${safeFormat(safeParseDate(dateFilterEnd), 'dd/MM/yyyy')}`, 14, 30);
    if (searchTerm) {
      doc.text(`Busqueada: ${searchTerm}`, 14, 35);
    }

    // Stats Summary in PDF
    doc.setFontSize(11);
    doc.setTextColor(55, 57, 61);
    doc.text(`Resumen de Estadísticas:`, 14, 45);
    
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Días con Retraso: ${stats.lateDays} (${Math.round(stats.latePct)}%)`, 14, 52);
    doc.text(`Promedio Retraso: ${stats.avgLate} min (${Math.round(stats.avgLatePct)}%)`, 14, 58);
    doc.text(`Retiros Anticipados: ${stats.earlyExits} (${Math.round(stats.earlyExitPct)}%)`, 80, 52);
    doc.text(`Jornada Flexible: ${stats.exceptionsCount} funcionarios (${Math.round(stats.exceptionsPct)}%)`, 80, 58);
    doc.text(`Jornada Híbrida: ${stats.hybridCount} funcionarios (${Math.round(stats.hybridPct)}%)`, 14, 64);

    const tableRows = analyzedResults.flatMap(worker => 
      worker.details.map(d => [
        worker.employeeName,
        safeFormat(d.date, 'dd/MM/yyyy'),
        d.actualEntry || '--:--',
        d.actualExit || '--:--',
        d.lateStatus === 'hybrid' ? `[HÍBRIDA]` : d.lateStatus === 'justified' ? `[JUSTIFICADO]` : d.lateMinutes > 0 ? `${d.lateMinutes} min` : '-',
        d.exitStatus === 'hybrid' ? `[HÍBRIDA]` : d.exitStatus === 'justified' ? `[JUSTIFICADO]` : d.earlyExitMinutes > 0 ? `${d.earlyExitMinutes} min` : '-',
        d.isHybrid ? 'Híbrida' : (d.scheduledEntry !== (getDaySafe(d.date) === 6 ? satSchedule.entry : schedule.entry) ? 'Flexible' : 'Regular'),
        d.isJustifiedAbsence ? '[JUSTIFICADA]' : (d.hoursWorked !== null ? `${d.hoursWorked} h` : (d.isMissing ? (!d.actualEntry && !d.actualExit ? '[AUSENCIA]' : (!d.actualEntry ? '[NO ENTRADA]' : '[NO SALIDA]')) : '-'))
      ])
    );

    (autoTable as any)(doc, {
      head: [['Trabajador', 'Fecha', 'Entrada', 'Salida', 'Atraso', 'Sal. Ant.', 'Jornada', 'Hrs Trab.']],
      body: tableRows,
      startY: 70,
      theme: 'striped',
      headStyles: { fillColor: [55, 57, 61], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      didParseCell: (dataCell: any) => {
        if (dataCell.section === 'body') {
          // Column 4: Atraso
          if (dataCell.column.index === 4) {
            const val = String(dataCell.cell.raw);
            if (val.includes('[HÍBRIDA]')) {
              dataCell.cell.styles.textColor = [255, 255, 255];
              dataCell.cell.styles.fillColor = [78, 99, 206]; // Blue
            } else if (val.includes('[JUSTIFICADO]')) {
              dataCell.cell.styles.textColor = [255, 255, 255];
              dataCell.cell.styles.fillColor = [50, 191, 129]; // Green
            } else if (val !== '-') {
              const mins = parseInt(val);
              if (mins > 20) {
                dataCell.cell.styles.textColor = [255, 255, 255]; 
                dataCell.cell.styles.fillColor = [244, 74, 99]; // Red
              } else if (mins >= 11) {
                dataCell.cell.styles.textColor = [255, 255, 255]; 
                dataCell.cell.styles.fillColor = [255, 162, 39]; // Orange
              }
            }
          }
          // Column 5: Salida Ant.
          if (dataCell.column.index === 5) {
            const val = String(dataCell.cell.raw);
            if (val.includes('[HÍBRIDA]')) {
              dataCell.cell.styles.textColor = [255, 255, 255];
              dataCell.cell.styles.fillColor = [78, 99, 206]; // Blue
            } else if (val.includes('[JUSTIFICADO]')) {
              dataCell.cell.styles.textColor = [255, 255, 255];
              dataCell.cell.styles.fillColor = [50, 191, 129]; // Green
            } else if (val !== '-') {
              const mins = parseInt(val);
              if (mins > 20) {
                dataCell.cell.styles.textColor = [255, 255, 255];
                dataCell.cell.styles.fillColor = [244, 74, 99]; // Red
              } else if (mins >= 11) {
                dataCell.cell.styles.textColor = [255, 255, 255];
                dataCell.cell.styles.fillColor = [255, 162, 39]; // Orange
              }
            }
          }
          // Column 6: Jornada
          if (dataCell.column.index === 6 && dataCell.cell.raw === 'Flexible') {
            dataCell.cell.styles.textColor = [255, 255, 255];
            dataCell.cell.styles.fillColor = [78, 99, 206]; // Blue
          }
        }
      }
    });

    doc.save(`Reporte_Asistencia_${safeFormat(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllDays, setShowAllDays] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Exception | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [exSearchTerm, setExSearchTerm] = useState('');
  const [newEx, setNewEx] = useState<Omit<Exception, 'id'>>({
    employeeName: '',
    startDate: safeFormat(new Date(), 'dd/MM/yyyy'),
    endDate: safeFormat(new Date(), 'dd/MM/yyyy'),
    deferredEntryTime: '07:30',
    deferredExitTime: '15:30'
  });

  const [newHybrid, setNewHybrid] = useState<Omit<HybridSchedule, 'id'>>({
    employeeName: '',
    startDate: safeFormat(new Date(), 'yyyy-MM-dd'),
    endDate: safeFormat(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    daysConfig: {
      1: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
      2: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
      3: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
      4: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
      5: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
    }
  });

  const [newGeneralEx, setNewGeneralEx] = useState<Omit<GeneralException, 'id'>>({
    description: '',
    date: safeFormat(new Date(), 'yyyy-MM-dd'),
    type: 'ATRASO'
  });

  const [newParticularIncident, setNewParticularIncident] = useState<Omit<ParticularIncident, 'id'>>({
    employeeName: '',
    date: safeFormat(new Date(), 'yyyy-MM-dd'),
    type: 'ATRASO',
    description: '',
    status: 'ACTIVO'
  });

  const [particularSuggestions, setParticularSuggestions] = useState<string[]>([]);
  const [particularCursor, setParticularCursor] = useState(-1);
  const [showParticularSuggestions, setShowParticularSuggestions] = useState(false);

  const [configActiveTab, setConfigActiveTab] = useState<'horarios' | 'tolerancias' | 'datos'>('horarios');
  
  const [activeDays, setActiveDays] = useState(() => {
    const saved = localStorage.getItem('timetrack_active_days');
    return saved ? JSON.parse(saved) : {
      general: [1, 2, 3, 4, 5],
      saturday: [6]
    };
  });

  const [hybridCursor, setHybridCursor] = useState(-1);
  const [flexibleCursor, setFlexibleCursor] = useState(-1);
  const [showHybridSuggestions, setShowHybridSuggestions] = useState(false);
  const [showFlexibleSuggestions, setShowFlexibleSuggestions] = useState(false);

  const allWorkerNames = useMemo(() => {
    const fromData = data.map(r => r.employeeName);
    const fromExceptions = exceptions.map(e => e.employeeName);
    const fromHybrid = hybridSchedules.map(h => h.employeeName);
    return deduplicateNames([...fromData, ...fromExceptions, ...fromHybrid]);
  }, [data, exceptions, hybridSchedules]);

  const particularSuggestionsList = useMemo(() => {
    if (!newParticularIncident.employeeName) return [];
    return allWorkerNames.filter(name => 
      normalizeString(name).includes(normalizeString(newParticularIncident.employeeName))
    ).slice(0, 8);
  }, [allWorkerNames, newParticularIncident.employeeName]);

  const hybridSuggestions = useMemo(() => {
    if (!newHybrid.employeeName) return [];
    return allWorkerNames.filter(name => 
      normalizeString(name).includes(normalizeString(newHybrid.employeeName))
    ).slice(0, 8);
  }, [allWorkerNames, newHybrid.employeeName]);

  const [incidentSubTab, setIncidentSubTab] = useState<'general' | 'particular'>('particular');

  const handleParticularKeyDown = (e: React.KeyboardEvent) => {
    if (particularSuggestionsList.length === 0) return;
    if (e.key === 'ArrowDown') {
      setParticularCursor(prev => (prev < particularSuggestionsList.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      setParticularCursor(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && particularCursor >= 0) {
      e.preventDefault();
      setNewParticularIncident({ ...newParticularIncident, employeeName: particularSuggestionsList[particularCursor] });
      setParticularCursor(-1);
      setShowParticularSuggestions(false);
    }
  };

  const flexibleSuggestions = useMemo(() => {
    if (!newEx.employeeName) return [];
    const nSearch = normalizeString(newEx.employeeName);
    return allWorkerNames.filter(name => normalizeString(name).includes(nSearch)).slice(0, 8);
  }, [allWorkerNames, newEx.employeeName]);

  const handleHybridKeyDown = (e: React.KeyboardEvent) => {
    if (hybridSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      setHybridCursor(prev => (prev < hybridSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      setHybridCursor(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && hybridCursor >= 0) {
      e.preventDefault();
      setNewHybrid({ ...newHybrid, employeeName: hybridSuggestions[hybridCursor] });
      setHybridCursor(-1);
      setShowHybridSuggestions(false);
    }
  };

  const handleFlexibleKeyDown = (e: React.KeyboardEvent) => {
    if (flexibleSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      setFlexibleCursor(prev => (prev < flexibleSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      setFlexibleCursor(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && flexibleCursor >= 0) {
      e.preventDefault();
      setNewEx({ ...newEx, employeeName: flexibleSuggestions[flexibleCursor] });
      setFlexibleCursor(-1);
      setShowFlexibleSuggestions(false);
    }
  };

  React.useEffect(() => {
    localStorage.setItem('timetrack_exceptions', JSON.stringify(exceptions));
    localStorage.setItem('timetrack_hybrid', JSON.stringify(hybridSchedules));
    localStorage.setItem('timetrack_schedule', JSON.stringify(schedule));
    localStorage.setItem('timetrack_sat_schedule', JSON.stringify(satSchedule));
    localStorage.setItem('timetrack_general_exceptions', JSON.stringify(generalExceptions));
    localStorage.setItem('timetrack_particular_incidents', JSON.stringify(particularIncidents));
    localStorage.setItem('timetrack_is_admin', String(isAdmin));
    localStorage.setItem('timetrack_app_options', JSON.stringify(appOptions));
    localStorage.setItem('timetrack_active_days', JSON.stringify(activeDays));
    localStorage.setItem('timetrack_tolerances', JSON.stringify(tolerances));
    localStorage.setItem('timetrack_theme', JSON.stringify(theme));
    localStorage.setItem('timetrack_data', JSON.stringify(data));
    localStorage.setItem('timetrack_upload_history', JSON.stringify(uploadHistory));
  }, [exceptions, hybridSchedules, schedule, satSchedule, generalExceptions, particularIncidents, isAdmin, appOptions, activeDays, tolerances, theme, data, uploadHistory]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataArr = event.target?.result;
        if (!dataArr) {
          setIsProcessing(false);
          return;
        }
        
        // Use cellDates: false and raw: false to get formatted strings directly from Excel
        const workbook = XLSX.read(dataArr, { 
          type: 'array', 
          cellDates: false, 
          raw: false,
          codepage: 65001 
        });
        // Simplify Excel logic back to a more stable row-scanning method
        const groupedTimes: Record<string, { employeeName: string, date: Date, times: string[] }> = {};
        let foundDateRange: { min: Date | null, max: Date | null } = { min: null, max: null };
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });
          let lastNameInSheet = "";

          sheetData.forEach((row: any) => {
            const keys = Object.keys(row);
            
            // 1. Detect Names with high strictness
            let rowName = "";
            for (const k of keys) {
              const val = String(row[k] || '').trim();
              
              // Skip very short words or anything with numbers
              if (val.length < 5 || /[0-9]/.test(val)) continue;
              
              const lowerVal = val.toLowerCase();
              // Explicit software/header blacklist
              const blacklist = [
                'jlab', 'report', 'asistencia', 'jornada', 'filtro', 'pagina', 
                'total', 'fecha', 'hora', 'persona', 'nombre', 'empleado', 
                'software', 'biometric', 'marcaje', 'empresa', 'sucursal',
                'página', 'generado', 'usuario'
              ];
              
              if (blacklist.some(b => lowerVal.includes(b.toLowerCase()))) continue;

  // Must look like a real name: 2+ words, allow commas and spaces
              if (val.length > 5 && val.split(/\s+/).length >= 2 && !/[@#$%\^&\*\(\)_+=\[\]\{\}"\\\|<>\/?]/.test(val)) {
                const cleaned = cleanNameForDisplay(val);
                if (cleaned.length > 5) {
                  rowName = cleaned;
                  break;
                }
              }
            }
            
            if (rowName) {
              lastNameInSheet = rowName;
            }

            if (!lastNameInSheet) return;

            // 2. Extract date and times
            let rowDate: Date | null = null;
            let rowTimes: string[] = [];

            keys.forEach(k => {
              const val = row[k];
              if (val === null || val === undefined) return;

              const d = extractDate(val);
              if (d && !rowDate) rowDate = d;

              const t = extractTime(val);
              if (t && !rowTimes.includes(t)) rowTimes.push(t);
            });

            if (rowDate && rowTimes.length > 0) {
              // Track global range for filter sync
              if (!foundDateRange.min || rowDate < foundDateRange.min) foundDateRange.min = rowDate;
              if (!foundDateRange.max || rowDate > foundDateRange.max) foundDateRange.max = rowDate;

              const key = `${lastNameInSheet}-${safeFormat(rowDate, 'yyyy-MM-dd')}`;
              if (!groupedTimes[key]) {
                groupedTimes[key] = { employeeName: lastNameInSheet, date: rowDate, times: [] };
              }
              rowTimes.forEach(t => {
                if (!groupedTimes[key].times.includes(t)) {
                  groupedTimes[key].times.push(t);
                }
              });
            }
          });
        });

        const finalRecords: AttendanceRecord[] = Object.values(groupedTimes).map(group => {
          const sortedTimes = group.times.sort();
          let entry: string | null = null;
          let exit: string | null = null;
          
          if (sortedTimes.length === 1) {
            const t = sortedTimes[0];
            const [h] = t.split(':').map(Number);
            // Single mark: usually entry if early, exit if late
            if (h < 13 || (h === 13 && Number(t.split(':')[1]) < 30)) {
              entry = t;
            } else {
              exit = t;
            }
          } else {
            // Multiple marks: first is entry, last is exit
            entry = sortedTimes[0];
            exit = sortedTimes[sortedTimes.length - 1];
          }

          return {
            employeeName: group.employeeName,
            date: group.date,
            entryTime: entry,
            exitTime: exit,
          };
        });

        if (finalRecords.length === 0) {
          alert("No se detectaron jornadas válidas en el archivo.");
        } else {
          // Extract unique dates from the new records
          const fileDates = Array.from(new Set(finalRecords.map(r => safeFormat(r.date, 'yyyy-MM-dd'))));
          
            setData(prev => {
              // Surgical Merge: Overwrite only if employee + date matches
              const nextData = [...prev];
              finalRecords.forEach(newRec => {
                const newDateStr = safeFormat(newRec.date, 'yyyy-MM-dd');
                const index = nextData.findIndex(existing => {
                  const eDate = existing.date instanceof Date ? existing.date : new Date(existing.date);
                  return existing.employeeName === newRec.employeeName && safeFormat(eDate, 'yyyy-MM-dd') === newDateStr;
                });
                
                if (index !== -1) {
                  nextData[index] = newRec;
                } else {
                  nextData.push(newRec);
                }
              });

              const sortedData = nextData.sort((a, b) => {
                const dA = a.date instanceof Date ? a.date : new Date(a.date);
                const dB = b.date instanceof Date ? b.date : new Date(b.date);
                if (isInvalidDate(dA) || isInvalidDate(dB)) return 0;
                return compareAsc(dA, dB);
              });
              
              // We compute overwritten and update history inside the effect or right after, 
              // but let's do it safely here or keep it outside but with safe checks.
              return sortedData;
            });

            // Calculate overwritten based on the data we have before the update (it's slightly delayed in handleFileUpload closure)
            const overwritten = fileDates.filter(d => data.some(r => {
              const rDate = r.date instanceof Date ? r.date : new Date(r.date);
              if (isInvalidDate(rDate)) return false;
              return safeFormat(rDate, 'yyyy-MM-dd') === d;
            }));

            setUploadHistory(prevH => {
              const isDuplicate = prevH.some(h => 
                h.fileName === file.name && 
                h.recordCount === finalRecords.length
              );
              if (isDuplicate) return prevH;

              const newHistoryItem: UploadHistoryItem = {
                id: generateId(),
                fileName: file.name,
                uploadDate: new Date().toISOString(),
                dateRange: { 
                  start: foundDateRange.min ? safeFormat(foundDateRange.min, 'yyyy-MM-dd') : '', 
                  end: foundDateRange.max ? safeFormat(foundDateRange.max, 'yyyy-MM-dd') : '' 
                },
                recordCount: finalRecords.length,
                newDates: fileDates.filter(d => !overwritten.includes(d)),
                overwrittenDates: overwritten
              };
              return [newHistoryItem, ...prevH];
            });

            // Update history of processed dates
            setProcessedDates(prev => {
              const updated = Array.from(new Set([...prev, ...fileDates])).sort().reverse();
              return updated;
            });

          const rangeStr = (foundDateRange.min && foundDateRange.max) 
            ? `\nRango: ${safeFormat(foundDateRange.min, 'dd/MM/yyyy')} al ${safeFormat(foundDateRange.max, 'dd/MM/yyyy')}`
            : "";
          alert(`Éxito: Se procesaron ${finalRecords.length} jornadas únicas.${rangeStr}`);
          
          // Auto-update date filters to match data
          if (foundDateRange.min) setDateFilterStart(safeFormat(foundDateRange.min, 'yyyy-MM-dd'));
          if (foundDateRange.max) setDateFilterEnd(safeFormat(foundDateRange.max, 'yyyy-MM-dd'));
        }
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al procesar el archivo.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      alert("Error al leer el archivo.");
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    isDangerous?: boolean;
  } | null>(null);

  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const checkAdmin = (action: () => void) => {
    if (isAdmin) {
      action();
    } else {
      setPendingAction(() => action);
      setLoginMessage("⚠️ Se requieren permisos de administración para realizar esta acción.");
      setShowLoginModal(true);
    }
  };

  const handleAdminModalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const inputUser = (loginForm.user || '').trim();
    const inputPassword = (loginForm.password || '').trim();
    
    // Check credentials (case-insensitive for username as a courtesy)
    if (inputUser.toLowerCase() === 'jlab1338' && inputPassword === 'Laboral2026') {
      setIsAdmin(true);
      localStorage.setItem('timetrack_is_admin', 'true');
      setShowLoginModal(false);
      setLoginMessage(null);
      setLoginForm({ user: '', password: '' });
      
      if (pendingAction) {
        // Ejecutar la acción pendiente con un pequeño retraso para asegurar que isAdmin se propague
        setTimeout(() => {
          pendingAction();
          setPendingAction(null);
        }, 100);
      }
    } else {
      setLoginMessage("❌ Credenciales incorrectas. Intente nuevamente.");
    }
  };

  const handleBulkLoad = () => {
    if (!bulkText.trim()) return;
    
    // Simple parsing for the bulk text area
    const lines = bulkText.split('\n');
    const newExceptions: Exception[] = [];
    
    lines.forEach(line => {
      const parts = line.split(/[,\t;]/).map(p => p.trim());
      // Expecting: Name, StartDate, EndDate, EntryTime, ExitTime
      if (parts.length >= 5) {
        const [nameRaw, start, end, eTime, xTime] = parts;
        const name = cleanNameForDisplay(nameRaw);
        const entry = extractTime(eTime);
        const exit = extractTime(xTime);
        if (name && start && end && entry && exit) {
          newExceptions.push({
            id: Math.random().toString(36).substr(2, 9),
            employeeName: name,
            startDate: start,
            endDate: end,
            deferredEntryTime: entry,
            deferredExitTime: exit
          });
        }
      }
    });

    if (newExceptions.length > 0) {
      setExceptions([...exceptions, ...newExceptions]);
      setBulkText('');
      alert(`${newExceptions.length} horarios diferidos agregados correctamente.`);
    } else {
      alert("No se encontraron registros válidos. Formato: Nombre, Fecha Inicio, Fecha Fin, Hora Ingreso, Hora Salida");
    }
  };

  const removeException = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Horario Diferido?',
      message: '¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      isDangerous: true,
      onConfirm: () => {
        setExceptions(exceptions.filter(e => e.id !== id));
        setConfirmModal(null);
      }
    });
  };

  const updateException = (id: string, field: keyof Exception, value: string) => {
    setExceptions(exceptions.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const analyzedResults = useMemo(() => {
    const resultsMap: Record<string, AnalysisResult> = {};
    const filteredByDate = data.filter(record => {
      try {
        const rDate = record.date instanceof Date ? record.date : new Date(record.date);
        if (!rDate || isInvalidDate(rDate)) return false;
        const d = startOfDay(rDate);
        
        const startDateObj = safeParseDate(dateFilterStart);
        const endDateObj = safeParseDate(dateFilterEnd);
        
        const start = startDateObj ? startOfDay(startDateObj) : null;
        const end = endDateObj ? startOfDay(endDateObj) : null;
        
        if (start && d.getTime() < start.getTime()) return false;
        if (end && d.getTime() > end.getTime()) return false;
        return true;
      } catch(e) { return true; }
    });

    filteredByDate.forEach(record => {
      const rawName = record.employeeName;
      // Find the "official" version of the name from our deduplicated list
      const name = allWorkerNames.find(n => isFuzzyMatch(n, rawName)) || rawName;
      
      if (!resultsMap[name]) resultsMap[name] = { employeeName: name, totalLateDays: 0, totalEarlyExits: 0, details: [] };
      
      const generalExAtraso = generalExceptions.find(ex => {
        try {
          if (!record.date || isInvalidDate(record.date)) return false;
          return safeFormat(record.date, 'yyyy-MM-dd') === ex.date && (ex.type === 'ATRASO' || !ex.type);
        } catch (e) { return false; }
      });

      const generalExSalida = generalExceptions.find(ex => {
        try {
          if (!record.date || isInvalidDate(record.date)) return false;
          return safeFormat(record.date, 'yyyy-MM-dd') === ex.date && (ex.type === 'SALIDA ANTICIPADA' || !ex.type);
        } catch (e) { return false; }
      });

      const generalExAusencia = generalExceptions.find(ex => {
        try {
          if (!record.date || isInvalidDate(record.date)) return false;
          return safeFormat(record.date, 'yyyy-MM-dd') === ex.date && ex.type === 'AUSENCIA';
        } catch (e) { return false; }
      });

      const hybridEx = hybridSchedules.find(ex => {
        if (!isFuzzyMatch(ex.employeeName, name)) return false;
        try {
          if (!record.date || isInvalidDate(record.date)) return false;
          const d = startOfDay(record.date);
          const startDateObj = safeParseDate(ex.startDate);
          const endDateObj = safeParseDate(ex.endDate);
          if (!startDateObj || !endDateObj) return false;

          const start = startOfDay(startDateObj);
          const end = startOfDay(endDateObj);
          if (d.getTime() < start.getTime() || d.getTime() > end.getTime()) return false;
          
          const dayOfWeek = getDaySafe(record.date);
          const config = ex.daysConfig?.[dayOfWeek];
          return config && (config.isTelework || config.isHybrid);
        } catch (e) { return false; }
      });

      const exception = exceptions.find(ex => {
        if (!isFuzzyMatch(ex.employeeName, name)) return false;
        try {
          if (!record.date || isInvalidDate(record.date)) return false;
          const recordStart = startOfDay(record.date);
          const startDateObj = parseExDate(ex.startDate);
          const endDateObj = parseExDate(ex.endDate);
          if (isInvalidDate(startDateObj) || isInvalidDate(endDateObj)) return false;

          const exStart = startOfDay(startDateObj);
          const exEnd = startOfDay(endDateObj);
          return isWithinInterval(recordStart, { start: exStart, end: exEnd });
        } catch (e) { return false; }
      });

      const dayOfWeek = getDaySafe(record.date);
      const isGeneralDay = activeDays.general.includes(dayOfWeek);
      const isSaturdayDay = activeDays.saturday.includes(dayOfWeek);
      
      const sEntry = isSaturdayDay ? satSchedule.entry : (exception ? exception.deferredEntryTime : schedule.entry);
      const sExit = isSaturdayDay ? satSchedule.exit : (exception ? exception.deferredExitTime : schedule.exit);

      // If day is not in general or saturday active days, should we ignore?
      // For now, let's assume if it's not active, we don't calculate lateness unless it's a flexible schedule worker
      const isWorkDay = isGeneralDay || isSaturdayDay || !!exception;

      let lateMin = 0, lateSt: any = 'none';
      if (record.entryTime && (appOptions.autoLate || !!exception)) {
        let eStr = record.entryTime;
        if (eStr.includes('T')) eStr = safeFormat(new Date(eStr), 'HH:mm');
        else if (!eStr.includes(':') && !isNaN(Number(eStr))) {
          const s = Math.round(Number(eStr) * 86400); 
          eStr = `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;
        }
        if (eStr.includes(':')) {
          const [h, m] = eStr.split(':').map(Number);
          const [sh, sm] = sEntry.split(':').map(Number);
          const eD = new Date(2000, 0, 1, h, m), sD = new Date(2000, 0, 1, sh, sm);
          
          if (isValid(eD) && isValid(sD) && isAfter(eD, sD)) {
            const rawLate = differenceInMinutes(eD, sD);
            
            // Apply Entry Tolerance
            if (rawLate > (tolerances.entryGrace || 0)) {
              lateMin = rawLate;
              
              // Check for General Exception first
              if (generalExAtraso) {
                lateSt = 'justified';
              } else if (hybridEx) {
                const config = hybridEx.daysConfig?.[getDaySafe(record.date)];
                if (config?.isTelework && !config?.isHybrid) {
                  lateSt = 'hybrid';
                } else if (config?.isHybrid) {
                  // If hybrid, check against office entry
                  const [hS, mS] = (config.startTime || '08:00').split(':').map(Number);
                  const blockStart = new Date(2000, 0, 1, hS, mS);
                  if (isValid(blockStart) && !isAfter(eD, blockStart)) {
                    lateSt = 'hybrid';
                  } else if (isValid(blockStart) && isValid(eD)) {
                    // If after office entry, it's late compared to the office block
                    const officeLate = differenceInMinutes(eD, blockStart);
                    if (officeLate >= (tolerances.entryRed || 30)) lateSt = 'red';
                    else if (officeLate >= (tolerances.entryYellow || 15)) lateSt = 'yellow';
                    else lateSt = 'neutral';
                    lateMin = officeLate;
                  }
                }
              } else if (isWorkDay) {
                if (lateMin >= (tolerances.entryRed || 30)) lateSt = 'red';
                else if (lateMin >= (tolerances.entryYellow || 15)) lateSt = 'yellow';
                else lateSt = 'neutral';
              }
            } else {
              lateSt = 'none';
            }
          } else if (hybridEx) {
             const config = hybridEx.daysConfig?.[getDaySafe(record.date)];
             if (config && (config.isTelework || config.isHybrid)) lateSt = 'hybrid';
          }
        }
      }

      let earlyMin = 0, exitSt: any = 'none';
      if (record.exitTime && appOptions.earlyExit) {
        let exStr = record.exitTime;
        if (exStr.includes('T')) exStr = safeFormat(new Date(exStr), 'HH:mm');
        else if (!exStr.includes(':') && !isNaN(Number(exStr))) {
          const s = Math.round(Number(exStr) * 86400); 
          exStr = `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;
        }
        if (exStr.includes(':')) {
          const [h, m] = exStr.split(':').map(Number);
          const [sh, sm] = sExit.split(':').map(Number);
          const eD = new Date(2000, 0, 1, h, m), sD = new Date(2000, 0, 1, sh, sm);
          if (isValid(eD) && isValid(sD) && isAfter(sD, eD)) {
            earlyMin = differenceInMinutes(sD, eD);
            
            if (generalExSalida) {
              exitSt = 'justified';
            } else if (hybridEx) {
              const config = hybridEx.daysConfig?.[getDaySafe(record.date)];
              if (config?.isTelework && !config?.isHybrid) {
                exitSt = 'hybrid';
              } else if (config?.isHybrid) {
                // If hybrid, check against office exit
                const [hE, mE] = (config.endTime || '14:00').split(':').map(Number);
                const blockEnd = new Date(2000, 0, 1, hE, mE);
                if (isValid(blockEnd) && !isAfter(blockEnd, eD)) {
                  exitSt = 'hybrid';
                } else if (isValid(blockEnd) && isValid(eD)) {
                  const officeEarly = differenceInMinutes(blockEnd, eD);
                  if (officeEarly >= tolerances.exitRed) exitSt = 'red';
                  else if (officeEarly >= tolerances.exitYellow) exitSt = 'yellow';
                  else exitSt = 'neutral';
                  earlyMin = officeEarly;
                }
              }
            } else if (isWorkDay) {
              if (earlyMin > (tolerances.exitGrace || 0)) {
                if (earlyMin >= (tolerances.exitRed || 30)) exitSt = 'red';
                else if (earlyMin >= (tolerances.exitYellow || 15)) exitSt = 'yellow';
                else exitSt = 'neutral';
              } else {
                exitSt = 'none';
                earlyMin = 0;
              }
            }
          } else if (hybridEx) {
            const config = hybridEx.daysConfig?.[getDaySafe(record.date)];
            if (config && (config.isTelework || config.isHybrid)) exitSt = 'hybrid';
          }
        }
      }

      const isLate = lateSt !== 'none' && lateSt !== 'hybrid' && lateSt !== 'justified';
      const isEarlyExit = exitSt !== 'none' && exitSt !== 'hybrid' && exitSt !== 'justified';
      
      // Module 2: Check for Particular Incident Justification
      const findParticularIncident = (type: IncidentType) => {
        return particularIncidents.find(pi => 
          pi.status === 'ACTIVO' &&
          pi.type === type &&
          pi.date === safeFormat(record.date, 'yyyy-MM-dd') &&
          isFuzzyMatch(pi.employeeName, name)
        );
      };

      const lateJustification = findParticularIncident('ATRASO');
      const exitJustification = findParticularIncident('SALIDA ANTICIPADA');

      if (isLate && lateJustification) lateSt = 'justified';
      if (isEarlyExit && exitJustification) exitSt = 'justified';

      const finalIsLate = lateSt !== 'none' && lateSt !== 'hybrid' && lateSt !== 'justified';
      const finalIsEarlyExit = exitSt !== 'none' && exitSt !== 'hybrid' && exitSt !== 'justified';
      
      const isMissing = !record.entryTime || !record.exitTime;

      // Module 2.5: Check for Absence Justification
      const absenceJustification = particularIncidents.find(pi => 
        pi.status === 'ACTIVO' &&
        pi.type as string === 'AUSENCIA' &&
        pi.date === safeFormat(record.date, 'yyyy-MM-dd') &&
        isFuzzyMatch(pi.employeeName, name)
      );

      const finalIsMissing = isMissing && !absenceJustification && !generalExAusencia;

      const hasSignificantEvent = finalIsLate || finalIsEarlyExit || lateSt === 'hybrid' || lateSt === 'justified' || exitSt === 'hybrid' || exitSt === 'justified' || finalIsMissing || (isMissing && (!!absenceJustification || !!generalExAusencia));

      let hoursWorked: number | null = null;
      if (record.entryTime && record.exitTime) {
        let eStr = record.entryTime;
        let xStr = record.exitTime;
        
        // Handle format normalization
        const parseTimeStr = (t: string) => {
          if (t.includes('T')) return new Date(t);
          if (!t.includes(':') && !isNaN(Number(t))) {
            const s = Math.round(Number(t) * 86400); 
            return new Date(2000, 0, 1, Math.floor(s/3600), Math.floor((s%3600)/60));
          }
          const [h, m] = t.split(':').map(Number);
          return new Date(2000, 0, 1, h, m);
        };

        try {
          const entryDate = parseTimeStr(eStr);
          const exitDate = parseTimeStr(xStr);
          const diffMin = differenceInMinutes(exitDate, entryDate);
          hoursWorked = Number((diffMin / 60).toFixed(2));
        } catch (e) {
          hoursWorked = null;
        }
      }
      
      let shouldInclude = true;
      if (filterLateness || filterEarlyExit || filterMissing) {
        shouldInclude = (filterLateness && finalIsLate) || (filterEarlyExit && finalIsEarlyExit) || (filterMissing && finalIsMissing);
      } else if (!showAllDays) {
        shouldInclude = hasSignificantEvent;
      }
      
      if (shouldInclude) {
        if (finalIsLate) resultsMap[name].totalLateDays++;
        if (finalIsEarlyExit) resultsMap[name].totalEarlyExits++;
        resultsMap[name].details.push({
          date: record.date, dayName: getSpanishDayAbbr(record.date),
          actualEntry: record.entryTime, actualExit: record.exitTime,
          scheduledEntry: sEntry, scheduledExit: sExit,
          lateMinutes: lateMin, earlyExitMinutes: earlyMin,
          hoursWorked: hoursWorked,
          lateStatus: lateSt, exitStatus: exitSt,
          isMissing: isMissing,
          isJustifiedAbsence: !!absenceJustification || !!generalExAusencia,
          absenceJustification: absenceJustification || (generalExAusencia ? {
            id: generalExAusencia.id,
            employeeId: 'all',
            employeeName: 'TODOS (General)',
            date: generalExAusencia.date,
            type: 'AUSENCIA',
            description: generalExAusencia.description,
            status: 'ACTIVO'
          } as ParticularIncident : undefined),
          lateJustification: lateSt === 'justified' ? (lateJustification || (generalExAtraso ? {
            id: generalExAtraso.id,
            employeeId: 'all',
            employeeName: 'TODOS (General)',
            date: generalExAtraso.date,
            type: generalExAtraso.type || 'ATRASO',
            description: generalExAtraso.description,
            status: 'ACTIVO'
          } as ParticularIncident : undefined)) : undefined,
          exitJustification: exitSt === 'justified' ? (exitJustification || (generalExSalida ? {
            id: generalExSalida.id,
            employeeId: 'all',
            employeeName: 'TODOS (General)',
            date: generalExSalida.date,
            type: generalExSalida.type || 'SALIDA ANTICIPADA',
            description: generalExSalida.description,
            status: 'ACTIVO'
          } as ParticularIncident : undefined)) : undefined,
          isHybrid: !!hybridEx
        });
      }
    });

    Object.values(resultsMap).forEach(r => r.details.sort((a,b) => {
      const dA = a.date instanceof Date ? a.date : new Date(a.date);
      const dB = b.date instanceof Date ? b.date : new Date(b.date);
      if (isInvalidDate(dA) || isInvalidDate(dB)) return 0;
      return compareAsc(dA, dB);
    }));
    
    return Object.values(resultsMap)
      .filter(r => matchesFlexible(r.employeeName, searchTerm))
      .sort((a,b) => a.employeeName.localeCompare(b.employeeName));
  }, [data, exceptions, hybridSchedules, generalExceptions, particularIncidents, schedule, satSchedule, appOptions, activeDays, tolerances, searchTerm, showAllDays, dateFilterStart, dateFilterEnd, filterLateness, filterEarlyExit, filterMissing, allWorkerNames]);

  const groupedByWeek = useMemo(() => {
    const allRecords: any[] = [];
    analyzedResults.forEach(worker => {
      worker.details.forEach(detail => {
        allRecords.push({ ...detail, employeeName: worker.employeeName });
      });
    });

    const weeks: Record<string, any[]> = {};
    allRecords.forEach(rec => {
      if (!rec.date || isInvalidDate(rec.date)) return;
      const start = startOfWeek(rec.date, { weekStartsOn: 1 });
      const end = endOfWeek(rec.date, { weekStartsOn: 1 });
      const key = `${safeFormat(start, 'yyyy-MM-dd')}_${safeFormat(end, 'yyyy-MM-dd')}`;
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(rec);
    });

    return Object.keys(weeks).sort().map(key => {
      const [startStr, endStr] = key.split('_');
      const startDate = safeParseDate(startStr);
      const endDate = safeParseDate(endStr);
      
      if (!startDate || isInvalidDate(startDate)) return null;
      
      // Compute week number within month
      const weekNum = getWeekOfMonth(startDate, { weekStartsOn: 1 });
      const monthName = safeFormat(startDate, 'MMMM');

      return {
        key,
        label: `Semana ${weekNum} de ${monthName} (${safeFormat(startDate, 'dd/MM')} al ${safeFormat(endDate, 'dd/MM')})`,
        records: weeks[key].sort((a,b) => {
          const dA = a.date instanceof Date ? a.date : new Date(a.date);
          const dB = b.date instanceof Date ? b.date : new Date(b.date);
          if (isInvalidDate(dA) || isInvalidDate(dB)) return 0;
          const dateComp = compareAsc(dA, dB);
          if (dateComp !== 0) return dateComp;
          return a.employeeName.localeCompare(b.employeeName);
        })
      };
    }).filter((w): w is any => w !== null);
  }, [analyzedResults]);

  const workerNames = useMemo(() => {
    return allWorkerNames;
  }, [allWorkerNames]);

  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showExSearchSuggestions, setShowExSearchSuggestions] = useState(false);
  const [showExFormSuggestions, setShowExFormSuggestions] = useState(false);

  const searchSuggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return workerNames.filter(name => matchesFlexible(name, searchTerm)).slice(0, 5);
  }, [workerNames, searchTerm]);

  const exSearchSuggestions = useMemo(() => {
    if (!exSearchTerm || exSearchTerm.length < 2) return [];
    return workerNames.filter(name => matchesFlexible(name, exSearchTerm)).slice(0, 5);
  }, [workerNames, exSearchTerm]);

  const exFormSuggestions = useMemo(() => {
    if (!newEx.employeeName || newEx.employeeName.length < 2) return [];
    return workerNames.filter(name => matchesFlexible(name, newEx.employeeName)).slice(0, 5);
  }, [workerNames, newEx.employeeName]);

  const stats = useMemo(() => {
    const allDays = analyzedResults.flatMap(worker => 
      worker.details.map(d => ({ 
        lateMin: d.lateMinutes, 
        earlyMin: d.earlyExitMinutes, 
        lateStatus: d.lateStatus,
        exitStatus: d.exitStatus,
        isFlexible: d.scheduledEntry !== (getDaySafe(d.date) === 6 ? satSchedule.entry : schedule.entry),
        employeeName: worker.employeeName 
      }))
    );

    const totalDays = Math.max(allDays.length, 1);
    const totalWorkersLoaded = Math.max(allWorkerNames.length, 1);
    
    // Module 3: Exclude justified and hybrid/telework from counts
    const lateDaysCount = allDays.filter(d => 
      d.lateMin >= 1 && 
      d.lateStatus !== 'justified' && 
      d.lateStatus !== 'hybrid'
    ).length;

    const earlyExitsCount = allDays.filter(d => 
      d.earlyMin >= 1 && 
      d.exitStatus !== 'justified' && 
      d.exitStatus !== 'hybrid'
    ).length;

    const totalLateMin = allDays.reduce((acc, d) => {
      // Only sum minutes for actual late events (not justified, not hybrid)
      if (d.lateMin >= 1 && d.lateStatus !== 'justified' && d.lateStatus !== 'hybrid') {
        return acc + d.lateMin;
      }
      return acc;
    }, 0);
    
    // Total unique employees with flexible schedule defined globally
    const exceptionsUniqueCount = new Set(exceptions.map(e => e.employeeName.trim().toUpperCase())).size;
    const hybridUniqueCount = new Set(hybridSchedules.map(e => e.employeeName.trim().toUpperCase())).size;

    return {
      lateDays: lateDaysCount,
      latePct: (lateDaysCount / totalDays) * 100,
      avgLate: lateDaysCount > 0 ? (totalLateMin / lateDaysCount).toFixed(1) : '0',
      avgLatePct: Math.min((Number(lateDaysCount > 0 ? (totalLateMin / lateDaysCount) : 0) / 45) * 100, 100),
      earlyExits: earlyExitsCount,
      earlyExitPct: (earlyExitsCount / totalDays) * 100,
      exceptionsCount: exceptionsUniqueCount,
      exceptionsPct: (exceptionsUniqueCount / totalWorkersLoaded) * 100,
      hybridCount: hybridUniqueCount,
      hybridPct: (hybridUniqueCount / totalWorkersLoaded) * 100
    };
  }, [analyzedResults, data, exceptions, hybridSchedules]);

  const getThemeStyles = () => {
    switch (theme.primary) {
      case 'teal':
        return { '--primary-600': '#0d9488', '--primary-700': '#0f766e', '--primary-50': '#f0fdfa' };
      case 'purple':
        return { '--primary-600': '#7c3aed', '--primary-700': '#6d28d9', '--primary-50': '#f5f3ff' };
      default:
        return { '--primary-600': '#2563eb', '--primary-700': '#1d4ed8', '--primary-50': '#eff6ff' };
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    const isIframe = window.self !== window.top;
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Clock className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">TimeTrack</h1>
          <p className="text-slate-500 mb-8 font-medium">Control de asistencia y gestión laboral con persistencia en la nube.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium text-left">
              {loginError}
              {isIframe && <p className="mt-2 font-bold opacity-80 underline">Sugerencia: Abre la aplicación en una pestaña nueva usando el botón en la esquina superior derecha.</p>}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={cn(
              "w-full flex items-center justify-center gap-4 py-4 px-6 bg-white border-2 border-slate-100 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 hover:border-blue-100 transition-all active:scale-[0.98] shadow-sm",
              isLoggingIn && "opacity-50 cursor-wait"
            )}
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Ingresar con Google
              </>
            )}
          </button>
          
          <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
            Tus datos se sincronizarán<br />automáticamente en todos tus dispositivos.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden" style={getThemeStyles() as any}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                <Palette className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 underline decoration-blue-500/30 decoration-2 underline-offset-4">TimeTrack</h1>
            </div>
            {isCloudSyncing && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50/50 text-blue-600 rounded-lg border border-blue-100/50 mt-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Sincronizado</span>
              </div>
            )}
          </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Menú</div>
          <button 
            onClick={() => setActiveTab('report')}
            className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'report' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" /> <span className="text-sm">Informe General</span>
          </button>
          <button 
             onClick={() => setActiveTab('horarios')}
             className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group", activeTab === 'horarios' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 shrink-0" /> 
              <div className="flex flex-col items-start translate-y-[1px]">
                <span className="text-sm">Jornada Flexible</span>
                <span className="text-[9px] opacity-60 group-hover:opacity-80 transition-opacity">{stats.exceptionsCount} funcionarios</span>
              </div>
            </div>
            <div className="w-8 h-8 relative">
              <svg className="w-full h-full -rotate-90">
                <circle cx="16" cy="16" r="13" fill="transparent" stroke={activeTab === 'horarios' ? "#334155" : "#f1f5f9"} strokeWidth="3" />
                <circle cx="16" cy="16" r="13" fill="transparent" stroke="#4e63ce" strokeWidth="3" 
                  strokeDasharray={`${(stats.exceptionsPct * 81.68) / 100} 100`} 
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold">{Math.round(stats.exceptionsPct)}%</span>
            </div>
          </button>
          <button 
             onClick={() => setActiveTab('hybrid')}
             className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group", activeTab === 'hybrid' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 shrink-0" /> 
              <div className="flex flex-col items-start translate-y-[1px]">
                <span className="text-sm">Jornada Híbrida</span>
                <span className="text-[9px] opacity-60 group-hover:opacity-80 transition-opacity">{stats.hybridCount} funcionarios</span>
              </div>
            </div>
            <div className="w-8 h-8 relative">
              <svg className="w-full h-full -rotate-90">
                <circle cx="16" cy="16" r="13" fill="transparent" stroke={activeTab === 'hybrid' ? "#334155" : "#f1f5f9"} strokeWidth="3" />
                <circle cx="16" cy="16" r="13" fill="transparent" stroke="#37d0d8" strokeWidth="3" 
                  strokeDasharray={`${(stats.hybridPct * 81.68) / 100} 100`} 
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold">{Math.round(stats.hybridPct)}%</span>
            </div>
          </button>
          <button 
             onClick={() => setActiveTab('justifications')}
             className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'justifications' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <AlertCircle className="w-5 h-5 shrink-0" /> <span className="text-sm">Incidentes</span>
          </button>
          <button 
             onClick={() => setActiveTab('datos')}
             className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'datos' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <Database className="w-5 h-5 shrink-0" /> <span className="text-sm">Datos SQL</span>
          </button>
          <button 
             onClick={() => setActiveTab('config')}
             className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'config' ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-50")}
          >
            <Settings className="w-5 h-5 shrink-0" /> <span className="text-sm">Configuración</span>
          </button>

          <div className="pt-4 mt-auto border-t border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                {user?.photoURL ? <img src={user.photoURL} alt={user.displayName || ''} /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Users className="w-4 h-4" /></div>}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-700 truncate capitalize">{user?.displayName?.toLowerCase() || 'Usuario'}</span>
                <span className="text-[9px] text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 shrink-0" /> <span className="text-sm">Cerrar Sesión</span>
            </button>
          </div>


          <div className="pt-6 space-y-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Horario Base</div>
            <div className="grid grid-cols-1 gap-1.5 px-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Lunes a Viernes</span>
                <span className="text-sm font-black text-slate-500">{schedule.entry} - {schedule.exit}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Sábados</span>
                <span className="text-sm font-black text-slate-500">{satSchedule.entry} - {satSchedule.exit}</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4 space-y-4">
          <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center group transition-colors hover:border-blue-300">
            <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
            <p className="text-[10px] text-slate-500 font-medium mb-2 truncate px-2">{fileName || "Planilla Clock-In"}</p>
            <label 
              onClick={(e) => {
                if (!isAdmin) {
                  e.preventDefault();
                  setLoginMessage("⚠️ Se requieren permisos de administración para subir archivos.");
                  setShowLoginModal(true);
                }
              }}
              className="block px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-semibold hover:bg-blue-700 transition-colors w-full cursor-pointer"
            >
              {fileName ? "Cambiar Archivo" : "Subir Registros"}
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
                onChange={(e) => {
                  if (isAdmin) handleFileUpload(e);
                }} 
              />
            </label>
          </div>

          {isAdmin ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200 uppercase font-black text-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Acceso</p>
                  <p className="text-xs font-black text-slate-800">Administrador</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Cerrar Sesión',
                    message: '¿Cerrar sesión administrativa? Las funciones de edición se bloquearán.',
                    confirmLabel: 'Cerrar Sesión',
                    isDangerous: true,
                    onConfirm: () => {
                      setIsAdmin(false);
                      localStorage.setItem('timetrack_is_admin', 'false');
                      setConfirmModal(null);
                    }
                  });
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-95"
              >
                <LogOut className="w-3 h-3" /> Cerrar Sesión
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="w-full group flex items-center justify-between p-3 bg-slate-100 hover:bg-white border hover:border-slate-800 rounded-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 group-hover:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-white transition-all">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-700 uppercase">Modo Lectura</p>
                </div>
              </div>
              <Key className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-800" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-black tracking-tight text-slate-900 uppercase truncate max-w-[200px] md:max-w-none">
              {activeTab === 'report' ? 'Informe de Asistencia' :
               activeTab === 'horarios' ? 'Jornada Flexible' :
               activeTab === 'hybrid' ? 'Jornada Híbrida' :
               activeTab === 'justifications' ? 'Incidentes y Justificaciones' :
               activeTab === 'datos' ? 'Gestión de Datos' :
               'Configuración del Sistema'}
            </h2>
            <div className="flex items-center gap-2">
              <span className={cn("px-2.5 py-1 text-[10px] font-semibold rounded-full uppercase tracking-widest border", data.length > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200")}>
                {data.length > 0 ? "Estado: Online" : "Estado: Offline"}
              </span>
            </div>

          </div>
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold">Admin RRHH</p>
                  <p className="text-xs text-slate-400">Sesión Activa</p>
                </div>
                <button 
                  onClick={() => setIsAdmin(false)}
                  className="w-10 h-10 bg-slate-800 rounded-full border border-slate-300 flex items-center justify-center font-bold text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" /> Iniciar Sesión
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {activeTab === 'report' ? (
            <>
              {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard label="Días con Retraso" value={stats.lateDays} subValue="totales" icon={<Clock className="w-4 h-4" />} percentage={stats.latePct} colorClass="text-[#ffa227]" />
                  <StatCard label="Promedio Retraso" value={stats.avgLate} subValue="minutos" icon={<AlertCircle className="w-4 h-4" />} percentage={stats.avgLatePct} colorClass="text-[#4e63ce]" />
                  <StatCard label="Retiros Anticipados" value={stats.earlyExits} subValue="eventos" icon={<X className="w-4 h-4" />} percentage={stats.earlyExitPct} colorClass="text-[#f44a63]" />
                </div>

              {/* Table Card */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full min-h-0">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex flex-col gap-5">
                    {/* Fila superior: Búsqueda y Botón */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="relative group flex-1 min-w-[300px]">
                        <input 
                          type="text" 
                          placeholder="Buscar por nombre de trabajador o palabra clave..." 
                          value={searchTerm || ''}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowSearchSuggestions(true);
                          }}
                          onFocus={() => setShowSearchSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                          className="text-sm pl-11 pr-4 h-12 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white shadow-sm transition-all"
                        />
                        <Search className={cn("w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors", searchTerm ? "text-blue-500" : "text-slate-400")} />
                        
                        <AnimatePresence>
                          {showSearchSuggestions && searchSuggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto"
                            >
                              <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Sugerencias ({searchSuggestions.length})</span>
                              </div>
                              {searchSuggestions.map((name, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setSearchTerm(name);
                                    setShowSearchSuggestions(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm font-medium text-slate-700 flex items-center justify-between group transition-colors border-b border-slate-50 last:border-0"
                                >
                                  <span>{name}</span>
                                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                          <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 px-3 py-2 bg-white/50 rounded-xl border border-slate-200">
                          <LegendItem color="bg-slate-300" label={`≤ ${tolerances.entryGrace}m`} />
                          <LegendItem color="bg-slate-400" label={`${tolerances.entryGrace + 1}-${tolerances.entryYellow - 1}m`} />
                          <LegendItem color="bg-[#ffa227]" label={`${tolerances.entryYellow}-${tolerances.entryRed - 1}m`} />
                          <LegendItem color="bg-[#f44a63]" label={`≥ ${tolerances.entryRed}m`} />
                        </div>
                      </div>
                    </div>

                    {/* Fila inferior: Rango de Fecha e Incidentes */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-6 mt-2 border-t border-slate-200/40">
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Control de Rango (Siempre visible) */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 ml-1">
                             <Calendar className="w-3.5 h-3.5 text-slate-400" />
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Período de Análisis</span>
                          </div>
                          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                               <span className="text-[9px] font-bold text-slate-400 uppercase">De</span>
                               <input 
                                  type="date" 
                                  value={dateFilterStart || ''}
                                  onChange={(e) => setDateFilterStart(e.target.value)}
                                  className="bg-transparent text-xs outline-none focus:text-blue-600 cursor-pointer font-semibold tabular-nums"
                                />
                            </div>
                            <div className="w-px h-4 bg-slate-100" />
                            <div className="flex items-center gap-3">
                               <span className="text-[9px] font-bold text-slate-400 uppercase">A</span>
                               <input 
                                  type="date" 
                                  value={dateFilterEnd || ''}
                                  onChange={(e) => setDateFilterEnd(e.target.value)}
                                  className="bg-transparent text-xs outline-none focus:text-blue-600 cursor-pointer font-semibold tabular-nums"
                                />
                            </div>
                          </div>
                        </div>


                        {/* Filtros de Incidentes */}
                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div 
                              onClick={() => setFilterLateness(!filterLateness)}
                              className={cn(
                                "w-7 h-4 rounded-full relative transition-colors border",
                                filterLateness ? "bg-amber-500 border-amber-500" : "bg-slate-100 border-slate-200"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm",
                                filterLateness ? "left-3.5" : "left-0.5"
                              )} />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-tight">Atrasos</span>
                          </label>


                          <div className="h-4 w-px bg-slate-100" />

                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div 
                              onClick={() => setFilterEarlyExit(!filterEarlyExit)}
                              className={cn(
                                "w-8 h-4 rounded-full relative transition-colors border",
                                filterEarlyExit ? "bg-red-600 border-red-600" : "bg-slate-200 border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm",
                                filterEarlyExit ? "left-4.5" : "left-0.5"
                              )} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Salidas Anticipadas</span>
                          </label>

                          <div className="h-4 w-px bg-slate-100" />

                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div 
                              onClick={() => setFilterMissing(!filterMissing)}
                              className={cn(
                                "w-8 h-4 rounded-full relative transition-colors border",
                                filterMissing ? "bg-slate-800 border-slate-800" : "bg-slate-200 border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm",
                                filterMissing ? "left-4.5" : "left-0.5"
                              )} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Sin Marcaje</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {analyzedResults.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200 shadow-sm transition-all duration-300">
                        <Database className="w-3.5 h-3.5" />
                        <span className="tabular-nums font-black">{analyzedResults.reduce((acc, curr) => acc + curr.details.length, 0)} Registros</span>
                      </div>
                    )}
                    
                    {(searchTerm || filterLateness || filterEarlyExit || filterMissing || 
                      (dateFilterStart !== (globalDateRange.min ? safeFormat(globalDateRange.min, 'yyyy-MM-dd') : '')) || 
                      (dateFilterEnd !== (globalDateRange.max ? safeFormat(globalDateRange.max, 'yyyy-MM-dd') : ''))) && (
                      <button 
                        onClick={() => {
                          setSearchTerm('');
                          setFilterLateness(false);
                          setFilterEarlyExit(false);
                          setFilterMissing(false);
                          if (globalDateRange.min) setDateFilterStart(safeFormat(globalDateRange.min, 'yyyy-MM-dd'));
                          if (globalDateRange.max) setDateFilterEnd(safeFormat(globalDateRange.max, 'yyyy-MM-dd'));
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-sm group active:scale-95 transition-all"
                      >
                        <Eraser className="w-3.5 h-3.5 opacity-60 group-hover:rotate-12 transition-transform" />
                        Limpiar Filtros
                      </button>
                    )}
                  </div>
                </div>

                
                <div className="overflow-auto flex-1 min-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                      <tr className="text-xs text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 font-bold">Trabajador</th>
                        <th className="px-6 py-4 font-bold">Día</th>
                        <th className="px-6 py-4 font-bold text-center">Fecha</th>
                        <th className="px-6 py-4 font-bold text-center">Hora Ingreso</th>
                        <th className="px-6 py-4 font-bold text-center">Hora Salida</th>
                        <th className="px-6 py-4 font-bold text-center">Atraso</th>
                        <th className="px-6 py-4 font-bold text-center">Salida Anticipada</th>
                        <th className="px-6 py-4 font-bold">Tipo de Jornada</th>
                        <th className="px-6 py-4 font-bold text-center">Hrs Trab.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedByWeek.length > 0 ? (
                        groupedByWeek.map((week) => (
                          <React.Fragment key={week.key}>
                            <tr className="bg-slate-50/80 border-y border-slate-200 sticky top-[48px] z-[5]">
                              <td colSpan={9} className="px-6 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                  <span className="text-xs font-black text-blue-800 uppercase tracking-widest">{week.label}</span>
                                </div>
                              </td>
                            </tr>
                            {week.records.map((record, idx) => (
                              <tr key={`${week.key}-${record.employeeName}-${idx}`} className="text-sm hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 font-semibold text-slate-700">{record.employeeName}</td>
                                <td className="px-6 py-3 font-bold text-slate-400 text-xs">{record.dayName}</td>
                                <td className="px-6 py-3 text-slate-500 whitespace-nowrap text-center text-xs tracking-tight">{safeFormat(record.date, 'dd/MM/yyyy')}</td>
                                <td className="px-6 py-3 text-center font-medium tabular-nums">
                                  {record.actualEntry || '--:--'}
                                </td>
                                <td className="px-6 py-3 text-center font-medium tabular-nums">
                                  {record.actualExit || '--:--'}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {record.lateStatus !== 'none' ? (
                                    <span 
                                      onClick={() => {
                                        if (record.lateStatus === 'justified') {
                                          setSelectedJustification(record.lateJustification || {
                                            id: 'imported-late-' + idx,
                                            employeeId: '',
                                            employeeName: record.employeeName,
                                            date: safeFormat(record.date, 'yyyy-MM-dd'),
                                            type: 'ATRASO',
                                            description: 'Este incidente fue marcado como JUSTIFICADO directamente en el registro de asistencia cargado.',
                                            status: 'ACTIVO'
                                          } as ParticularIncident);
                                        }
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 font-bold rounded-md text-xs inline-flex items-center justify-center gap-1.5 min-w-[50px] border transition-all", 
                                        record.lateStatus === 'red' ? "bg-[#f44a63]/10 text-[#f44a63] border-[#f44a63]/20" : 
                                        record.lateStatus === 'yellow' ? "bg-[#ffa227]/10 text-[#ffa227] border-[#ffa227]/20" : 
                                        record.lateStatus === 'neutral' ? "bg-slate-200 text-slate-600 border-slate-300" :
                                        record.lateStatus === 'justified' ? "bg-emerald-50 text-emerald-600 border-emerald-200 cursor-help hover:bg-emerald-100 hover:scale-105 shadow-sm" :
                                        "bg-slate-100 text-slate-400 border-slate-200"
                                      )}
                                    >
                                      {record.lateStatus === 'justified' && <Info className="w-3 h-3" />}
                                      {record.lateStatus === 'justified' ? 'JUSTIFICADO' : record.lateStatus === 'hybrid' ? '-' : (record.lateStatus === 'none' ? '0 min' : `${record.lateMinutes} min`)}
                                    </span>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {record.exitStatus !== 'none' ? (
                                    <span 
                                      onClick={() => {
                                        if (record.exitStatus === 'justified') {
                                          setSelectedJustification(record.exitJustification || {
                                            id: 'imported-exit-' + idx,
                                            employeeId: '',
                                            employeeName: record.employeeName,
                                            date: safeFormat(record.date, 'yyyy-MM-dd'),
                                            type: 'SALIDA ANTICIPADA',
                                            description: 'Este incidente fue marcado como JUSTIFICADO directamente en el registro de asistencia cargado.',
                                            status: 'ACTIVO'
                                          } as ParticularIncident);
                                        }
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 font-bold rounded-md text-xs inline-flex items-center justify-center gap-1.5 min-w-[50px] border transition-all", 
                                        record.exitStatus === 'red' ? "bg-[#f44a63]/10 text-[#f44a63] border-[#f44a63]/20" : 
                                        record.exitStatus === 'yellow' ? "bg-[#ffa227]/10 text-[#ffa227] border-[#ffa227]/20" : 
                                        record.exitStatus === 'neutral' ? "bg-slate-200 text-slate-600 border-slate-300" :
                                        record.exitStatus === 'justified' ? "bg-emerald-50 text-emerald-600 border-emerald-200 cursor-help hover:bg-emerald-100 hover:scale-105 shadow-sm" :
                                        "bg-slate-100 text-slate-400 border-slate-200"
                                      )}
                                    >
                                      {record.exitStatus === 'justified' && <Info className="w-3 h-3" />}
                                      {record.exitStatus === 'justified' ? 'JUSTIFICADO' : record.exitStatus === 'hybrid' ? '-' : (record.exitStatus === 'none' ? '0 min' : `${record.earlyExitMinutes} min`)}
                                    </span>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className={cn("text-[11px] px-3 py-1 rounded-lg font-black uppercase tracking-tighter border", 
                                    record.isHybrid ? "bg-[#37d0d8]/10 text-[#37d0d8] border-[#37d0d8]/20 shadow-sm" :
                                    record.scheduledEntry !== (getDaySafe(record.date) === 6 ? satSchedule.entry : schedule.entry)
                                    ? "bg-[#4e63ce]/10 text-[#4e63ce] border-[#4e63ce]/20 shadow-sm" 
                                    : "bg-slate-50 text-slate-300 border-slate-200"
                                  )}>
                                    {record.isHybrid ? "Híbrida" : (record.scheduledEntry !== (getDaySafe(record.date) === 6 ? satSchedule.entry : schedule.entry) ? "Flexible" : "Regular")}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-center text-slate-600 font-medium whitespace-nowrap">
                                  {record.isJustifiedAbsence ? (
                                    <span 
                                      onClick={() => setSelectedJustification(record.absenceJustification)}
                                      className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-md border border-emerald-200 uppercase tracking-tighter cursor-help hover:bg-emerald-100 transition-colors shadow-sm inline-flex items-center gap-1"
                                    >
                                      <Info className="w-3 h-3" /> Justificada
                                    </span>
                                  ) : (record.hoursWorked !== null ? `${record.hoursWorked} h` : (record.isMissing ? (
                                    <span className="text-red-400 font-bold text-xs uppercase">
                                      {!record.actualEntry && !record.actualExit ? 'Ausencia' : (!record.actualEntry ? 'No marca entrada' : 'No marca salida')}
                                    </span>
                                  ) : '-'))}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-6 py-24 text-center text-slate-400 italic">
                            <div className="flex flex-col items-center gap-3">
                              <AlertCircle className="w-10 h-10 text-slate-200" />
                              <p>No se encontraron registros que coincidan con los filtros actuales</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Export */}
              <div className="flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => exportToExcel(analyzedResults)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Exportar Excel
                </button>
                <button 
                  onClick={() => exportToPDF()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Descargar Informe PDF
                </button>
              </div>
            </>
          ) : activeTab === 'hybrid' ? (
            <div className="space-y-6" id="hybrid-form-top">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-visible relative">
                {editingHybridId && (
                  <div className="absolute -top-3 left-6 px-4 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg animate-pulse z-10">
                    Modo Edición Activo
                  </div>
                )}
                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    Configuración de Plan Híbrido
                  </h3>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-1 ml-12 tracking-widest">Gestión de presencialidad y teletrabajo</p>
                </div>

                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Panel Izquierdo: Funcionario y Fecha */}
                    <div className="md:col-span-4 space-y-6">
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Colaborador</label>
                        <div className="relative group">
                          <input 
                            type="text" 
                            placeholder="Buscar funcionario..."
                            value={newHybrid.employeeName || ''}
                            onChange={(e) => {
                              setNewHybrid({...newHybrid, employeeName: e.target.value});
                              setHybridCursor(-1);
                              setShowHybridSuggestions(true);
                            }}
                            onFocus={() => setShowHybridSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowHybridSuggestions(false), 200)}
                            onKeyDown={handleHybridKeyDown}
                            className="w-full text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-slate-700 shadow-sm"
                          />
                          <Users className="w-4 h-4 absolute right-4 top-4.5 text-slate-300 group-focus-within:text-blue-500" />
                        </div>
                        {showHybridSuggestions && hybridSuggestions.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden py-1">
                            {hybridSuggestions.map((name, i) => (
                              <button
                                key={name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setNewHybrid({ ...newHybrid, employeeName: name });
                                  setHybridCursor(-1);
                                  setShowHybridSuggestions(false);
                                }}
                                className={cn(
                                  "w-full text-left px-5 py-3 text-xs font-bold transition-colors border-b border-slate-50 last:border-0",
                                  hybridCursor === i ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 text-center block">Vigencia del Plan</label>
                        <div className="flex flex-col gap-3">
                          <div className="relative group">
                            <input 
                              type="date" 
                              value={newHybrid.startDate || ''}
                              onChange={(e) => setNewHybrid({...newHybrid, startDate: e.target.value})}
                              onClick={(e) => (e.target as any).showPicker?.()}
                              className="w-full text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer font-bold text-slate-700 shadow-sm"
                            />
                            <Calendar className="w-4 h-4 absolute right-4 top-4.5 text-slate-300 pointer-events-none group-hover:text-blue-500" />
                          </div>
                          <div className="relative group">
                            <input 
                              type="date" 
                              value={newHybrid.endDate || ''}
                              onChange={(e) => setNewHybrid({...newHybrid, endDate: e.target.value})}
                              onClick={(e) => (e.target as any).showPicker?.()}
                              className="w-full text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer font-bold text-slate-700 shadow-sm"
                            />
                            <Calendar className="w-4 h-4 absolute right-4 top-4.5 text-slate-300 pointer-events-none group-hover:text-blue-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Panel Derecho: Planificador */}
                    <div className="md:col-span-8 space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                          Configuración Semanal
                        </label>
                        
                        <div className="grid grid-cols-5 gap-3">
                          {[1, 2, 3, 4, 5].map(d => {
                            const dayName = ['', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE'][d];
                            const config = (newHybrid.daysConfig && newHybrid.daysConfig[d]) || { isTelework: false, isHybrid: false, startTime: '08:00', endTime: '14:00' };
                            
                            const toggleTelework = () => {
                              const newCfg = { ...config, isTelework: !config.isTelework };
                              if (!newCfg.isTelework) newCfg.isHybrid = false;
                              setNewHybrid({
                                ...newHybrid,
                                daysConfig: { ...newHybrid.daysConfig, [d]: newCfg }
                              });
                            };

                            const toggleHybrid = () => {
                              if (!config.isTelework) return;
                              const newCfg = { ...config, isHybrid: !config.isHybrid };
                              setNewHybrid({
                                ...newHybrid,
                                daysConfig: { ...newHybrid.daysConfig, [d]: newCfg }
                              });
                            };

                            return (
                              <div key={d} className="flex flex-col gap-3">
                                <div className={cn(
                                  "relative p-4 rounded-[2rem] transition-all border-2 flex flex-col gap-4 shadow-sm",
                                  config.isTelework 
                                    ? "bg-white border-blue-500 ring-4 ring-blue-50" 
                                    : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                )}>
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className={cn(
                                      "text-[11px] font-black tracking-widest",
                                      config.isTelework ? "text-blue-600" : "text-slate-400"
                                    )}>{dayName}</span>
                                    
                                    {/* Toggle Switch Principal (Remoto) */}
                                    <div 
                                      onClick={toggleTelework}
                                      className={cn(
                                        "w-9 h-5 rounded-full relative transition-all cursor-pointer border",
                                        config.isTelework ? "bg-blue-600 border-blue-500" : "bg-slate-300 border-slate-300"
                                      )}
                                    >
                                      <div className={cn(
                                        "absolute top-0.5 w-[14px] h-[14px] bg-white rounded-full transition-all shadow-md",
                                        config.isTelework ? "left-[18px]" : "left-0.5"
                                      )} />
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-center justify-center py-1">
                                    {config.isTelework ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                                          <MonitorSmartphone className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">REMOTO</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="w-10 h-10 bg-slate-200/50 rounded-2xl flex items-center justify-center">
                                          <Building2 className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">PRESENCIAL</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div 
                                  onClick={toggleHybrid}
                                  className={cn(
                                    "w-full p-3.5 rounded-[1.5rem] transition-all border flex items-center justify-between gap-2 shadow-sm cursor-pointer active:scale-95",
                                    config.isHybrid 
                                      ? "bg-amber-500 border-amber-600 text-white" 
                                      : config.isTelework 
                                        ? "bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30 group"
                                        : "bg-slate-50 border-transparent opacity-30 cursor-not-allowed pointer-events-none"
                                  )}
                                >
                                  <div className="flex flex-col">
                                    <span className={cn(
                                      "text-[9px] font-black uppercase tracking-widest",
                                      config.isHybrid ? "text-white" : config.isTelework ? "text-slate-400 group-hover:text-amber-600" : "text-slate-300"
                                    )}>Híbrido</span>
                                    <span className={cn(
                                      "text-[7px] font-bold leading-none",
                                      config.isHybrid ? "text-amber-100" : config.isTelework ? "text-slate-300 group-hover:text-amber-400" : "text-slate-200"
                                    )}>{config.isHybrid ? 'ON' : 'OFF'}</span>
                                  </div>

                                  <div 
                                    className={cn(
                                      "w-8 h-4 rounded-full relative transition-all border",
                                      config.isHybrid ? "bg-white border-white" : "bg-slate-200 border-slate-300"
                                    )}
                                  >
                                    <div className={cn(
                                      "absolute top-0.5 w-[11px] h-[11px] rounded-full transition-all",
                                      config.isHybrid ? "left-[16px] bg-amber-500" : "left-0.5 bg-white shadow-sm"
                                    )} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <AnimatePresence>
                        {(Object.values(newHybrid.daysConfig || {}) as any[]).some(c => c?.isHybrid) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                            
                            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                              <div className="space-y-1 max-w-xs">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                    <Clock3 className="w-5 h-5 text-indigo-100" />
                                  </div>
                                  <h4 className="text-sm font-black uppercase tracking-widest text-indigo-50">Bloque Presencial</h4>
                                </div>
                                <p className="text-[10px] text-indigo-200 font-bold leading-tight">
                                  Días híbridos: se trabaja en oficina durante este bloque, el resto es teletrabajo.
                                </p>
                              </div>

                              <div className="flex items-center gap-4 bg-black/10 p-4 rounded-3xl backdrop-blur-xl border border-white/10">
                                <input 
                                  type="time" 
                                  value={(Object.values(newHybrid.daysConfig || {}) as any[]).find(c => c?.isHybrid)?.startTime || '08:00'}
                                  onChange={(e) => {
                                    const updated = { ...newHybrid.daysConfig };
                                    Object.keys(updated).forEach(k => {
                                      const key = Number(k);
                                      if (updated[key]?.isHybrid) {
                                        updated[key] = { ...updated[key], startTime: e.target.value };
                                      }
                                    });
                                    setNewHybrid({ ...newHybrid, daysConfig: updated });
                                  }}
                                  onClick={(e) => (e.target as any).showPicker?.()}
                                  className="w-32 text-center text-lg font-black bg-white/10 border-none rounded-2xl outline-none focus:bg-white/20 transition-all text-white p-3 cursor-pointer"
                                />
                                <div className="w-6 h-6 flex items-center justify-center text-indigo-300">
                                  <ArrowRight className="w-4 h-4" />
                                </div>
                                <input 
                                  type="time" 
                                  value={(Object.values(newHybrid.daysConfig || {}) as any[]).find(c => c?.isHybrid)?.endTime || '14:00'}
                                  onChange={(e) => {
                                    const updated = { ...newHybrid.daysConfig };
                                    Object.keys(updated).forEach(k => {
                                      const key = Number(k);
                                      if (updated[key]?.isHybrid) {
                                        updated[key] = { ...updated[key], endTime: e.target.value };
                                      }
                                    });
                                    setNewHybrid({ ...newHybrid, daysConfig: updated });
                                  }}
                                  onClick={(e) => (e.target as any).showPicker?.()}
                                  className="w-32 text-center text-lg font-black bg-white/10 border-none rounded-2xl outline-none focus:bg-white/20 transition-all text-white p-3 cursor-pointer"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                    {editingHybridId && (
                      <button
                        onClick={() => {
                          setEditingHybridId(null);
                          setNewHybrid({
                            employeeName: '',
                            startDate: format(new Date(), 'yyyy-MM-dd'),
                            endDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
                            daysConfig: {
                              1: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                              2: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                              3: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                              4: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                              5: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                            }
                          });
                        }}
                        className="px-8 h-16 bg-slate-100 text-slate-500 rounded-[2rem] text-sm font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <X className="w-5 h-5" /> Cancelar
                      </button>
                    )}
                    <button 
                      onClick={() => checkAdmin(() => {
                        if (!newHybrid.employeeName) return alert("Ingrese el nombre");
                        const activeDays = (Object.values(newHybrid.daysConfig || {}) as any[]).some(c => c?.isTelework);
                        if (!activeDays) return alert("Debe seleccionar al menos un día");
                        
                        if (editingHybridId) {
                          const cleanedName = cleanNameForDisplay(newHybrid.employeeName);
                          setHybridSchedules(hybridSchedules.map(h => 
                            h.id === editingHybridId ? { ...newHybrid, employeeName: cleanedName, id: editingHybridId } : h
                          ));
                          setEditingHybridId(null);
                        } else {
                          const id = Math.random().toString(36).substr(2, 9);
                          const cleanedName = cleanNameForDisplay(newHybrid.employeeName);
                          setHybridSchedules([{id, ...newHybrid, employeeName: cleanedName}, ...hybridSchedules]);
                        }
                        
                        setNewHybrid({
                          employeeName: '',
                          startDate: format(new Date(), 'yyyy-MM-dd'),
                          endDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
                          daysConfig: {
                            1: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                            2: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                            3: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                            4: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                            5: { isTelework: true, isHybrid: false, startTime: '08:00', endTime: '14:00' },
                          }
                        });
                      })}
                      className={cn(
                        "w-full md:w-auto px-16 h-16 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-3 active:scale-95 group",
                        editingHybridId 
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200" 
                          : "bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200"
                      )}
                    >
                      <CircleCheck className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                      {editingHybridId ? 'Actualizar Planificación' : 'Guardar Planificación Híbrida'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="px-6 py-4">Funcionario</th>
                      <th className="px-6 py-4">Vigencia</th>
                      <th className="px-6 py-4">Configuración Semanal</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hybridSchedules.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">No hay jornadas híbridas registradas</td></tr>
                    ) : (
                      hybridSchedules.map(h => (
                        <tr key={h.id} className="text-sm">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-700">{h.employeeName}</div>
                          </td>
                          <td className="px-6 py-4 tabular-nums text-slate-500">
                            {safeFormat(safeParseDate(h.startDate), 'dd/MM/yy')} - {safeFormat(safeParseDate(h.endDate), 'dd/MM/yy')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {[1,2,3,4,5].map(d => {
                                const config = h.daysConfig ? h.daysConfig[d] : null;
                                if (!config || !config.isTelework) return null;
                                return (
                                  <div key={d} className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                                    <span className="text-[9px] font-black text-slate-600 uppercase">
                                      {['','L','M','X','J','V'][d]}
                                    </span>
                                    {config.isHybrid && (
                                      <span className="flex items-center gap-1 text-[8px] font-bold text-blue-600 bg-blue-50 px-1 rounded">
                                        HIB ({config.startTime}-{config.endTime})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => checkAdmin(() => {
                                  setEditingHybridId(h.id);
                                  setNewHybrid({
                                    employeeName: h.employeeName,
                                    startDate: h.startDate,
                                    endDate: h.endDate,
                                    daysConfig: JSON.parse(JSON.stringify(h.daysConfig))
                                  });
                                  // Scroll to top of section
                                  document.querySelector('#hybrid-form-top')?.scrollIntoView({ behavior: 'smooth' });
                                })}
                                className="text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 p-2 rounded-lg"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => checkAdmin(() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: '¿Eliminar Plan Híbrido?',
                                    message: `Estás por eliminar la jornada híbrida de ${h.employeeName}. Esta acción no se puede deshacer.`,
                                    confirmLabel: 'Eliminar',
                                    isDangerous: true,
                                    onConfirm: () => {
                                      setHybridSchedules(hybridSchedules.filter(item => item.id !== h.id));
                                      if (editingHybridId === h.id) setEditingHybridId(null);
                                      setConfirmModal(null);
                                    }
                                  });
                                })}
                                className="text-red-500 hover:bg-red-50 transition-colors p-2 rounded-lg"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'justifications' ? (
            <div className="space-y-6 pb-10">
              {/* Sub-Navegación de Incidentes */}
              <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mx-auto shadow-inner border border-slate-200/50">
                <button
                  onClick={() => setIncidentSubTab('general')}
                  className={cn(
                    "px-8 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-widest",
                    incidentSubTab === 'general' ? "bg-white text-blue-600 shadow-md shadow-slate-200" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <AlertCircle className="w-4 h-4" /> GENERALES
                </button>
                <button
                  onClick={() => setIncidentSubTab('particular')}
                  className={cn(
                    "px-8 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-widest",
                    incidentSubTab === 'particular' ? "bg-white text-amber-600 shadow-md shadow-slate-200" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Users className="w-4 h-4" /> PARTICULARES
                </button>
              </div>

              {incidentSubTab === 'general' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Registro Excepción General */}
                  <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Excepciones Generales</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Impacto masivo de jornada</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
                        <div className="lg:col-span-3 space-y-1.5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Fecha del Suceso</label>
                          <input 
                            type="date" 
                            value={newGeneralEx.date || ''}
                            onChange={(e) => setNewGeneralEx({...newGeneralEx, date: e.target.value})}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            className="w-full h-11 text-xs px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-center"
                          />
                        </div>

                        <div className="lg:col-span-3 space-y-1.5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Justificación</label>
                          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl h-11">
                            {(['ATRASO', 'SALIDA ANTICIPADA', 'AUSENCIA'] as IncidentType[]).map(t => (
                              <button
                                key={t}
                                onClick={() => setNewGeneralEx({...newGeneralEx, type: t})}
                                className={cn(
                                  "flex-1 text-[10px] font-black rounded-lg transition-all",
                                  newGeneralEx.type === t 
                                    ? (t === 'ATRASO' ? "bg-white text-orange-600 shadow-sm" : t === 'AUSENCIA' ? "bg-white text-emerald-600 shadow-sm" : "bg-white text-red-600 shadow-sm")
                                    : "text-slate-400 hover:text-slate-600 font-bold"
                                )}
                              >
                                {t === 'SALIDA ANTICIPADA' ? 'SALIDA' : t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="lg:col-span-4 space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Motivo / Descripción</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Corte general de ruta..."
                            value={newGeneralEx.description || ''}
                            onChange={(e) => setNewGeneralEx({...newGeneralEx, description: e.target.value})}
                            className="w-full h-11 text-xs px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <button 
                            onClick={() => checkAdmin(() => {
                              if (!newGeneralEx.description.trim() || !newGeneralEx.date) return alert("Complete los campos");
                              const id = Math.random().toString(36).substr(2, 9);
                              setGeneralExceptions([{id, ...newGeneralEx}, ...generalExceptions]);
                              setNewGeneralEx({ description: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'ATRASO' });
                            })}
                            className={cn(
                              "w-full h-11 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95",
                              newGeneralEx.description.trim() ? "bg-blue-600 hover:bg-blue-700 shadow-blue-100" : "bg-slate-400 cursor-not-allowed"
                            )}
                          >
                            <Plus className="w-5 h-5" /> REGISTRAR
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4 text-center">Fecha</th>
                            <th className="px-6 py-4 text-center">Tipo</th>
                            <th className="px-6 py-4">Motivo</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                          {generalExceptions.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-xs">No hay excepciones registradas</td></tr>
                          ) : (
                            generalExceptions.map(ex => (
                              <tr key={ex.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 text-center tabular-nums text-slate-500">
                                  {format(parse(ex.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className={cn(
                                    "px-2.5 py-1 text-[10px] font-black rounded-lg border",
                                    ex.type === 'ATRASO' ? "bg-orange-50 text-orange-600 border-orange-200" : 
                                    ex.type === 'AUSENCIA' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                    "bg-red-50 text-red-600 border-red-200"
                                  )}>
                                    {ex.type === 'SALIDA ANTICIPADA' ? 'SALIDA' : ex.type}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                  <div 
                                    onClick={() => setSelectedJustification(ex)}
                                    className="text-slate-700 truncate max-w-[300px] cursor-pointer hover:text-blue-600 flex items-center gap-1.5"
                                  >
                                    <Info className="w-3.5 h-3.5 opacity-30" />
                                    {ex.description || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-lg border border-green-200">ACTIVO</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                   <button 
                                    onClick={() => checkAdmin(() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: '¿Eliminar Excepción?',
                                        message: '¿Estás seguro de que deseas eliminar esta excepción general?',
                                        confirmLabel: 'Eliminar',
                                        isDangerous: true,
                                        onConfirm: () => {
                                          setGeneralExceptions(generalExceptions.filter(item => item.id !== ex.id));
                                          setConfirmModal(null);
                                        }
                                      });
                                    })}
                                    className="text-red-500 hover:bg-red-50 transition-colors p-2 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Registro Incidente Particular */}
                  <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Incidentes Particulares</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Justificación por trabajador</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
                        <div className="lg:col-span-4 space-y-1.5 relative">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Trabajador</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              placeholder="Nombre del trabajador..."
                              value={newParticularIncident.employeeName || ''}
                              onChange={(e) => {
                                setNewParticularIncident({...newParticularIncident, employeeName: e.target.value});
                                setParticularCursor(-1);
                                setShowParticularSuggestions(true);
                              }}
                              onFocus={() => setShowParticularSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowParticularSuggestions(false), 200)}
                              onKeyDown={handleParticularKeyDown}
                              className="w-full h-11 text-xs pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          </div>
                          {showParticularSuggestions && particularSuggestionsList.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                              {particularSuggestionsList.map((name, i) => (
                                <button
                                  key={i}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setNewParticularIncident({ ...newParticularIncident, employeeName: name });
                                    setParticularCursor(-1);
                                    setShowParticularSuggestions(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-4 py-3 text-xs font-bold transition-colors border-b border-slate-50 last:border-0",
                                    particularCursor === i ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
                                  )}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="lg:col-span-3 space-y-1.5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Fecha</label>
                          <input 
                            type="date" 
                            value={newParticularIncident.date || ''}
                            onChange={(e) => setNewParticularIncident({...newParticularIncident, date: e.target.value})}
                            onClick={(e) => (e.target as any).showPicker?.()}
                            className="w-full h-11 text-xs px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold text-slate-700 text-center"
                          />
                        </div>

                        <div className="lg:col-span-3 space-y-1.5">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tipo</label>
                          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl h-11">
                            {(['ATRASO', 'SALIDA ANTICIPADA', 'AUSENCIA'] as IncidentType[]).map(t => (
                              <button
                                key={t}
                                onClick={() => setNewParticularIncident({...newParticularIncident, type: t})}
                                className={cn(
                                  "flex-1 text-[10px] font-black rounded-lg transition-all",
                                  newParticularIncident.type === t 
                                    ? (t === 'ATRASO' ? "bg-white text-orange-600 shadow-sm" : t === 'AUSENCIA' ? "bg-white text-emerald-600 shadow-sm" : "bg-white text-red-600 shadow-sm")
                                    : "text-slate-400 hover:text-slate-600 font-bold"
                                )}
                              >
                                {t === 'SALIDA ANTICIPADA' ? 'SALIDA' : t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="lg:col-span-2"></div>

                        <div className="lg:col-span-9 space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Motivo / Descripción</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Trámite médico, falla vehicular..."
                            value={newParticularIncident.description || ''}
                            onChange={(e) => setNewParticularIncident({...newParticularIncident, description: e.target.value})}
                            className="w-full h-11 text-xs px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          />
                        </div>

                        <div className="lg:col-span-3">
                          <button 
                            onClick={() => checkAdmin(() => {
                              if (!newParticularIncident.employeeName || !newParticularIncident.date || !newParticularIncident.description.trim()) {
                                return alert("Complete los campos");
                              }
                              const id = Math.random().toString(36).substr(2, 9);
                              const cleanedName = cleanNameForDisplay(newParticularIncident.employeeName);
                              setParticularIncidents([{id, ...newParticularIncident, employeeName: cleanedName}, ...particularIncidents]);
                              setNewParticularIncident({
                                employeeName: '',
                                date: format(new Date(), 'yyyy-MM-dd'),
                                type: 'ATRASO',
                                description: '',
                                status: 'ACTIVO'
                              });
                            })}
                            disabled={!newParticularIncident.description.trim() || !newParticularIncident.employeeName}
                            className={cn(
                              "w-full h-11 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95",
                              (newParticularIncident.description.trim() && newParticularIncident.employeeName) ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" : "bg-slate-400 cursor-not-allowed shadow-none"
                            )}
                          >
                            <Plus className="w-5 h-5" /> REGISTRAR
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Empleado</th>
                            <th className="px-6 py-4 text-center">Fecha</th>
                            <th className="px-6 py-4 text-center">Tipo</th>
                            <th className="px-6 py-4">Motivo</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                          {particularIncidents.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic text-xs">No hay incidentes registrados</td></tr>
                          ) : (
                            particularIncidents.map(pi => (
                              <tr key={pi.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 text-slate-800">{pi.employeeName}</td>
                                <td className="px-6 py-3 text-center tabular-nums text-slate-500">
                                  {format(parse(pi.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className={cn(
                                    "px-2.5 py-1 text-[10px] font-black rounded-lg border",
                                    pi.type === 'ATRASO' ? "bg-orange-50 text-orange-700 border-orange-200" : 
                                    pi.type === 'AUSENCIA' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    "bg-red-50 text-red-700 border-red-200"
                                  )}>
                                    {pi.type === 'SALIDA ANTICIPADA' ? 'SALIDA' : pi.type}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                   <div 
                                     onClick={() => setSelectedJustification(pi)}
                                     className="text-slate-600 truncate max-w-[250px] cursor-pointer hover:text-blue-600 flex items-center gap-1.5"
                                   >
                                     <Info className="w-3.5 h-3.5 opacity-30" />
                                     {pi.description || '-'}
                                   </div>
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-lg border border-green-200">ACTIVO</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                   <button 
                                    onClick={() => checkAdmin(() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: '¿Eliminar Incidente?',
                                        message: '¿Estás seguro de que deseas eliminar este incidente? No podrás deshacer esta acción.',
                                        confirmLabel: 'Eliminar',
                                        isDangerous: true,
                                        onConfirm: () => {
                                          setParticularIncidents(particularIncidents.filter(item => item.id !== pi.id));
                                          setConfirmModal(null);
                                        }
                                      });
                                    })}
                                    className="text-red-500 hover:bg-red-50 transition-colors p-2 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'horarios' ? (
            <div className="space-y-6">
               {/* Entry Form - New Layout */}
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
                 <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Trabajador</label>
                        <input 
                          type="text" 
                          placeholder="Nombre completo"
                          value={newEx.employeeName || ''}
                          onChange={(e) => {
                            setNewEx({...newEx, employeeName: e.target.value});
                            setFlexibleCursor(-1);
                            setShowFlexibleSuggestions(true);
                          }}
                          onFocus={() => setShowFlexibleSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowFlexibleSuggestions(false), 200)}
                          onKeyDown={handleFlexibleKeyDown}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {showFlexibleSuggestions && flexibleSuggestions.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                            {flexibleSuggestions.map((name, i) => (
                              <button
                                key={i}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setNewEx({ ...newEx, employeeName: name });
                                  setFlexibleCursor(-1);
                                  setShowFlexibleSuggestions(false);
                                }}
                                className={cn(
                                  "w-full text-left px-4 py-2 text-xs font-medium transition-colors border-b border-slate-50 last:border-0",
                                  flexibleCursor === i ? "bg-blue-600 text-white" : "hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Inicio (DD/MM/AAAA)</label>
                        <input 
                          type="text" 
                          placeholder="DD/MM/AAAA"
                          value={newEx.startDate || ''}
                          onChange={(e) => setNewEx({...newEx, startDate: e.target.value})}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Fin (DD/MM/AAAA)</label>
                        <input 
                          type="text" 
                          placeholder="DD/MM/AAAA"
                          value={newEx.endDate || ''}
                          onChange={(e) => setNewEx({...newEx, endDate: e.target.value})}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Turno Disponible</label>
                        <select 
                          value={`${newEx.deferredEntryTime}-${newEx.deferredExitTime}`}
                          onChange={(e) => {
                            const [entry, exit] = e.target.value.split('-');
                            setNewEx({...newEx, deferredEntryTime: entry, deferredExitTime: exit});
                          }}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                          <option value="07:30-15:30">07:30 a 15:30</option>
                          <option value="08:30-16:30">08:30 a 16:30</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => checkAdmin(() => {
                          if (!newEx.employeeName || !newEx.startDate || !newEx.endDate) {
                            alert("Completa los campos obligatorios.");
                            return;
                          }
                          const id = Math.random().toString(36).substr(2, 9);
                          const cleanedName = cleanNameForDisplay(newEx.employeeName);
                          setExceptions([{id, ...newEx, employeeName: cleanedName}, ...exceptions]);
                          setNewEx({
                            employeeName: '',
                            startDate: format(new Date(), 'dd/MM/yyyy'),
                            endDate: format(new Date(), 'dd/MM/yyyy'),
                            deferredEntryTime: '07:30',
                            deferredExitTime: '15:30'
                          });
                        })}
                        className="h-10 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Agregar Registro
                      </button>
                    </div>
                 </div>
               </div>

               <div className="flex items-center justify-between gap-4">
                  <div className="relative group flex-1">
                    <Search className={cn("w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors", exSearchTerm ? "text-indigo-500" : "text-slate-400")} />
                    <input 
                      type="text" 
                      placeholder="Buscar trabajador en la lista de jornadas flexibles..."
                      value={exSearchTerm || ''}
                      onFocus={() => setShowExSearchSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowExSearchSuggestions(false), 200)}
                      onChange={(e) => setExSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full shadow-sm"
                    />
                    <AnimatePresence>
                      {showExSearchSuggestions && exSearchSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                        >
                          {exSearchSuggestions.map((name, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setExSearchTerm(name);
                                setShowExSearchSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm font-medium text-slate-700 flex items-center justify-between group transition-colors border-b border-slate-50 last:border-0"
                            >
                              <span>{name}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total</span>
                      <span className="text-sm font-black text-slate-700 leading-none mt-1">
                        {new Set(exceptions.map(e => e.employeeName.trim().toUpperCase())).size} <span className="text-[10px] text-slate-400">funcionarios</span>
                      </span>
                    </div>
                  </div>
               </div>

              {/* List Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="px-6 py-4">Trabajador</th>
                      <th className="px-6 py-4">Rango de Fechas</th>
                      <th className="px-6 py-4 text-center">Jornada Flexible</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exceptions.filter(e => matchesFlexible(e.employeeName, exSearchTerm)).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">No hay horarios que coincidan.</td>
                      </tr>
                    ) : (
                      exceptions
                        .filter(e => matchesFlexible(e.employeeName, exSearchTerm))
                        .map(ex => (
                        <tr key={ex.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-700">{ex.employeeName}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-500 font-medium">{formatToDMY(ex.startDate)} — {formatToDMY(ex.endDate)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                               <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">{ex.deferredEntryTime}</span>
                               <span className="text-slate-300">|</span>
                               <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">{ex.deferredExitTime}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end items-center gap-2">
                              <button 
                                onClick={() => checkAdmin(() => { 
                                  setItemToEdit({
                                    ...ex,
                                    startDate: formatToDMY(ex.startDate),
                                    endDate: formatToDMY(ex.endDate)
                                  }); 
                                  setIsEditModalOpen(true); 
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" /> Modificar
                              </button>
                              <button 
                                onClick={() => checkAdmin(() => { setItemToDelete(ex.id); setIsDeleteModalOpen(true); })}
                                className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'datos' ? (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-600" />
                      Gestión de Datos
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Historial de archivos importados</p>
                  </div>
                </div>

                <div className="mt-6">
                   <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                               <Clock3 className="w-5 h-5" />
                            </div>
                            <div>
                               <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Historial de Cargas</h3>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{uploadHistory.length} Archivos</p>
                            </div>
                         </div>

                         <div className="hidden md:flex items-center gap-6 bg-slate-50/80 px-4 py-2 rounded-2xl border border-slate-100">
                           <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 tracking-tight shadow-xs uppercase">Limpio</span>
                             <span className="text-[9px] font-bold text-slate-400">Sin conflictos</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 tracking-tight shadow-xs uppercase">Editados</span>
                             <span className="text-[9px] font-bold text-slate-400">Sobreescribe datos</span>
                           </div>
                         </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col overflow-hidden mb-6 border border-slate-200 rounded-3xl bg-white shadow-sm">
                         {uploadHistory.length === 0 ? (
                           <div className="h-60 flex flex-col items-center justify-center text-slate-400 italic text-sm text-center px-8 bg-slate-50/50">
                              <History className="w-12 h-12 mb-4 opacity-20" />
                              <p className="max-w-[200px]">Aún no has importado archivos de asistencia.</p>
                           </div>
                         ) : (
                           <>
                             {/* Table Header */}
                              <div className="flex items-center gap-4 px-6 py-2 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10 shrink-0">
                                <button 
                                  onClick={() => toggleHistorySort('fileName')}
                                  className="flex-1 min-w-0 flex items-center gap-1 hover:text-indigo-600 transition-colors group/header overflow-hidden"
                                >
                                  <span className="truncate">Archivo</span>
                                  <ArrowUpDown className={cn("w-3 h-3 shrink-0 transition-opacity", historySort.key === 'fileName' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover/header:opacity-50")} />
                                </button>
                                <button 
                                  onClick={() => toggleHistorySort('uploadDate')}
                                  className="w-28 shrink-0 flex items-center justify-center gap-1 hover:text-indigo-600 transition-colors group/header"
                                >
                                  Carga 
                                  <ArrowUpDown className={cn("w-3 h-3 shrink-0 transition-opacity", historySort.key === 'uploadDate' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover/header:opacity-50")} />
                                </button>
                                <button 
                                  onClick={() => toggleHistorySort('recordCount')}
                                  className="w-20 shrink-0 flex items-center justify-center gap-1 hover:text-indigo-600 transition-colors group/header"
                                >
                                  Registros 
                                  <ArrowUpDown className={cn("w-3 h-3 shrink-0 transition-opacity", historySort.key === 'recordCount' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover/header:opacity-50")} />
                                </button>
                                <button 
                                  onClick={() => toggleHistorySort('dateRangeStart')}
                                  className="w-32 shrink-0 flex items-center justify-center gap-1 hover:text-indigo-600 transition-colors group/header"
                                >
                                  Periodo 
                                  <ArrowUpDown className={cn("w-3 h-3 shrink-0 transition-opacity", historySort.key === 'dateRangeStart' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover/header:opacity-50")} />
                                </button>
                                <div className="w-24 shrink-0 text-center">Estado</div>
                                <div className="w-20 shrink-0 text-right">Acciones</div>
                              </div>
                             
                             <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                               {sortedUploadHistory.map((item, idx) => (
                                 <div 
                                   key={item.id} 
                                   className={`flex items-center gap-4 px-6 py-2.5 transition-all group/item animate-in fade-in slide-in-from-top-2 duration-300 ${idx !== sortedUploadHistory.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-indigo-50/30`}
                                 >
                                   {/* Column: File */}
                                   <div 
                                      className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                                      onClick={() => setSelectedUpload(item)}
                                   >
                                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-500 font-bold text-[9px] uppercase shrink-0 shadow-xs group-hover/item:bg-white group-hover/item:border-indigo-200 transition-all">
                                         {item.fileName.includes('.') ? item.fileName.split('.').pop() : 'CSV'}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-slate-700 truncate group-hover/item:text-indigo-900 transition-colors" title={item.fileName}>{item.fileName}</p>
                                      </div>
                                   </div>

                                   {/* Column: Upload Date (New) */}
                                   <div className="w-28 text-center shrink-0">
                                      <p className="text-[10px] font-bold text-slate-400">
                                        {format(parseISO(item.uploadDate), 'dd/MM/yy HH:mm')}
                                      </p>
                                   </div>

                                   {/* Column: Records */}
                                   <div className="w-20 flex justify-center shrink-0">
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 inline-block min-w-[32px] text-center">
                                        {item.recordCount}
                                      </span>
                                   </div>

                                   {/* Column: Period */}
                                   <div className="w-32 flex justify-center shrink-0">
                                      {item.dateRange && item.dateRange.start ? (
                                        <div className="inline-flex flex-col items-center leading-tight">
                                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                            <span>{item.dateRange.start.split('-').reverse().join('/')}</span>
                                            <span className="text-slate-300 text-[8px]">→</span>
                                            <span>{item.dateRange.end.split('-').reverse().join('/')}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] text-slate-300 font-bold">---</span>
                                      )}
                                   </div>

                                   {/* Column: Status */}
                                   <div className="w-24 flex justify-center shrink-0">
                                      {item.overwrittenDates.length > 0 ? (
                                        <div className="inline-flex flex-col items-center">
                                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 tracking-tight">
                                            {item.overwrittenDates.length} EDITADOS
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 tracking-tight">
                                          LIMPIO
                                        </span>
                                      )}
                                   </div>

                                   {/* Column: Actions */}
                                   <div className="w-20 flex items-center justify-end gap-1.5">
                                     <button 
                                       onClick={() => setSelectedUpload(item)}
                                       className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm hover:border-slate-200 border border-transparent rounded-xl transition-all"
                                       title="Ver detalles"
                                     >
                                       <ChevronRight className="w-5 h-5" />
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.preventDefault();
                                         checkAdmin(() => {
                                            setConfirmModal({
                                              isOpen: true,
                                              title: '¿Eliminar Carga de Datos?',
                                              message: `¿Deseas eliminar "${item.fileName}"? Se borrarán todos los registros asociados a este archivo.`,
                                              confirmLabel: 'Confirmar Eliminación',
                                              isDangerous: true,
                                              onConfirm: () => {
                                                const datesToRemove = [...item.newDates, ...item.overwrittenDates];
                                                setData(prev => prev.filter(r => {
                                                  const rDate = r.date instanceof Date ? r.date : new Date(r.date);
                                                  return !datesToRemove.includes(format(rDate, 'yyyy-MM-dd'));
                                                }));
                                                setProcessedDates(prev => prev.filter(d => !datesToRemove.includes(d)));
                                                setUploadHistory(prev => prev.filter(h => h.id !== item.id));
                                                setConfirmModal(null);
                                              }
                                            });
                                         });
                                       }}
                                       className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-500 rounded-xl transition-all"
                                       title="Eliminar"
                                     >
                                       <Trash2 className="w-4.5 h-4.5" />
                                     </button>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           </>
                         )}
                      </div>

                      <div className="pt-6 border-t border-slate-100 mt-auto flex items-center justify-between">
                          <div className="flex gap-4 ml-auto">
                            <button 
                              onClick={() => {
                                const dataStr = JSON.stringify({
                                  data,
                                  exceptions,
                                  hybridSchedules,
                                  generalExceptions,
                                  particularIncidents,
                                  processedDates,
                                  uploadHistory,
                                  config: { schedule, satSchedule, appOptions, tolerances, theme }
                                }, null, 2);
                                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                                const exportFileDefaultName = 'respaldo_asistencias_' + format(new Date(), 'yyyy-MM-dd') + '.json';
                                const linkElement = document.createElement('a');
                                linkElement.setAttribute('href', dataUri);
                                linkElement.setAttribute('download', exportFileDefaultName);
                                linkElement.click();
                              }}
                              className="px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-xl text-[10px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                            >
                               <Download className="w-4 h-4" /> Exportar JSON
                            </button>
                            <button 
                              onClick={() => checkAdmin(() => {
                                 setConfirmModal({
                                   isOpen: true,
                                   title: '🚨 ¿LIMPIAR TODO?',
                                   message: 'Esta acción borrará permanentemente toda la base de datos de asistencia. No podrás deshacerlo.',
                                   confirmLabel: 'SI, LIMPIAR TODO',
                                   isDangerous: true,
                                   onConfirm: () => {
                                      setData([]);
                                      setProcessedDates([]);
                                      setExceptions(PRELOADED_HORARIOS);
                                      setHybridSchedules([]);
                                      setGeneralExceptions([]);
                                      setParticularIncidents([]);
                                      setUploadHistory([]);
                                      localStorage.clear();
                                      syncWithServer('save', {
                                        data: [],
                                        exceptions: PRELOADED_HORARIOS,
                                        hybridSchedules: [],
                                        generalExceptions: [],
                                        particularIncidents: [],
                                        processedDates: [],
                                        uploadHistory: [],
                                        config: { schedule, satSchedule, appOptions, tolerances, theme }
                                      }).then(() => {
                                         alert('Sistema reiniciado.');
                                         window.location.reload();
                                      });
                                      setConfirmModal(null);
                                   }
                                 });
                              })}
                              className="px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold uppercase tracking-tight hover:bg-red-100 transition-all flex items-center gap-2"
                            >
                               <Trash2 className="w-4 h-4" /> Limpiar Todo
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          ) : activeTab === 'config' ? (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-600" />
                      Configuración
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ajustes globales del sistema</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit">
                   {(['horarios', 'tolerancias'] as const).map(t => (
                     <button
                       key={t}
                       onClick={() => setConfigActiveTab(t)}
                       className={cn(
                         "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                         configActiveTab === t 
                          ? "bg-white text-blue-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                       )}
                     >
                       {t}
                     </button>
                   ))}
                </div>

                {configActiveTab === 'horarios' ? (
                  <div className="space-y-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* General Schedule */}
                        <div className="space-y-4 pr-0 md:pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Jornada Semanal</h3>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Lunes a Viernes</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Entrada</label>
                              <input 
                                type="time" 
                                value={schedule.entry || ''} 
                                onChange={(e) => isAdmin ? setSchedule({...schedule, entry: e.target.value}) : checkAdmin(() => {})}
                                className="w-full text-base font-bold p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Salida</label>
                              <input 
                                type="time" 
                                value={schedule.exit || ''} 
                                onChange={(e) => isAdmin ? setSchedule({...schedule, exit: e.target.value}) : checkAdmin(() => {})}
                                className="w-full text-base font-bold p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all tabular-nums"
                              />
                            </div>
                          </div>

                          <div className="flex gap-1.5 pt-2">
                           {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, idx) => {
                             const dayNumber = (idx + 1) % 7;
                             const isActive = activeDays.general.includes(dayNumber);
                             return (
                               <button 
                                 key={day}
                                 onClick={() => checkAdmin(() => {
                                    const newDays = isActive 
                                      ? activeDays.general.filter((d: number) => d !== dayNumber)
                                      : [...activeDays.general, dayNumber];
                                    setActiveDays({...activeDays, general: newDays});
                                 })}
                                 className={cn(
                                   "w-7 h-7 rounded-lg text-[10px] font-black transition-all border",
                                   isActive 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                 )}
                               >
                                 {day}
                               </button>
                             )
                           })}
                          </div>
                        </div>

                        {/* Weekend Schedule */}
                        <div className="space-y-4 pt-8 md:pt-0 pl-0 md:pl-8">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Fin de Semana</h3>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Sábados y Domingos</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Entrada</label>
                              <input 
                                type="time" 
                                value={satSchedule.entry || ''} 
                                onChange={(e) => isAdmin ? setSatSchedule({...satSchedule, entry: e.target.value}) : checkAdmin(() => {})}
                                className="w-full text-base font-bold p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Salida</label>
                              <input 
                                type="time" 
                                value={satSchedule.exit || ''} 
                                onChange={(e) => isAdmin ? setSatSchedule({...satSchedule, exit: e.target.value}) : checkAdmin(() => {})}
                                className="w-full text-base font-bold p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 transition-all tabular-nums"
                              />
                            </div>
                          </div>

                          <div className="flex gap-1.5 pt-2">
                           {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, idx) => {
                             const dayNumber = (idx + 1) % 7;
                             const isActive = activeDays.saturday.includes(dayNumber);
                             return (
                               <button 
                                 key={day}
                                 onClick={() => checkAdmin(() => {
                                    const newDays = isActive 
                                      ? activeDays.saturday.filter((d: number) => d !== dayNumber)
                                      : [...activeDays.saturday, dayNumber];
                                    setActiveDays({...activeDays, saturday: newDays});
                                 })}
                                 className={cn(
                                   "w-7 h-7 rounded-lg text-[10px] font-black transition-all border",
                                   isActive 
                                    ? "bg-orange-500 border-orange-500 text-white shadow-sm" 
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                 )}
                               >
                                 {day}
                               </button>
                             )
                           })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Registro Automático</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button 
                            onClick={() => checkAdmin(() => setAppOptions({...appOptions, autoLate: !appOptions.autoLate}))}
                            className="flex items-center gap-3 text-left p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                          >
                            <div className={cn("w-10 h-5 rounded-full relative transition-colors shrink-0", appOptions.autoLate ? "bg-blue-600" : "bg-slate-200")}>
                              <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", appOptions.autoLate ? "left-5.5" : "left-0.5")} />
                            </div>
                            <div>
                               <p className="text-[11px] font-bold text-slate-700">Atrasos automáticos</p>
                               <p className="text-[9px] text-slate-400 font-medium leading-tight">Marca atrasos según tolerancia</p>
                             </div>
                           </button>

                           <button 
                            onClick={() => checkAdmin(() => setAppOptions({...appOptions, earlyExit: !appOptions.earlyExit}))}
                            className="flex items-center gap-3 text-left p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                          >
                            <div className={cn("w-10 h-5 rounded-full relative transition-colors shrink-0", appOptions.earlyExit ? "bg-blue-600" : "bg-slate-200")}>
                               <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", appOptions.earlyExit ? "left-5.5" : "left-0.5")} />
                            </div>
                            <div>
                               <p className="text-[11px] font-bold text-slate-700">Salidas anticipadas</p>
                               <p className="text-[9px] text-slate-400 font-medium leading-tight">Activa monitoreo de término</p>
                             </div>
                           </button>
                         </div>
                        </div>
                     </div>
                 ) : (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                     {/* Reglas de Ingreso */}
                     <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                <Timer className="w-7 h-7" />
                             </div>
                             <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Reglas de Ingreso</h3>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Umbrales inicio jornada</p>
                             </div>
                          </div>
                        </div>

                        <div className="relative pt-14 pb-10 px-12">
                          <div className="absolute inset-y-0 left-12 right-12 pointer-events-none">
                            {/* Start/End Labels */}
                            <div className="absolute top-[58px] -left-8 flex items-center h-4">
                              <span className="text-[10px] font-bold text-slate-300">0</span>
                            </div>
                            <div className="absolute top-[58px] -right-8 flex justify-end flex items-center h-4">
                              <span className="text-[10px] font-bold text-slate-300">1h+</span>
                            </div>

                            <div 
                              className="absolute top-0 flex flex-col items-center"
                              style={{ left: `${((tolerances.entryGrace || 0) / 60) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Cortesía</span>
                              <span className="px-2 py-1 bg-slate-400 text-white text-xs font-black rounded-lg shadow-md">{tolerances.entryGrace}m</span>
                              <div className="w-0.5 h-4 bg-slate-400/20 mt-1" />
                            </div>

                            <div 
                              className="absolute top-0 flex flex-col items-center"
                              style={{ left: `${((tolerances.entryYellow || 0) / 60) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter mb-1">Atraso</span>
                              <span className="px-2 py-1 bg-red-600 text-white text-xs font-black rounded-lg shadow-md">{tolerances.entryYellow >= 60 ? '1H+' : `${tolerances.entryYellow}m`}</span>
                              <div className="w-0.5 h-4 bg-red-600/20 mt-1" />
                            </div>
                          </div>

                          <div className="relative h-6 flex items-center">
                            <div className="absolute inset-x-0 h-4 bg-slate-50 rounded-full border border-slate-200 overflow-hidden flex">
                              <div style={{ width: `${((tolerances.entryGrace || 0) / 60) * 100}%` }} className="bg-slate-200 h-full" />
                              <div style={{ width: `${(((tolerances.entryYellow || 0) - (tolerances.entryGrace || 0)) / 60) * 100}%` }} className="bg-amber-400 h-full" />
                              <div className="flex-1 bg-red-600 h-full" />
                            </div>

                            <div className="relative w-full h-full">
                              <input 
                                type="range" min="0" max="60" step="1"
                                value={tolerances.entryYellow || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val >= (tolerances.entryGrace || 0)) {
                                    isAdmin ? setTolerances(prev => ({...prev, entryYellow: val, entryRed: val})) : checkAdmin(() => {});
                                  }
                                }}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                              />
                              <input 
                                type="range" min="0" max="60" step="1"
                                value={tolerances.entryGrace || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val <= (tolerances.entryYellow || 60)) {
                                    isAdmin ? setTolerances(prev => ({...prev, entryGrace: val})) : checkAdmin(() => {});
                                  }
                                }}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-slate-400 [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-slate-200 rounded-full" />
                              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Cortesía</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Tiempo de gracia. El registro es correcto.</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-amber-400 rounded-full" />
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Alerta</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Atrasos leves que aparecen en amarillo.</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-600 rounded-full" />
                              <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Atraso</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Marca el registro en rojo intenso.</p>
                          </div>
                        </div>
                     </div>

                     {/* Reglas de Salida */}
                     <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-sm">
                                <LogOut className="w-7 h-7" />
                             </div>
                             <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Reglas de Salida</h3>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Umbrales término jornada</p>
                             </div>
                          </div>
                        </div>

                        <div className="relative pt-14 pb-10 px-12">
                          <div className="absolute inset-y-0 left-12 right-12 pointer-events-none">
                            {/* Start/End Labels */}
                            <div className="absolute top-[58px] -left-8 flex items-center h-4">
                              <span className="text-[10px] font-bold text-slate-300">0</span>
                            </div>
                            <div className="absolute top-[58px] -right-8 flex justify-end flex items-center h-4">
                              <span className="text-[10px] font-bold text-slate-300">1h+</span>
                            </div>

                            <div 
                              className="absolute top-0 flex flex-col items-center"
                              style={{ left: `${((tolerances.exitGrace || 0) / 60) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Cortesía</span>
                              <span className="px-2 py-1 bg-slate-400 text-white text-xs font-black rounded-lg shadow-md">{tolerances.exitGrace}m</span>
                              <div className="w-0.5 h-4 bg-slate-400/20 mt-1" />
                            </div>

                            <div 
                              className="absolute top-0 flex flex-col items-center"
                              style={{ left: `${((tolerances.exitYellow || 0) / 60) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter mb-1">Falta</span>
                              <span className="px-2 py-1 bg-red-600 text-white text-xs font-black rounded-lg shadow-md">{tolerances.exitYellow >= 60 ? '1H+' : `${tolerances.exitYellow}m`}</span>
                              <div className="w-0.5 h-4 bg-red-600/20 mt-1" />
                            </div>
                          </div>

                          <div className="relative h-6 flex items-center">
                            <div className="absolute inset-x-0 h-4 bg-slate-50 rounded-full border border-slate-200 overflow-hidden flex">
                              <div style={{ width: `${((tolerances.exitGrace || 0) / 60) * 100}%` }} className="bg-slate-200 h-full" />
                              <div style={{ width: `${(((tolerances.exitYellow || 0) - (tolerances.exitGrace || 0)) / 60) * 100}%` }} className="bg-amber-400 h-full" />
                              <div className="flex-1 bg-red-600 h-full" />
                            </div>

                            <div className="relative w-full h-full">
                              <input 
                                type="range" min="0" max="60" step="1"
                                value={tolerances.exitYellow || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val >= (tolerances.exitGrace || 0)) {
                                    isAdmin ? setTolerances(prev => ({...prev, exitYellow: val, exitRed: val})) : checkAdmin(() => {});
                                  }
                                }}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-30 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                              />
                              <input 
                                type="range" min="0" max="60" step="1"
                                value={tolerances.exitGrace || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (val <= (tolerances.exitYellow || 60)) {
                                    isAdmin ? setTolerances(prev => ({...prev, exitGrace: val})) : checkAdmin(() => {});
                                  }
                                }}
                                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-slate-400 [&::-webkit-slider-thumb]:shadow-lg cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-slate-200 rounded-full" />
                              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Cortesía</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Salida a tiempo. El registro es correcto.</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-amber-400 rounded-full" />
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Alerta</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Salidas anticipadas breves en amarillo.</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-600 rounded-full" />
                              <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Falta</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Marca el registro en rojo intenso.</p>
                          </div>
                        </div>
                     </div>
                   </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400">
               <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-lg font-medium">Esta sección aún no está implementada.</p>
               <button onClick={() => setActiveTab('report')} className="mt-4 text-blue-600 font-bold hover:underline">Volver al Reporte</button>
            </div>
          )}
        </div>
      </main>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Panel Administrativo</h3>
                  <button onClick={() => { setShowLoginModal(false); setLoginMessage(null); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {loginMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {loginMessage}
                  </motion.div>
                )}
                
                <form onSubmit={handleAdminModalLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Usuario</label>
                    <input 
                      type="text" 
                      autoComplete="username"
                      value={loginForm.user || ''}
                      onChange={(e) => setLoginForm({...loginForm, user: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      placeholder="Ingrese su usuario"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contraseña</label>
                    <input 
                      type="password" 
                      autoComplete="current-password"
                      value={loginForm.password || ''}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                  >
                    Acceder al Sistema
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedUpload && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setSelectedUpload(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setSelectedUpload(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                  <FileUp className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Detalle de Carga</h2>
                  <p className="text-[11px] font-bold text-slate-400 truncate max-w-sm">{selectedUpload.fileName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de Carga</p>
                  <p className="text-xs font-bold text-slate-700">{format(parseISO(selectedUpload.uploadDate), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Registros</p>
                  <p className="text-xs font-bold text-slate-700">{selectedUpload.recordCount} Jornadas</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    Rango de Fechas
                  </h3>
                  <div className="flex items-center gap-2 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                    <span className="text-xs font-bold text-indigo-700">{format(parseISO(selectedUpload.dateRange.start), 'dd/MM/yyyy')}</span>
                    <ArrowRight className="w-3 h-3 text-indigo-300" />
                    <span className="text-xs font-bold text-indigo-700">{format(parseISO(selectedUpload.dateRange.end), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                {selectedUpload.overwrittenDates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="w-4 h-4" />
                      Datos Sobre-escritos ({selectedUpload.overwrittenDates.length})
                    </h3>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-[10px] text-amber-700 font-bold mb-3 leading-relaxed">
                        Los siguientes días ya tenían datos y fueron actualizados con la información de este archivo:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedUpload.overwrittenDates.map(date => (
                          <span key={date} className="px-2 py-0.5 bg-white text-[9px] font-black text-amber-600 border border-amber-200 rounded-md">
                            {format(parseISO(date), 'dd/MM')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Nuevos Días Agregados ({selectedUpload.newDates.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUpload.newDates.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No se agregaron días nuevos.</p>
                    ) : (
                      selectedUpload.newDates.map(date => (
                        <span key={date} className="px-2 py-0.5 bg-green-50 text-[9px] font-black text-green-600 border border-green-100 rounded-md">
                          {format(parseISO(date), 'dd/MM')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setSelectedUpload(null)}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-xs w-full flex flex-col items-center"
            >
              <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-4" />
              <h3 className="text-lg font-bold mb-1">Procesando Reporte</h3>
              <p className="text-sm text-slate-500">Estamos organizando los marcajes de la planilla para ti...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && itemToEdit && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" /> Modificar Horario Diferido
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Trabajador</label>
                  <input 
                    type="text" 
                    value={itemToEdit?.employeeName || ''}
                    onChange={(e) => setItemToEdit({...itemToEdit!, employeeName: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Inicio (DD/MM/AAAA)</label>
                    <input 
                      type="text" 
                      value={itemToEdit?.startDate || ''}
                      onChange={(e) => setItemToEdit({...itemToEdit!, startDate: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Fin (DD/MM/AAAA)</label>
                    <input 
                      type="text" 
                      value={itemToEdit?.endDate || ''}
                      onChange={(e) => setItemToEdit({...itemToEdit!, endDate: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Turno Disponible</label>
                    <select 
                      value={itemToEdit ? `${itemToEdit.deferredEntryTime}-${itemToEdit.deferredExitTime}` : ""}
                      onChange={(e) => {
                        const [entry, exit] = e.target.value.split('-');
                        setItemToEdit({...itemToEdit!, deferredEntryTime: entry, deferredExitTime: exit});
                      }}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                    >
                      <option value="07:30-15:30">07:30 a 15:30</option>
                      <option value="08:30-16:30">08:30 a 16:30</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      const cleanedName = cleanNameForDisplay(itemToEdit.employeeName);
                      setExceptions(exceptions.map(ex => ex.id === itemToEdit.id ? { ...itemToEdit, employeeName: cleanedName } : ex));
                      setIsEditModalOpen(false);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">¿Estás seguro?</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Esta acción eliminará permanentemente este horario diferido. No podrás deshacerlo.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (itemToDelete) setExceptions(exceptions.filter(e => e.id !== itemToDelete));
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Justification Details Modal */}
      <AnimatePresence>
        {selectedJustification && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJustification(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
                <div className="space-y-1">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    selectedJustification.type === 'ATRASO' ? "bg-amber-50 text-amber-600 border-amber-200" : 
                    selectedJustification.type === 'SALIDA ANTICIPADA' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    "bg-blue-50 text-blue-600 border-blue-200"
                  )}>
                    Justificación: {
                      selectedJustification.type === 'ATRASO' ? 'Atraso' : 
                      selectedJustification.type === 'SALIDA ANTICIPADA' ? 'Salida Anticipada' : 
                      selectedJustification.type
                    }
                  </span>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight pt-2">Detalles del Incidente</h3>
                </div>
                <button onClick={() => setSelectedJustification(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-200 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alcance</p>
                      <p className="font-bold text-slate-700 truncate">
                        {('employeeName' in selectedJustification) ? selectedJustification.employeeName : 'General (Masivo)'}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha</p>
                      <p className="font-bold text-slate-700">
                        {selectedJustification.date ? format(parse(selectedJustification.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '-'}
                      </p>
                    </div>
                  </div>

                <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Info className="w-16 h-16 text-blue-600" />
                  </div>
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Motivo de la Justificación
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 min-h-[100px] shadow-inner">
                    <p className="text-slate-700 font-medium leading-relaxed italic break-words whitespace-pre-wrap">
                      {selectedJustification.description || 'Sin descripción detallada registrada.'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedJustification(null)}
                  className="w-full py-5 bg-slate-800 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl shadow-slate-200 active:scale-95"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Generic Modal */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                confirmModal.isDangerous ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
              )}>
                {confirmModal.isDangerous ? (
                  <Trash2 className="w-8 h-8" />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center font-bold text-2xl">?</div>
                )}
              </div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                  }}
                  className={cn(
                    "flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all",
                    confirmModal.isDangerous ? "bg-red-600 hover:bg-red-700 shadow-red-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                  )}
                >
                  {confirmModal.confirmLabel || 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, subValue, icon, percentage, colorClass }: { label: string, value: any, subValue: string, icon: React.ReactNode, percentage: number, colorClass: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const isHex = colorClass.startsWith('text-[#');
  const hexValue = isHex ? colorClass.match(/#([a-fA-F0-9]+)/)?.[0] : null;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/50 flex items-center justify-between group transition-all"
    >
      <div className="space-y-1 font-sans">
        <div className="flex items-center gap-2">
          <div 
            className="p-1.5 rounded-xl shrink-0 transition-colors" 
            style={{ 
              backgroundColor: hexValue ? `${hexValue}10` : undefined,
              color: hexValue || undefined
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { className: cn("w-3.5 h-3.5 opacity-80", !hexValue && colorClass) })}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
        </div>
        <div className="flex items-baseline gap-1.5 pl-1.5">
           <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
           <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{subValue}</p>
        </div>
      </div>
      
      <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="28"
            cy="28"
            r={radius - 4}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            className="text-slate-100"
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="28"
            cy="28"
            r={radius - 4}
            stroke={hexValue || 'currentColor'}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            className={!hexValue ? colorClass : ""}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-500">{Math.round(percentage)}%</span>
      </div>
    </motion.div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold">
      <div className={cn("w-3 h-3 rounded-sm", color)}></div> {label}
    </div>
  );
}
