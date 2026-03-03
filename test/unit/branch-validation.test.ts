import { describe, expect, it } from "vitest";
import { isValidBranchName } from "../../src/utils/branch-validation.js";

describe("isValidBranchName", () => {
	it("accepts a valid simple name", () => {
		expect(isValidBranchName("feature-x")).toBe(true);
	});

	it("accepts slashes (path-style branches)", () => {
		expect(isValidBranchName("feature/sub")).toBe(true);
	});

	it("rejects empty string", () => {
		expect(isValidBranchName("")).toBe(false);
	});

	it("rejects whitespace-only string", () => {
		expect(isValidBranchName("   ")).toBe(false);
	});

	it("rejects names with spaces", () => {
		expect(isValidBranchName("has space")).toBe(false);
	});

	it("rejects names with double dots", () => {
		expect(isValidBranchName("has..dots")).toBe(false);
	});

	it("rejects names starting with a dash", () => {
		expect(isValidBranchName("-leading-dash")).toBe(false);
	});

	it("rejects names starting with a dot", () => {
		expect(isValidBranchName(".leading-dot")).toBe(false);
	});

	it("rejects names ending with .lock", () => {
		expect(isValidBranchName("name.lock")).toBe(false);
	});

	it("rejects names with tilde", () => {
		expect(isValidBranchName("has~tilde")).toBe(false);
	});

	it("rejects names with caret", () => {
		expect(isValidBranchName("has^caret")).toBe(false);
	});

	it("rejects names with colon", () => {
		expect(isValidBranchName("has:colon")).toBe(false);
	});

	it("rejects names with question mark", () => {
		expect(isValidBranchName("has?question")).toBe(false);
	});

	it("rejects names with asterisk", () => {
		expect(isValidBranchName("has*star")).toBe(false);
	});

	it("rejects names with open bracket", () => {
		expect(isValidBranchName("has[bracket")).toBe(false);
	});

	it("rejects names with backslash", () => {
		expect(isValidBranchName("has\\backslash")).toBe(false);
	});

	it("rejects names with @{ sequence", () => {
		expect(isValidBranchName("has@{at-brace")).toBe(false);
	});

	it("rejects bare @", () => {
		expect(isValidBranchName("@")).toBe(false);
	});

	it("rejects consecutive slashes", () => {
		expect(isValidBranchName("a//b")).toBe(false);
	});

	it("rejects component starting with dot after slash", () => {
		expect(isValidBranchName("a/.hidden")).toBe(false);
	});

	it("rejects names with control characters", () => {
		expect(isValidBranchName("has\x01ctrl")).toBe(false);
		expect(isValidBranchName("has\x7Fdel")).toBe(false);
	});

	it("rejects names ending with a slash", () => {
		expect(isValidBranchName("trailing/")).toBe(false);
	});

	it("accepts @ within a valid name (not bare @)", () => {
		expect(isValidBranchName("user@feature")).toBe(true);
	});

	it("accepts longer path-style names", () => {
		expect(isValidBranchName("fix/issue-123/auth")).toBe(true);
	});
});
