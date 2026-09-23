/**
 * Match room code generation and parsing.
 *
 * 4 uppercase characters excluding ambiguous letters and digits:
 * Excludes O, D, 0, I, L, 1, S, 5, B, 8, Z, 2.
 */
const CODE_ALPHABET = 'ACEFGHJKMNPQRTUVWXY34679'
const CODE_LENGTH = 4

/**
 * Generates a 4-character match room code.
 * @returns 4-character code string
 */
export function createMatchCode(): string {
  let code = ''

  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length)

    code += CODE_ALPHABET[index] ?? ''
  }

  return code
}

/**
 * Normalises a typed or pasted code (strips whitespace, converts to uppercase).
 * @param typed - Raw user input
 * @returns Normalised code string
 */
export function normaliseMatchCode(typed: string): string {
  return typed.replace(/\s/gu, '').toUpperCase()
}

/**
 * Validates whether a string matches the room code format and character set.
 * @param normalised - Normalised code string
 * @returns True if valid room code
 */
export function isMatchCode(normalised: string): boolean {
  return normalised.length === CODE_LENGTH
    && [...normalised].every((char) => CODE_ALPHABET.includes(char))
}
