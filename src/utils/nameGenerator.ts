const ADJECTIVES = [
  'cosmic', 'sneaky', 'jolly', 'dizzy', 'fuzzy', 'crafty', 'mighty', 'nimble',
  'brave', 'witty', 'sleepy', 'zany', 'quirky', 'peppy', 'sassy', 'mellow',
  'bold', 'cheeky', 'goofy', 'spunky', 'plucky', 'swift', 'keen', 'dapper',
  'fancy', 'chunky', 'wobbly', 'bubbly', 'snappy', 'zippy', 'bouncy', 'rusty',
  'misty', 'stormy', 'sunny', 'lucky', 'frisky', 'perky', 'savvy', 'tricky',
  'wacky', 'funky', 'groovy', 'jazzy', 'snazzy', 'fierce', 'gentle', 'wild',
];

const ANIMALS = [
  'panda', 'owl', 'penguin', 'fox', 'raccoon', 'otter', 'badger', 'hedgehog',
  'koala', 'lemur', 'sloth', 'walrus', 'platypus', 'axolotl', 'capybara',
  'quokka', 'wombat', 'narwhal', 'flamingo', 'pelican', 'toucan', 'parrot',
  'chameleon', 'gecko', 'pangolin', 'armadillo', 'ocelot', 'lynx', 'wolverine',
  'ferret', 'meerkat', 'chinchilla', 'chipmunk', 'beaver', 'moose', 'tapir',
  'okapi', 'kiwi', 'puffin', 'corgi', 'dingo', 'alpaca', 'llama', 'yak',
  'ibex', 'newt', 'mantis', 'falcon', 'orca', 'raven',
];

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MAX_ATTEMPTS = 200;

/**
 * Generates a unique funny name like "Cosmic Panda".
 * Avoids collisions with `existingNames` (case-insensitive).
 */
export const generateAgentName = (existingNames: string[]): string => {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
    if (!taken.has(name.toLowerCase())) {
      return name;
    }
  }

  // Fallback: append incrementing suffix until unique
  const base = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) {
    suffix++;
  }
  return `${base} ${suffix}`;
};
