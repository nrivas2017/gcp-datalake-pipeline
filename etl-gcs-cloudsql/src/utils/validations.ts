type RutValidationResult = {
  valid: boolean;
  value: string | null;
};

/**
 * Validates a Chilean RUT (Rol Único Tributario) and formats it based on the specified option.
 *
 * This function expects the input RUT to always include the hyphen separating the
 * RUT body from the verification digit. Dots are optional in the input.
 * It cleans the input RUT, validates its structure and its verification digit
 * using the Modulo 11 algorithm.
 *
 * @param rut - The variable to validate, expected to be a string representing a Chilean RUT.
 * It MUST include the hyphen (e.g., "12345678-9" or "12.345.678-K").
 * Dots are optional in the input.
 * @param outputIncludeDots - An optional boolean indicating whether the formatted
 * output RUT should include dots. Defaults to `false` (does not include dots).
 * @returns A `RutValidationResult` object containing:
 * - `valid`: `true` if the RUT is valid, `false` if not.
 * - `value`: The formatted RUT (with or without dots, based on `outputIncludeDots`) if valid,
 * or `null` if the validation fails or the input is not a string or doesn't meet the hyphen requirement.
 *
 * @example
 * // Validate RUT with hyphen, no dots in input, and get it without dots in output
 * const result1 = validateAndFormatRut("12345678-9");
 * console.log(result1); // { valid: true, value: "12345678-9" }
 *
 * @example
 * // Validate RUT with hyphen and dots in input, and get it with dots in output
 * const result2 = validateAndFormatRut("12.345.678-9", true);
 * console.log(result2); // { valid: true, value: "12.345.678-9" }
 *
 * @example
 * // Validate RUT with hyphen and dots in input, and get it without dots in output
 * const result3 = validateAndFormatRut("12.345.678-9", false);
 * console.log(result3); // { valid: true, value: "12345678-9" }
 *
 * @example
 * // Validate an invalid RUT (incorrect verification digit)
 * const result4 = validateAndFormatRut("12.345.678-0");
 * console.log(result4); // { valid: false, value: null }
 *
 * @example
 * // Validate an input that is not a string
 * const result5 = validateAndFormatRut(123456789);
 * console.log(result5); // { valid: false, value: null }
 *
 * @example
 * // Validate an input missing the hyphen (will be invalid)
 * const result6 = validateAndFormatRut("123456789");
 * console.log(result6); // { valid: false, value: null }
 */
export const validateAndFormatRut = (
  rut: unknown,
  outputIncludeDots: boolean = false, // Optional parameter, defaults to false
): RutValidationResult => {
  if (typeof rut !== 'string') {
    return {valid: false, value: null};
  }

  if (!/^(\d{1,3}(?:\.\d{3}){0,2}|\d{7,8})-[0-9K]$/i.test(rut)) {
    return {valid: false, value: null};
  }

  const cleanedRutForValidation = rut
    .replace(/\./g, '')
    .replace(/-/g, '')
    .toUpperCase();

  if (!/^\d{7,8}[0-9K]$/.test(cleanedRutForValidation)) {
    return {valid: false, value: null};
  }

  const rutNumber = cleanedRutForValidation.slice(0, -1);
  const dv = cleanedRutForValidation.slice(-1);

  let sum = 0;
  let multiplier = 2;
  for (let i = rutNumber.length - 1; i >= 0; i--) {
    sum += parseInt(rutNumber[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1; // Cycle multiplier from 2 to 7
  }
  const expectedDv = 11 - (sum % 11);
  const calculatedDv =
    expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);

  if (calculatedDv !== dv) {
    return {valid: false, value: null};
  }

  let formattedRut = '';
  if (outputIncludeDots) {
    for (let i = 0; i < rutNumber.length; i++) {
      formattedRut += rutNumber[i];
      if (
        (rutNumber.length - 1 - i) % 3 === 0 &&
        rutNumber.length - 1 - i !== 0
      ) {
        formattedRut += '.';
      }
    }
  } else {
    formattedRut = rutNumber;
  }
  formattedRut += '-' + dv;

  return {valid: true, value: formattedRut};
};
