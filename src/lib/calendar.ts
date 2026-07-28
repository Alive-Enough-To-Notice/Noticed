export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

// Standard month-grid algorithm: full weeks (Sun-Sat), including the
// leading/trailing days from adjacent months needed to fill the grid.
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);

  const today = new Date();
  const todayKey = dateKey(today);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + i);
    days.push({
      date,
      isCurrentMonth: date.getUTCMonth() === month,
      isToday: dateKey(date) === todayKey,
    });
  }
  return days;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
