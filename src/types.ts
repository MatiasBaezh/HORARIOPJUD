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
    lateStatus: 'none' | 'yellow' | 'orange' | 'red';
    exitStatus: 'none' | 'yellow' | 'orange' | 'red';
  }[];
}
