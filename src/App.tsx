import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  Download,
  ChevronRight,
  Search,
  LayoutDashboard,
  Users,
  Settings,
  Edit2,
  Check,
  X,
  ArrowRight
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
  isWithinInterval, 
  startOfDay,
  startOfWeek,
  endOfWeek,
  getWeekOfMonth,
  addDays,
  subDays,
  startOfMonth,
  subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from './lib/utils';
import { AttendanceRecord, Exception, AnalysisResult } from './types';

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
const parseExDate = (s: string) => {
  if (!s) return new Date();
  const parts = s.split(/[\/-]/);
  if (parts.length < 3) return new Date(s);
  if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); // YYYY-MM-DD
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])); // DD/MM/YYYY
};

const formatToDMY = (s: string) => {
  try {
     const d = parseExDate(s);
     return format(d, 'dd/MM/yyyy');
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

const normalizeString = (str: string) => {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/[áäàâ]/g, 'a')
    .replace(/[éëèê]/g, 'e')
    .replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o')
    .replace(/[úüùû]/g, 'u')
    .replace(/ñ/g, 'n') // Normalize ñ to n ONLY for matching purposes
    .replace(/\s+/g, ' ')
    .trim();
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

const getSpanishDayAbbr = (date: Date) => {
  const days = ['DOM', 'LUN', 'MAR', 'MIER', 'JUEV', 'VIER', 'SAB'];
  return days[date.getDay()];
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem('timetrack_schedule');
    return saved ? JSON.parse(saved) : { entry: DEFAULT_ENTRY, exit: DEFAULT_EXIT };
  });
  const [satSchedule, setSatSchedule] = useState(() => {
    const saved = localStorage.getItem('timetrack_sat_schedule');
    return saved ? JSON.parse(saved) : { entry: '09:00', exit: '13:00' };
  });

  React.useEffect(() => {
    localStorage.setItem('timetrack_data', JSON.stringify(data));
  }, [data]);

  React.useEffect(() => {
    localStorage.setItem('timetrack_exceptions', JSON.stringify(exceptions));
  }, [exceptions]);

  React.useEffect(() => {
    localStorage.setItem('timetrack_schedule', JSON.stringify(schedule));
  }, [schedule]);

  React.useEffect(() => {
    localStorage.setItem('timetrack_sat_schedule', JSON.stringify(satSchedule));
  }, [satSchedule]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'report' | 'workers' | 'horarios' | 'config'>('report');
  const [bulkText, setBulkText] = useState('');

  const extractTime = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return format(val, 'HH:mm');
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

  const getMonthFromSpanishName = (name: string): number => {
    const months: Record<string, number> = {
      'ene': 1, 'enero': 1,
      'feb': 2, 'febrero': 2,
      'mar': 3, 'marzo': 3,
      'abr': 4, 'abril': 4,
      'may': 5, 'mayo': 5,
      'jun': 6, 'junio': 6,
      'jul': 7, 'julio': 7,
      'ago': 8, 'agosto': 8,
      'sep': 9, 'septiembre': 9,
      'oct': 10, 'octubre': 10,
      'nov': 11, 'noviembre': 11,
      'dic': 12, 'diciembre': 12
    };
    const lower = name.toLowerCase();
    for (const key in months) {
      if (lower.startsWith(key)) return months[key];
    }
    return 1;
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
        Fecha: format(d.date, 'dd/MM/yyyy'),
        Dia: d.dayName,
        'Hora Ingreso': d.actualEntry || '--:--',
        'Hora Salida': d.actualExit || '--:--',
        'Horas Trabajadas': d.hoursWorked || 0,
        'Atraso (min)': d.lateMinutes > 0 ? d.lateMinutes : 0,
        'Salida Anticipada (min)': d.earlyExitMinutes > 0 ? d.earlyExitMinutes : 0,
        'Tipo Jornada': d.scheduledEntry !== (d.date.getDay() === 6 ? satSchedule.entry : schedule.entry) ? 'Flexible' : 'Regular'
      }))
    );

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Asistencia_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
    doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 25);
    doc.text(`Filtro: ${format(new Date(dateFilterStart + 'T00:00:00'), 'dd/MM/yyyy')} al ${format(new Date(dateFilterEnd + 'T00:00:00'), 'dd/MM/yyyy')}`, 14, 30);
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

    const tableRows = analyzedResults.flatMap(worker => 
      worker.details.map(d => [
        worker.employeeName,
        format(d.date, 'dd/MM/yyyy'),
        d.actualEntry || '--:--',
        d.actualExit || '--:--',
        d.lateMinutes > 0 ? `${d.lateMinutes} min` : '-',
        d.earlyExitMinutes > 0 ? `${d.earlyExitMinutes} min` : '-',
        d.scheduledEntry !== (d.date.getDay() === 6 ? satSchedule.entry : schedule.entry) ? 'Flexible' : 'Regular',
        d.hoursWorked !== null ? `${d.hoursWorked} h` : '-'
      ])
    );

    (autoTable as any)(doc, {
      head: [['Trabajador', 'Fecha', 'Entrada', 'Salida', 'Atraso', 'Sal. Ant.', 'Jornada', 'Hrs Trab.']],
      body: tableRows,
      startY: 65,
      theme: 'striped',
      headStyles: { fillColor: [55, 57, 61], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8 },
      didParseCell: (dataCell: any) => {
        if (dataCell.section === 'body') {
          // Column 4: Atraso
          if (dataCell.column.index === 4) {
            const lateVal = dataCell.cell.raw;
            if (lateVal && lateVal !== '-') {
              const mins = parseInt(lateVal);
              if (mins > 20) {
                dataCell.cell.styles.textColor = [255, 255, 255]; 
                dataCell.cell.styles.fillColor = [244, 74, 99]; // Handing Red
              } else if (mins >= 11) {
                dataCell.cell.styles.textColor = [255, 255, 255]; 
                dataCell.cell.styles.fillColor = [255, 162, 39]; // Handing Orange
              } else if (mins >= 1) {
                dataCell.cell.styles.textColor = [30, 41, 59]; 
                dataCell.cell.styles.fillColor = [241, 245, 249]; // Slate 100
              }
            }
          }
          // Column 5: Salida Ant.
          if (dataCell.column.index === 5) {
            const earlyVal = dataCell.cell.raw;
            if (earlyVal && earlyVal !== '-') {
              const mins = parseInt(earlyVal);
              if (mins > 20) {
                dataCell.cell.styles.textColor = [255, 255, 255];
                dataCell.cell.styles.fillColor = [244, 74, 99]; // Handing Red
              } else if (mins >= 11) {
                dataCell.cell.styles.textColor = [255, 255, 255];
                dataCell.cell.styles.fillColor = [255, 162, 39]; // Handing Orange
              } else if (mins >= 1) {
                dataCell.cell.styles.textColor = [30, 41, 59];
                dataCell.cell.styles.fillColor = [241, 245, 249]; // Slate 100
              }
            }
          }
          // Column 6: Jornada
          if (dataCell.column.index === 6 && dataCell.cell.raw === 'Flexible') {
            dataCell.cell.styles.textColor = [255, 255, 255];
            dataCell.cell.styles.fillColor = [78, 99, 206]; // Handing Blue
          }
        }
      }
    });

    doc.save(`Reporte_Asistencia_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllDays, setShowAllDays] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Exception | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [exSearchTerm, setExSearchTerm] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [dateFilterEnd, setDateFilterEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterLateness, setFilterLateness] = useState(false);
  const [filterEarlyExit, setFilterEarlyExit] = useState(false);
  const [newEx, setNewEx] = useState<Omit<Exception, 'id'>>({
    employeeName: '',
    startDate: format(new Date(), 'dd/MM/yyyy'),
    endDate: format(new Date(), 'dd/MM/yyyy'),
    deferredEntryTime: '07:30',
    deferredExitTime: '15:30'
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    
    // Clear current data to avoid merging with new file
    setData([]);
    
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

              // Must look like a real name: 2+ words, no special characters (except spaces/accents)
              if (val.length > 8 && val.split(/\s+/).length >= 2 && !/[@#$%\^&\*\(\)_+=\[\]\{\};:"\\\|,<>\/?]/.test(val)) {
                const cleaned = cleanNameForDisplay(val);
                if (cleaned.length > 8) {
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

              const key = `${lastNameInSheet}-${format(rowDate, 'yyyy-MM-dd')}`;
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
          setData([]);
          alert("No se detectaron jornadas válidas en el archivo.");
        } else {
          setData(finalRecords);
          const rangeStr = (foundDateRange.min && foundDateRange.max) 
            ? `\nRango: ${format(foundDateRange.min, 'dd/MM/yyyy')} al ${format(foundDateRange.max, 'dd/MM/yyyy')}`
            : "";
          alert(`Éxito: Se procesaron ${finalRecords.length} jornadas únicas.${rangeStr}`);
          
          // Auto-update date filters to match data
          if (foundDateRange.min) setDateFilterStart(format(foundDateRange.min, 'yyyy-MM-dd'));
          if (foundDateRange.max) setDateFilterEnd(format(foundDateRange.max, 'yyyy-MM-dd'));
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
    if (window.confirm('¿Estás seguro de que deseas eliminar este horario diferido?')) {
      setExceptions(exceptions.filter(e => e.id !== id));
    }
  };

  const updateException = (id: string, field: keyof Exception, value: string) => {
    setExceptions(exceptions.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));
  };

  const analyzedResults = useMemo(() => {
    const resultsMap: Record<string, AnalysisResult> = {};
    const filteredByDate = data.filter(record => {
      try {
        if (!record.date) return false;
        const d = startOfDay(record.date);
        const start = dateFilterStart ? startOfDay(new Date(dateFilterStart + 'T00:00:00')) : null;
        const end = dateFilterEnd ? startOfDay(new Date(dateFilterEnd + 'T00:00:00')) : null;
        if (start && d.getTime() < start.getTime()) return false;
        if (end && d.getTime() > end.getTime()) return false;
        return true;
      } catch(e) { return true; }
    });

    filteredByDate.forEach(record => {
      const name = record.employeeName;
      if (!resultsMap[name]) resultsMap[name] = { employeeName: name, totalLateDays: 0, totalEarlyExits: 0, details: [] };
      
      const exception = exceptions.find(ex => {
        if (!isFuzzyMatch(ex.employeeName, name)) return false;
        try {
          const recordStart = startOfDay(record.date);
          const exStart = startOfDay(parseExDate(ex.startDate));
          const exEnd = startOfDay(parseExDate(ex.endDate));
          return isWithinInterval(recordStart, { start: exStart, end: exEnd });
        } catch (e) { return false; }
      });

      const isSaturday = record.date.getDay() === 6;
      // Saturdays ignore exceptions as per user request
      const sEntry = isSaturday ? satSchedule.entry : (exception ? exception.deferredEntryTime : schedule.entry);
      const sExit = isSaturday ? satSchedule.exit : (exception ? exception.deferredExitTime : schedule.exit);

      let lateMin = 0, lateSt: any = 'none';
      if (record.entryTime) {
        let eStr = record.entryTime;
        if (eStr.includes('T')) eStr = format(new Date(eStr), 'HH:mm');
        else if (!eStr.includes(':') && !isNaN(Number(eStr))) {
          const s = Math.round(Number(eStr) * 86400); 
          eStr = `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;
        }
        if (eStr.includes(':')) {
          const [h, m] = eStr.split(':').map(Number);
          const [sh, sm] = sEntry.split(':').map(Number);
          const eD = new Date(2000, 0, 1, h, m), sD = new Date(2000, 0, 1, sh, sm);
            if (isAfter(eD, sD)) {
            lateMin = differenceInMinutes(eD, sD);
            // New logic: 1-5 neutro, 6-10 amarillo, >10 alerta (suave)
            if (lateMin > 20) lateSt = 'red';
            else if (lateMin >= 11) lateSt = 'yellow';
            else if (lateMin >= 1) lateSt = 'neutral';
            else lateSt = 'none';
          }
        }
      }

      let earlyMin = 0, exitSt: any = 'none';
      if (record.exitTime) {
        let exStr = record.exitTime;
        if (exStr.includes('T')) exStr = format(new Date(exStr), 'HH:mm');
        else if (!exStr.includes(':') && !isNaN(Number(exStr))) {
          const s = Math.round(Number(exStr) * 86400); 
          exStr = `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;
        }
        if (exStr.includes(':')) {
          const [h, m] = exStr.split(':').map(Number);
          const [sh, sm] = sExit.split(':').map(Number);
          const eD = new Date(2000, 0, 1, h, m), sD = new Date(2000, 0, 1, sh, sm);
          if (isAfter(sD, eD)) {
            earlyMin = differenceInMinutes(sD, eD);
            if (earlyMin > 20) exitSt = 'red';
            else if (earlyMin >= 11) exitSt = 'yellow';
            else if (earlyMin >= 1) exitSt = 'neutral';
            else exitSt = 'none';
          }
        }
      }

      const isLate = lateSt !== 'none';
      const isEarlyExit = exitSt !== 'none';
      const hasSignificantEvent = isLate || isEarlyExit;

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
      if (filterLateness || filterEarlyExit) {
        shouldInclude = (filterLateness && isLate) || (filterEarlyExit && isEarlyExit);
      } else if (!showAllDays) {
        shouldInclude = hasSignificantEvent;
      }
      
      if (shouldInclude) {
        if (isLate) resultsMap[name].totalLateDays++;
        if (isEarlyExit) resultsMap[name].totalEarlyExits++;
        resultsMap[name].details.push({
          date: record.date, dayName: getSpanishDayAbbr(record.date),
          actualEntry: record.entryTime, actualExit: record.exitTime,
          scheduledEntry: sEntry, scheduledExit: sExit,
          lateMinutes: lateMin, earlyExitMinutes: earlyMin,
          hoursWorked: hoursWorked,
          lateStatus: lateSt, exitStatus: exitSt
        });
      }
    });

    Object.values(resultsMap).forEach(r => r.details.sort((a,b) => compareAsc(a.date, b.date)));
    
    return Object.values(resultsMap)
      .filter(r => matchesFlexible(r.employeeName, searchTerm))
      .sort((a,b) => a.employeeName.localeCompare(b.employeeName));
  }, [data, exceptions, schedule, satSchedule, searchTerm, showAllDays, dateFilterStart, dateFilterEnd, filterLateness, filterEarlyExit]);

  const groupedByWeek = useMemo(() => {
    const allRecords: any[] = [];
    analyzedResults.forEach(worker => {
      worker.details.forEach(detail => {
        allRecords.push({ ...detail, employeeName: worker.employeeName });
      });
    });

    const weeks: Record<string, any[]> = {};
    allRecords.forEach(rec => {
      const start = startOfWeek(rec.date, { weekStartsOn: 1 });
      const end = endOfWeek(rec.date, { weekStartsOn: 1 });
      const key = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`;
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(rec);
    });

    return Object.keys(weeks).sort().map(key => {
      const [startStr, endStr] = key.split('_');
      const startDate = new Date(startStr + 'T00:00:00');
      const endDate = new Date(endStr + 'T00:00:00');
      
      // Compute week number within month
      const weekNum = getWeekOfMonth(startDate, { weekStartsOn: 1 });
      const monthName = format(startDate, 'MMMM', { locale: es });

      return {
        key,
        label: `Semana ${weekNum} de ${monthName} (${format(startDate, 'dd/MM')} al ${format(endDate, 'dd/MM')})`,
        records: weeks[key].sort((a,b) => {
          const dateComp = compareAsc(a.date, b.date);
          if (dateComp !== 0) return dateComp;
          return a.employeeName.localeCompare(b.employeeName);
        })
      };
    });
  }, [analyzedResults]);

  const workerNames = useMemo(() => {
    const names = new Set(data.map(d => d.employeeName));
    return Array.from(names).sort();
  }, [data]);

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
        isFlexible: d.scheduledEntry !== (d.date.getDay() === 6 ? satSchedule.entry : schedule.entry),
        employeeName: worker.employeeName 
      }))
    );

    const totalDays = Math.max(allDays.length, 1);
    const totalWorkersLoaded = Math.max(new Set(data.map(r => r.employeeName)).size, 1);
    
    const lateDaysCount = allDays.filter(d => d.lateMin >= 1).length;
    const earlyExitsCount = allDays.filter(d => d.earlyMin >= 1).length;
    const totalLateMin = allDays.reduce((acc, d) => acc + d.lateMin, 0);
    
    // Total unique employees with flexible schedule defined globally
    const exceptionsUniqueCount = new Set(exceptions.map(e => e.employeeName.trim().toUpperCase())).size;

    return {
      lateDays: lateDaysCount,
      latePct: (lateDaysCount / totalDays) * 100,
      avgLate: lateDaysCount > 0 ? (totalLateMin / lateDaysCount).toFixed(1) : '0',
      avgLatePct: Math.min((Number(lateDaysCount > 0 ? (totalLateMin / lateDaysCount) : 0) / 45) * 100, 100),
      earlyExits: earlyExitsCount,
      earlyExitPct: (earlyExitsCount / totalDays) * 100,
      exceptionsCount: exceptionsUniqueCount,
      exceptionsPct: (exceptionsUniqueCount / totalWorkersLoaded) * 100
    };
  }, [analyzedResults, data, exceptions]);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100 bg-slate-50/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">T</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">TimeTrack Pro</h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Navegación</div>
          <button 
            onClick={() => setActiveTab('report')}
            className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'report' ? "bg-slate-800 text-white font-bold shadow-md shadow-slate-200" : "text-slate-600 hover:bg-slate-50")}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" /> <span className="text-sm">Revisión Diaria</span>
          </button>
          <button 
             onClick={() => setActiveTab('horarios')}
             className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'horarios' ? "bg-slate-800 text-white font-bold shadow-md shadow-slate-200" : "text-slate-600 hover:bg-slate-50")}
          >
            <Clock className="w-5 h-5 shrink-0" /> <span className="text-sm">Jornada Flexible</span>
          </button>
          <button 
             onClick={() => setActiveTab('config')}
             className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all", activeTab === 'config' ? "bg-slate-800 text-white font-bold shadow-md shadow-slate-200" : "text-slate-600 hover:bg-slate-50")}
          >
            <Settings className="w-5 h-5 shrink-0" /> <span className="text-sm">Configuración</span>
          </button>

          <div className="pt-6 space-y-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Horario de Jornada</div>
            <div className="grid grid-cols-1 gap-1.5 px-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Lunes a Viernes</span>
                <span className="text-sm font-black text-slate-500">{schedule.entry} - {schedule.exit}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Sábado</span>
                <span className="text-sm font-black text-slate-500">{satSchedule.entry} - {satSchedule.exit}</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4">
          <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center group transition-colors hover:border-blue-300">
            <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
            <p className="text-[10px] text-slate-500 font-medium mb-2 truncate px-2">{fileName || "Planilla Clock-In"}</p>
            <label className="block px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-semibold hover:bg-blue-700 transition-colors w-full cursor-pointer">
              {fileName ? "Cambiar Archivo" : "Subir Registros"}
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              Gestión de Asistencia — {data.length > 0 ? format(data[0].date, 'MMMM yyyy', { locale: es }) : 'Cargar Reporte'}
            </h2>
            <span className={cn("px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider", data.length > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400")}>
              {data.length > 0 ? "Datos Listos" : "Esperando Excel"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold">Admin RRHH</p>
              <p className="text-xs text-slate-400">TimeTrack Pro v2.1</p>
            </div>
            <div className="w-10 h-10 bg-slate-200 rounded-full border border-slate-300 flex items-center justify-center font-bold text-slate-500">A</div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8 space-y-6 overflow-y-auto">
          {activeTab === 'report' ? (
            <>
              {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="Días con Retraso" value={stats.lateDays} subValue="totales" icon={<Clock className="w-4 h-4" />} percentage={stats.latePct} colorClass="text-[#ffa227]" />
                  <StatCard label="Promedio Retraso" value={stats.avgLate} subValue="minutos" icon={<AlertCircle className="w-4 h-4" />} percentage={stats.avgLatePct} colorClass="text-[#4e63ce]" />
                  <StatCard label="Retiros Anticipados" value={stats.earlyExits} subValue="eventos" icon={<X className="w-4 h-4" />} percentage={stats.earlyExitPct} colorClass="text-[#f44a63]" />
                  <StatCard label="Jornada Flexible" value={stats.exceptionsCount} subValue="funcionarios" icon={<Users className="w-4 h-4" />} percentage={stats.exceptionsPct} colorClass="text-[#37d0d8]" />
                </div>

              {/* Table Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex flex-col gap-5">
                    {/* Fila superior: Búsqueda y Botón */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="relative group flex-1 min-w-[300px]">
                        <input 
                          type="text" 
                          placeholder="Buscar por nombre de trabajador o palabra clave..." 
                          value={searchTerm}
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
                          <LegendItem color="bg-[#37393d]" label="≤ 10m" />
                          <LegendItem color="bg-[#ffa227]" label="11-20m" />
                          <LegendItem color="bg-[#f44a63]" label="> 20m" />
                        </div>
                      </div>
                    </div>

                    {/* Fila inferior: Rango de Fecha e Incidentes */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/60">
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Control de Rango (Siempre visible) */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 ml-1 mb-1">
                             <Clock className="w-3 h-3 text-blue-600" />
                             <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">RANGO</span>
                          </div>
                          <div className="flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl border border-blue-100 shadow-sm">
                            <div className="flex items-center gap-2">
                               <label className="text-[9px] font-black text-slate-400 uppercase">Inicio</label>
                               <input 
                                  type="date" 
                                  value={dateFilterStart}
                                  onChange={(e) => setDateFilterStart(e.target.value)}
                                  className="bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold tabular-nums"
                                />
                            </div>
                            <ArrowRight className="w-4 h-4 text-blue-300" />
                            <div className="flex items-center gap-2">
                               <label className="text-[9px] font-black text-slate-400 uppercase">Fin</label>
                               <input 
                                  type="date" 
                                  value={dateFilterEnd}
                                  onChange={(e) => setDateFilterEnd(e.target.value)}
                                  className="bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold tabular-nums"
                                />
                            </div>
                          </div>
                        </div>

                        {/* Filtros de Incidentes */}
                        <div className="flex items-center gap-5 bg-white px-5 py-2 rounded-2xl border border-slate-200 shadow-sm ml-2">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div 
                              onClick={() => setFilterLateness(!filterLateness)}
                              className={cn(
                                "w-8 h-4 rounded-full relative transition-colors border",
                                filterLateness ? "bg-orange-500 border-orange-500" : "bg-slate-200 border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm",
                                filterLateness ? "left-4.5" : "left-0.5"
                              )} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Atrasos</span>
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
                        </div>
                      </div>
                    </div>
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
                                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">{week.label}</span>
                                </div>
                              </td>
                            </tr>
                            {week.records.map((record, idx) => (
                              <tr key={`${week.key}-${record.employeeName}-${idx}`} className="text-sm hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 font-semibold text-slate-700">{record.employeeName}</td>
                                <td className="px-6 py-3 font-bold text-slate-400 text-[10px]">{record.dayName}</td>
                                <td className="px-6 py-3 text-slate-500 whitespace-nowrap text-center text-xs tracking-tight">{format(record.date, 'dd/MM/yyyy', { locale: es })}</td>
                                <td className="px-6 py-3 text-center font-medium tabular-nums">
                                  {record.actualEntry || '--:--'}
                                </td>
                                <td className="px-6 py-3 text-center font-medium tabular-nums">
                                  {record.actualExit || '--:--'}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {record.lateStatus !== 'none' ? (
                                    <span className={cn("px-2.5 py-1 font-bold rounded-md text-[10px] inline-flex items-center justify-center min-w-[50px] border transition-colors", 
                                      record.lateStatus === 'red' ? "bg-[#f44a63]/10 text-[#f44a63] border-[#f44a63]/20" : 
                                      record.lateStatus === 'yellow' ? "bg-[#ffa227]/10 text-[#ffa227] border-[#ffa227]/20" : 
                                      "bg-slate-100 text-[#37393d] border-slate-200"
                                    )}>
                                      {record.lateMinutes} min
                                    </span>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  {record.exitStatus !== 'none' ? (
                                    <span className={cn("px-2.5 py-1 font-bold rounded-md text-[10px] inline-flex items-center justify-center min-w-[50px] border transition-colors", 
                                      record.exitStatus === 'red' ? "bg-[#f44a63]/10 text-[#f44a63] border-[#f44a63]/20" : 
                                      record.exitStatus === 'yellow' ? "bg-[#ffa227]/10 text-[#ffa227] border-[#ffa227]/20" : 
                                      "bg-slate-100 text-[#37393d] border-slate-200"
                                    )}>
                                      {record.earlyExitMinutes} min
                                    </span>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-6 py-3">
                                  <span className={cn("text-[9px] px-3 py-1 rounded-lg font-black uppercase tracking-tighter border", 
                                    record.scheduledEntry !== (record.date.getDay() === 6 ? satSchedule.entry : schedule.entry)
                                    ? "bg-[#4e63ce]/10 text-[#4e63ce] border-[#4e63ce]/20 shadow-sm" 
                                    : "bg-slate-50 text-slate-300 border-slate-200"
                                  )}>
                                    {record.scheduledEntry !== (record.date.getDay() === 6 ? satSchedule.entry : schedule.entry) ? "Flexible" : "Regular"}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-center text-slate-600 font-medium whitespace-nowrap">
                                  {record.hoursWorked !== null ? `${record.hoursWorked} h` : '-'}
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
          ) : activeTab === 'horarios' ? (
            <div className="space-y-6">
               {/* Entry Form - New Layout */}
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Trabajador</label>
                        <input 
                          type="text" 
                          placeholder="Nombre completo"
                          value={newEx.employeeName}
                          onFocus={() => setShowExFormSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowExFormSuggestions(false), 200)}
                          onChange={(e) => setNewEx({...newEx, employeeName: e.target.value})}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <AnimatePresence>
                          {showExFormSuggestions && exFormSuggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                            >
                              {exFormSuggestions.map((name, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setNewEx({...newEx, employeeName: name});
                                    setShowExFormSuggestions(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-xs font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                                >
                                  {name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Inicio (DD/MM/AAAA)</label>
                        <input 
                          type="text" 
                          placeholder="DD/MM/AAAA"
                          value={newEx.startDate}
                          onChange={(e) => setNewEx({...newEx, startDate: e.target.value})}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Fin (DD/MM/AAAA)</label>
                        <input 
                          type="text" 
                          placeholder="DD/MM/AAAA"
                          value={newEx.endDate}
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
                        onClick={() => {
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
                        }}
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
                      value={exSearchTerm}
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
                                onClick={() => { 
                                  setItemToEdit({
                                    ...ex,
                                    startDate: formatToDMY(ex.startDate),
                                    endDate: formatToDMY(ex.endDate)
                                  }); 
                                  setIsEditModalOpen(true); 
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" /> Modificar
                              </button>
                              <button 
                                onClick={() => { setItemToDelete(ex.id); setIsDeleteModalOpen(true); }}
                                className="flex items-center justify-center p-1.5 text-slate-300 hover:text-red-500 transition-colors"
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
          ) : activeTab === 'config' ? (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <Settings className="w-7 h-7 text-blue-600" />
                      Configuración del Sistema
                    </h2>
                    <p className="text-slate-500 mt-1">Ajusta los parámetros globales de la jornada laboral.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* General Schedule */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-blue-700">
                        <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </div>
                        <h3 className="font-black uppercase tracking-widest text-xs">Jornada General</h3>
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Lun - Vie</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 pt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label>
                        <input 
                          type="time" 
                          value={schedule.entry} 
                          onChange={(e) => setSchedule({...schedule, entry: e.target.value})}
                          className="w-full text-2xl font-bold p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all tabular-nums"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salida</label>
                        <input 
                          type="time" 
                          value={schedule.exit} 
                          onChange={(e) => setSchedule({...schedule, exit: e.target.value})}
                          className="w-full text-2xl font-bold p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Saturday Schedule */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-100/50 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-orange-600">
                        <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </div>
                        <h3 className="font-black uppercase tracking-widest text-xs">Jornada Sábados</h3>
                      </div>
                      <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Sábados</span>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrada</label>
                        <input 
                          type="time" 
                          value={satSchedule.entry} 
                          onChange={(e) => setSatSchedule({...satSchedule, entry: e.target.value})}
                          className="w-full text-2xl font-bold p-4 bg-slate-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl outline-none transition-all tabular-nums"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salida</label>
                        <input 
                          type="time" 
                          value={satSchedule.exit} 
                          onChange={(e) => setSatSchedule({...satSchedule, exit: e.target.value})}
                          className="w-full text-2xl font-bold p-4 bg-slate-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl outline-none transition-all tabular-nums"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                       <Clock className="w-4 h-4 text-orange-500 shrink-0" />
                       <p className="text-[10px] text-orange-700 font-medium leading-relaxed">
                         Los sábados son días de media jornada. Por política de empresa, no se aplican horarios diferidos; todos deben cumplir este horario.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 text-white flex items-center justify-between overflow-hidden relative group">
                  <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Cambios sincronizados</h3>
                      <p className="text-blue-100 text-sm mt-1">Los nuevos horarios se han aplicado a todos los registros del reporte actual.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('report')}
                    className="relative z-10 px-8 py-3 bg-white text-blue-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-xl"
                  >
                    Ver Reporte
                  </button>
                  <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                </div>
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

      {/* Processing Overlay */}
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
                    value={itemToEdit.employeeName}
                    onChange={(e) => setItemToEdit({...itemToEdit, employeeName: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Inicio (DD/MM/AAAA)</label>
                    <input 
                      type="text" 
                      value={itemToEdit.startDate}
                      onChange={(e) => setItemToEdit({...itemToEdit, startDate: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fecha Fin (DD/MM/AAAA)</label>
                    <input 
                      type="text" 
                      value={itemToEdit.endDate}
                      onChange={(e) => setItemToEdit({...itemToEdit, endDate: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Turno Disponible</label>
                    <select 
                      value={`${itemToEdit.deferredEntryTime}-${itemToEdit.deferredExitTime}`}
                      onChange={(e) => {
                        const [entry, exit] = e.target.value.split('-');
                        setItemToEdit({...itemToEdit, deferredEntryTime: entry, deferredExitTime: exit});
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Estás seguro?</h3>
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
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group transition-all"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div 
            className="p-1.5 rounded-lg shrink-0" 
            style={{ 
              backgroundColor: hexValue ? `${hexValue}15` : undefined,
              color: hexValue || undefined
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { className: cn("w-4 h-4", !hexValue && colorClass) })}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        </div>
        <div className="flex items-baseline gap-1 pl-8">
           <span className="text-xl font-black text-slate-800 leading-none">{value}</span>
           <p className="text-[9px] font-bold text-slate-400">{subValue}</p>
        </div>
      </div>
      
      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="5"
            fill="transparent"
            className="text-slate-50"
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            cx="32"
            cy="32"
            r={radius}
            stroke={hexValue || 'currentColor'}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circumference}
            className={!hexValue ? colorClass : ""}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
           <span className="text-[10px] font-bold text-slate-400">{Math.round(percentage)}%</span>
        </div>
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
