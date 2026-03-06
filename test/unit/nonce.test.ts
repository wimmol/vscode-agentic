import { describe, expect, it } from "vitest";
import { getNonce } from "../../src/utils/nonce";

describe("getNonce", () => {
	it("returns a 32-character string", () => {
		const nonce = getNonce();

		expect(nonce).toHaveLength(32);
	});

	it("returns only alphanumeric characters", () => {
		const nonce = getNonce();

		expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
	});

	it("returns different values on successive calls", () => {
		const nonce1 = getNonce();
		const nonce2 = getNonce();

		expect(nonce1).not.toBe(nonce2);
	});
});
