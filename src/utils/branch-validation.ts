/**
 * Validates a git branch name against git check-ref-format rules.
 * See: https://git-scm.com/docs/git-check-ref-format
 *
 * Returns true if the name is a valid git branch name, false otherwise.
 */
export function isValidBranchName(name: string): boolean {
	if (!name || name.trim().length === 0) {
		return false;
	}

	// Cannot start with - or .
	if (name.startsWith("-") || name.startsWith(".")) {
		return false;
	}

	// Cannot end with .lock or /
	if (name.endsWith(".lock") || name.endsWith("/")) {
		return false;
	}

	// Cannot contain: space, ~, ^, :, ?, *, [, \, or ASCII control characters
	if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) {
		return false;
	}

	// Cannot contain ..
	if (name.includes("..")) {
		return false;
	}

	// Cannot contain @{
	if (name.includes("@{")) {
		return false;
	}

	// Cannot be bare @
	if (name === "@") {
		return false;
	}

	// Cannot contain consecutive slashes
	if (name.includes("//")) {
		return false;
	}

	// No path component can start with .
	if (name.split("/").some((part) => part.startsWith("."))) {
		return false;
	}

	return true;
}
