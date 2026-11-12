// The name of a person, a coaching, a program or a batch has no symbols: letters of any language (with their marks, like the signs of Hindi),
// digits, spaces, and only a dot, an apostrophe and a hyphen (Md. Sahil, D'Souza, Mary-Ann). The server refuses every other symbol too.
// While somebody types, a symbol (@ # $ % ^ & * ! ...) is simply not accepted.

const NOT_ALLOWED = /[^\p{L}\p{M}0-9 .'’-]/gu;

/** The text without the symbols that a name cannot have. */
export const cleanName = (value: string): string => value.replace(NOT_ALLOWED, '');

/** Is this a good name (no symbol)? */
export const isGoodName = (value: string): boolean => value.trim() === '' || !NOT_ALLOWED.test(value) || ((NOT_ALLOWED.lastIndex = 0), false);
