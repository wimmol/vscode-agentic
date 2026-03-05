import { describe, expect, it } from "vitest";
import { isValidBranchName } from "../../src/utils/branch-validation";

describe("isValidBranchName", () => {
	describe("valid branch names", () => {
		it("accepts simple alphanumeric names", () => {
			expect(isValidBranchName("feature-x")).toBe(true);
		});

		it("accepts names with slashes (hierarchical)", () => {
			expect(isValidBranchName("feature/sub")).toBe(true);
		});

		it("accepts names with dots (not leading or double)", () => {
			expect(isValidBranchName("release.1.0")).toBe(true);
		});

		it("accepts names with underscores", () => {
			expect(isValidBranchName("my_branch")).toBe(true);
		});

		it("accepts single character names", () => {
			expect(isValidBranchName("a")).toBe(true);
		});
	});

	describe("empty and whitespace", () => {
		it("rejects empty string", () => {
			expect(isValidBranchName("")).toBe(false);
		});

		it("rejects whitespace-only string", () => {
			expect(isValidBranchName("   ")).toBe(false);
		});

		it("rejects names with spaces", () => {
			expect(isValidBranchName("has space")).toBe(false);
		});
	});

	describe("leading/trailing rules", () => {
		it("rejects names starting with dash", () => {
			expect(isValidBranchName("-leading-dash")).toBe(false);
		});

		it("rejects names starting with dot", () => {
			expect(isValidBranchName(".leading-dot")).toBe(false);
		});

		it("rejects names ending with .lock", () => {
			expect(isValidBranchName("name.lock")).toBe(false);
		});

		it("rejects names ending with slash", () => {
			expect(isValidBranchName("name/")).toBe(false);
		});
	});

	describe("forbidden sequences", () => {
		it("rejects double dots", () => {
			expect(isValidBranchName("has..dots")).toBe(false);
		});

		it("rejects consecutive slashes", () => {
			expect(isValidBranchName("a//b")).toBe(false);
		});

		it("rejects @{ sequence", () => {
			expect(isValidBranchName("has@{at-brace")).toBe(false);
		});

		it("rejects bare @", () => {
			expect(isValidBranchName("@")).toBe(false);
		});
	});

	describe("forbidden characters", () => {
		it("rejects tilde", () => {
			expect(isValidBranchName("has~tilde")).toBe(false);
		});

		it("rejects caret", () => {
			expect(isValidBranchName("has^caret")).toBe(false);
		});

		it("rejects colon", () => {
			expect(isValidBranchName("has:colon")).toBe(false);
		});

		it("rejects question mark", () => {
			expect(isValidBranchName("has?question")).toBe(false);
		});

		it("rejects asterisk", () => {
			expect(isValidBranchName("has*star")).toBe(false);
		});

		it("rejects open bracket", () => {
			expect(isValidBranchName("has[bracket")).toBe(false);
		});

		it("rejects backslash", () => {
			expect(isValidBranchName("has\\backslash")).toBe(false);
		});

		it("rejects control characters", () => {
			expect(isValidBranchName("has\x01ctrl")).toBe(false);
			expect(isValidBranchName("has\x7fDEL")).toBe(false);
			expect(isValidBranchName("has\x00null")).toBe(false);
		});
	});

	describe("path component rules", () => {
		it("rejects component starting with dot after slash", () => {
			expect(isValidBranchName("a/.hidden")).toBe(false);
		});

		it("rejects component starting with dot in nested path", () => {
			expect(isValidBranchName("a/.hidden/b")).toBe(false);
		});
	});
});
