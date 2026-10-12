/** "1 part", "2 parts". */
export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
