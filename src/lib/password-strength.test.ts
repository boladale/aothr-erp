import { describe, it, expect } from "vitest";
import { checkPassword, suggestPassword } from "./password-strength";

describe("password strength", () => {
  it("rejects short or common passwords", () => {
    expect(checkPassword("abc123").ok).toBe(false);
    expect(checkPassword("Password123!").ok).toBe(false);
  });
  it("accepts a long mixed password", () => {
    expect(checkPassword("Harbor-Falcon47-Ember!").ok).toBe(true);
  });
  it("suggested passwords are always strong", () => {
    for (let i = 0; i < 50; i++) expect(checkPassword(suggestPassword()).ok).toBe(true);
  });
});
