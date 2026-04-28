import { INVALID_BRANCH_RE } from '../constants/git';
import { ERR_BRANCH_EMPTY, ERR_BRANCH_INVALID } from '../constants/messages';

/** Produces `<prefix>-1`, `<prefix>-2`, … skipping names already taken. */
export const nextBranchName = (prefix: string, existingBranches: Set<string>): string => {
  let n = 1;
  while (existingBranches.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};

/** Returns a user-facing error string, or undefined if the name is valid. */
export const validateBranchName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return ERR_BRANCH_EMPTY;
  if (INVALID_BRANCH_RE.test(trimmed)) return ERR_BRANCH_INVALID;
  return undefined;
};
