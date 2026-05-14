export interface AttendanceRecord {
  employeeName: string;
  date: Date;
  entryTime: string | null;
  exitTime: string | null;
  [key: string]: any;
}

export interface Exception {
  id: string;
  employeeName: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string; // ISO format YYYY-MM-DD
  deferredEntryTime: string; // HH:mm
  deferredExitTime: string; // HH:mm
  lastModified?: AuditInfo;
}

export interface DayConfig {
  isTelework: boolean;
  isHybrid: boolean;
  startTime: string; // Office entry
  endTime: string;   // Office exit
}

export interface HybridSchedule {
  id: string;
  employeeName: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string; // ISO format YYYY-MM-DD
  daysConfig: { [key: number]: DayConfig }; // 0-6 (Sunday-Saturday)
  lastModified?: AuditInfo;
}

export interface GeneralException {
  id: string;
  description: string;
  date: string; // ISO format YYYY-MM-DD
  type: IncidentType;
  lastModified?: AuditInfo;
}

export type IncidentType = 'ATRASO' | 'SALIDA ANTICIPADA' | 'AUSENCIA';

export interface ParticularIncident {
  id: string;
  employeeName: string;
  date: string; // ISO format YYYY-MM-DD
  type: IncidentType;
  description: string;
  status: 'ACTIVO' | 'INACTIVO';
  lastModified?: AuditInfo;
}

export interface AnalysisResult {
  employeeName: string;
  totalLateDays: number;
  totalEarlyExits: number;
  details: {
    date: Date;
    dayName: string;
    actualEntry: string | null;
    actualExit: string | null;
    scheduledEntry: string;
    scheduledExit: string;
    lateMinutes: number;
    earlyExitMinutes: number;
    hoursWorked: number | null;
    lateStatus: 'none' | 'neutral' | 'yellow' | 'red' | 'hybrid' | 'justified';
    exitStatus: 'none' | 'neutral' | 'yellow' | 'red' | 'hybrid' | 'justified';
    isMissing?: boolean;
    isJustifiedAbsence?: boolean;
    absenceJustification?: ParticularIncident;
    lateJustification?: ParticularIncident;
    exitJustification?: ParticularIncident;
    isHybrid?: boolean;
  }[];
}

export interface AuditInfo {
  at: number; // timestamp
  byName: string;
  byEmail: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserPermission {
  id: string;
  email: string;
  role: UserRole;
  scope: 'total' | string; // 'total' or specific worker name
}

export interface UploadHistoryItem {
  id: string;
  fileName: string;
  uploadDate: string; // ISO
  dateRange: { start: string; end: string };
  recordCount: number;
  newDates: string[];
  overwrittenDates: string[];
}
