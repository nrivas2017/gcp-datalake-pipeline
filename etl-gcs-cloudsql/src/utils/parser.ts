import {normalizeSpaces} from './string';

/**
 * Converts strings "Aprobada" / "Rechazada" / "No Aplica" to Boolean.
 * We assume 'Aprobada' = true, everything else = false.
 */
export const statusToBoolean = (status: string | undefined): boolean => {
  return typeof status === 'string'
    ? (normalizeSpaces(status) as string).toLowerCase() === 'aprobada'
    : false;
};

/**
 * Converts a string to a Boolean.
 */
export const stringToBoolean = (value: string | undefined): boolean => {
  return value?.toLowerCase() === 'true';
};
