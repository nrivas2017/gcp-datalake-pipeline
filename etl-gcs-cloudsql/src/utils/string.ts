/**
 * Normalizes spaces in a string by replacing multiple spaces with a single space
 * and trimming leading/trailing spaces. If the input is not a string, it returns
 * the input as is.
 * @param str The input string to normalize.
 * @returns The string with normalized spaces, or the original input if it's not a string.
 */
export const normalizeSpaces = (str: unknown) =>
  typeof str === 'string' ? str.replace(/\s+/g, ' ').trim() : str;
