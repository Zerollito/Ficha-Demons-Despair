/**
 * Centralized CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) 
 * utility for the Legendarium system.
 */

/**
 * Generates a secure random floating point number between 0 and 1 (exclusive of 1).
 * Replacement for Math.random()
 */
export function secureRandom(): number {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  // Divide by 2^32 to get a number between 0 and 1
  return array[0] / 4294967296;
}

/**
 * Returns a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(secureRandom() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array.
 */
export function randomElement<T>(array: T[]): T {
  if (array.length === 0) return null as any;
  const index = Math.floor(secureRandom() * array.length);
  return array[index];
}

/**
 * Generates a secure random ID string.
 */
export function generateId(length: number = 10): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(randomInt(0, charset.length - 1));
  }
  return result;
}

/**
 * Generates a random invite code.
 */
export function generateInviteCode(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 for clarity
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += charset.charAt(randomInt(0, charset.length - 1));
  }
  return result;
}
