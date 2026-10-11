const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Calendar date `YYYY-MM-DD` in India Standard Time (UTC+5:30). */
export const getCalendarDateInIst = (instant: Date = new Date()): string => {
  const ist = new Date(instant.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Previous calendar day for a `YYYY-MM-DD` string. */
export const getPreviousCalendarDate = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
};
