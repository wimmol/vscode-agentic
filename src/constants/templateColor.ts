/** Template-colour palette (10 swatches, desaturated).
 *  Shared between extension host (template storage seed) and webview
 *  (swatch picker). Lives in `constants/` so neither side imports across
 *  the build-target boundary. */
export const TEMPLATE_PALETTE = [
  '#8fb4cc', // sky
  '#7fb2a8', // teal
  '#82b199', // sage
  '#9bb47e', // leaf
  '#b0aa7a', // ochre
  '#c8a080', // clay
  '#c28894', // rose
  '#a494bf', // lavender
  '#8b9dc9', // indigo
  '#9098a8', // slate
] as const;

/** Neutral fill used when an agent or chip has no explicit colour. */
export const TEMPLATE_COLOR_FALLBACK = '#9098a8';

/** Assign the Nth palette swatch; wraps after 10. */
export const templateColorByIndex = (index: number): string =>
  TEMPLATE_PALETTE[((index % TEMPLATE_PALETTE.length) + TEMPLATE_PALETTE.length) % TEMPLATE_PALETTE.length];
