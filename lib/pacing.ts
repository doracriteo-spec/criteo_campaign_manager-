export interface PacingMetrics {
  spendToDate: number;
  budget: number;
  daysElapsed: number;
  totalDays: number;
}

export interface PacingResult {
  pacingPercentage: number;
  expectedPacingPercentage: number;
  health: 'Over' | 'Under' | 'On Track';
  remainingBudget: number;
  remainingDays: number;
  dailyRequiredSpend: number;
  forecastEOM: number;
  variance: number;
}

/**
 * Calculates canonical pacing metrics, mirroring the logic of the workbook.
 */
export function calculatePacing(metrics: PacingMetrics): PacingResult {
  const { spendToDate, budget, daysElapsed, totalDays } = metrics;
  
  const pacingPercentage = budget > 0 ? (spendToDate / budget) * 100 : 0;
  const expectedPacingPercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  
  const remainingBudget = Math.max(0, budget - spendToDate);
  const remainingDays = Math.max(0, totalDays - daysElapsed);
  
  const dailyRequiredSpend = remainingDays > 0 ? remainingBudget / remainingDays : 0;
  
  const currentDailyRunRate = daysElapsed > 0 ? spendToDate / daysElapsed : 0;
  const forecastEOM = spendToDate + (currentDailyRunRate * remainingDays);
  
  const variance = forecastEOM - budget;
  
  let health: 'Over' | 'Under' | 'On Track' = 'On Track';
  
  // Tolerance bounds: e.g. within 5% of expected pacing is On Track.
  const lowerBound = expectedPacingPercentage - 5;
  const upperBound = expectedPacingPercentage + 5;
  
  if (pacingPercentage < lowerBound) {
    health = 'Under';
  } else if (pacingPercentage > upperBound) {
    health = 'Over';
  }
  
  return {
    pacingPercentage,
    expectedPacingPercentage,
    health,
    remainingBudget,
    remainingDays,
    dailyRequiredSpend,
    forecastEOM,
    variance
  };
}

/**
 * Helper to determine total days in the month for pacing calculations.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Helper to determine elapsed days in the month.
 * If the month is in the past, returns total days.
 * If the month is in the future, returns 0.
 */
export function getElapsedDays(year: number, month: number, currentDate: Date = new Date()): number {
  const targetMonth = new Date(year, month - 1); // 0-indexed month
  const nextMonth = new Date(year, month);
  
  if (currentDate >= nextMonth) {
    return getDaysInMonth(year, month);
  } else if (currentDate < targetMonth) {
    return 0;
  }
  
  return currentDate.getDate();
}
