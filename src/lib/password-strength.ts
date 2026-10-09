export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tips: string[]; ok: boolean };

const COMMON = ["password", "123456", "qwerty", "admin", "welcome", "letmein", "abc123", "iloveyou", "monkey", "lagos", "nigeria", "aothr"];

/** Score a password 0–4. ok = strong enough to accept (score >= 3). */
export function checkPassword(pw: string): Strength {
  const tips: string[] = [];
  let score = 0;
  if (pw.length >= 8) score++; else tips.push("Use at least 8 characters (12+ is better).");
  if (pw.length >= 12) score++;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds >= 3) score++;
  if (kinds === 4) score++;
  if (!/[A-Z]/.test(pw)) tips.push("Add a capital letter.");
  if (!/[0-9]/.test(pw)) tips.push("Add a number.");
  if (!/[^A-Za-z0-9]/.test(pw)) tips.push("Add a symbol such as ! # or @.");
  const lower = pw.toLowerCase();
  if (COMMON.some((w) => lower.includes(w)) || /(.)\1{2,}/.test(pw) || /(0123|1234|2345|3456|4567|5678|6789|abcd)/i.test(pw)) {
    score = Math.min(score, 1);
    tips.unshift("Avoid common words, repeated or sequential characters.");
  }
  if (pw.length < 8) score = Math.min(score, 1);
  const s = Math.max(0, Math.min(4, score)) as Strength["score"];
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][s];
  return { score: s, label, tips, ok: s >= 3 };
}

/** Generate a strong, readable password like "Mango-River7-Cloud!Tiger". */
export function suggestPassword(): string {
  const words = ["Mango", "River", "Cloud", "Tiger", "Planet", "Silver", "Harbor", "Falcon", "Copper", "Garden", "Rocket", "Meadow", "Canyon", "Pepper", "Violet", "Orbit", "Ember", "Lotus", "Summit", "Breeze"];
  const syms = "!#@$%&*?";
  const r = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const parts = Array.from({ length: 3 }, () => words[r(words.length)]);
  return `${parts[0]}-${parts[1]}${r(90) + 10}-${parts[2]}${syms[r(syms.length)]}`;
}
