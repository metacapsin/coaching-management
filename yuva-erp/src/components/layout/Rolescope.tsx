// Extra numbers added to a student's exam result so the portal can show rank without exposing classmates.
// The server adds them (it never sends classmates' marks), the portal only reads them.
export interface ScopedResult {
  marksObtained: number;
  remarks?: string;
  absent?: boolean;
  rank?: number;
  totalGraded?: number;
  highest?: number;
  average?: number;
}
