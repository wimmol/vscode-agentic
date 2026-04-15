/** Strips XML-like tags from text, keeping content between them. */
export const stripXmlTags = (text: string): string =>
  text.replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
