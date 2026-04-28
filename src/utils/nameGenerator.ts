const NAMES = [
  'Alice', 'James', 'Nora', 'Max', 'Clara', 'Leo', 'Ivy', 'Oscar',
  'Ruby', 'Finn', 'Ada', 'Hugo', 'Mila', 'Noah', 'Zara', 'Owen',
  'Luna', 'Eli', 'Rosa', 'Sam', 'Iris', 'Axel', 'Mia', 'Cole',
  'Eva', 'Liam', 'Aria', 'Seth', 'Ava', 'Dean', 'Lily', 'Jack',
  'Cora', 'Ben', 'Nina', 'Rex', 'Tara', 'Ian', 'Vera', 'Kurt',
];

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MAX_ATTEMPTS = 40;

/**
 * Generates a unique short human name (under 6 letters, capitalized).
 * Avoids collisions with `existingNames` (case-insensitive).
 */
export const generateAgentName = (existingNames: string[]): string => {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));

  // If every bare name is taken, don't burn cycles guessing — go straight to
  // the suffix fallback.
  if (taken.size < NAMES.length) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const name = pick(NAMES);
      if (!taken.has(name.toLowerCase())) return name;
    }
  }

  const base = pick(NAMES);
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix++;
  return `${base} ${suffix}`;
};
