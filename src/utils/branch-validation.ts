/**
 * Validates a string as a legal git branch name per git-check-ref-format rules.
 * See: https://git-scm.com/docs/git-check-ref-format
 */
export const isValidBranchName = (name: string): boolean => {
	// Reject empty or whitespace-only
	if (!name || name.trim().length === 0) return false;

	// Cannot start with - or .
	if (name.startsWith("-") || name.startsWith(".")) return false;

	// Cannot end with .lock or /
	if (name.endsWith(".lock") || name.endsWith("/")) return false;

	// Cannot contain: space, ~, ^, :, ?, *, [, \, control chars (0x00-0x1F, 0x7F)
	if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return false;

	// Cannot contain ..
	if (name.includes("..")) return false;

	// Cannot contain @{
	if (name.includes("@{")) return false;

	// Cannot be bare @
	if (name === "@") return false;

	// Cannot contain consecutive slashes
	if (name.includes("//")) return false;

	// No path component can start with .
	if (name.split("/").some((part) => part.startsWith("."))) return false;

	return true;
};
