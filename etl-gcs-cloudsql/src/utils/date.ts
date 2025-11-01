/**
 * Parse dates in flexible formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
 * and handle strings with time (e.g. "24-06-2025, 09:21").
 */
export const safeParseDate = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;

  const cleanDateStr = dateString.split(',')[0].trim();

  let parts: string[];

  if (cleanDateStr.includes('/')) {
    parts = cleanDateStr.split('/'); // DD/MM/YYYY
  } else if (cleanDateStr.includes('-')) {
    parts = cleanDateStr.split('-'); // DD-MM-YYYY or YYYY-MM-DD
  } else {
    return null; // Unrecognized format
  }

  try {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const [year, month, day] = parts.map(Number);
      return new Date(year, month - 1, day);
    } else {
      // DD-MM-YYYY o DD/MM/YYYY
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }
  } catch (e) {
    console.warn(`Fecha inválida: '${dateString}'`);
    return null;
  }
};
