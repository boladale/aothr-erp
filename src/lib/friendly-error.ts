// Translates raw database / network / edge-function errors into plain English
// explanations that tell the user what actually went wrong and what to do next.

type AnyErr = any;

const PG_CODE_MESSAGES: Record<string, (e: AnyErr) => string> = {
  // unique_violation
  "23505": (e) => {
    const detail = String(e?.details || e?.detail || "");
    const m = detail.match(/Key \((.+?)\)=\((.+?)\)/);
    if (m) {
      return `A record with ${humanizeColumn(m[1])} "${m[2]}" already exists. Use a different value, or open the existing record instead of creating a duplicate.`;
    }
    return "This record already exists. Duplicate values are not allowed for this document number or code.";
  },
  // foreign_key_violation
  "23503": (e) => {
    const detail = String(e?.details || e?.detail || "");
    if (/still referenced/i.test(detail)) {
      return "This record cannot be deleted because other transactions are linked to it. Remove or reassign the linked documents first.";
    }
    return "A linked record you selected no longer exists (it may have been deleted). Refresh the page and pick a valid option.";
  },
  // not_null_violation
  "23502": (e) => {
    const col = e?.column || (String(e?.message || "").match(/column "(.+?)"/) || [])[1];
    return col
      ? `${humanizeColumn(col)} is required and cannot be left blank.`
      : "A required field was left blank. Please complete all mandatory fields.";
  },
  // check_violation
  "23514": () =>
    "One of the values entered breaks a business rule for this record (for example a negative quantity or an invalid date range). Please review the figures and try again.",
  // invalid_text_representation
  "22P02": () =>
    "One of the values entered is in the wrong format (for example text typed into a number or date field). Please correct it and try again.",
  // numeric_value_out_of_range
  "22003": () => "A number entered is too large for this field. Please check the amounts and quantities.",
  // insufficient_privilege / RLS
  "42501": () =>
    "Your account does not have permission to perform this action, or this record belongs to another organisation. Ask an Admin to grant you access.",
  // raised by our own triggers via RAISE EXCEPTION
  P0001: (e) => cleanupPgMessage(e?.message) || "This action was blocked by a business rule.",
  // deadlock / lock timeout
  "40P01": () => "Another user is updating this record right now. Wait a moment and try again.",
  "55P03": () => "This record is locked by another operation in progress. Please retry in a few seconds.",
  PGRST116: () =>
    "The record was not found, or your account is not allowed to see it. Refresh the list and try again.",
  PGRST301: () => "Your session has expired. Please sign out and sign in again.",
};

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [
    /non-2xx status code/i,
    "The server rejected this action but did not return a reason. Refresh the page and try again — if it repeats, the record is probably no longer in a state that allows this action.",
  ],
  [/failed to fetch|networkerror|load failed/i, "Could not reach the server. Check your internet connection and try again."],
  [/jwt (expired|is expired)|token is expired/i, "Your session has expired. Please sign out and sign in again."],
  [/invalid login credentials/i, "The email address or password is incorrect."],
  [/email not confirmed/i, "This email address has not been confirmed yet. Check your inbox for the confirmation link."],
  [/user already registered/i, "An account already exists with this email address. Try signing in instead."],
  [/infinite recursion detected/i, "An access-rule conflict is blocking this record. Please report this to your Administrator — the security policy needs to be corrected."],
  [/violates row-level security/i, "Your account is not allowed to save this record, usually because it belongs to another organisation or you are missing a role."],
  [/duplicate key value/i, "This record already exists — the document number or code is already in use."],
  [/permission denied for (table|relation) (\w+)/i, "Your account does not have access to this data. Ask an Admin to grant you the matching role."],
  [/^unauthorized$/i, "You are not signed in, or your session has expired. Please sign in again."],
  [/^forbidden: missing permission (.+)$/i, "You do not have permission to use this feature. Ask an Admin to give you access."],
  [/fiscal period .*(closed|locked)/i, "The accounting period for this date is closed. Reopen the period or use a date inside an open period."],
  [/not in draft status/i, "This document is no longer a draft, so it cannot be changed or posted again. Refresh the page to see its current status."],
];

function humanizeColumn(col: string) {
  return col
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanupPgMessage(msg?: string) {
  if (!msg) return "";
  return String(msg)
    .replace(/^ERROR:\s*/i, "")
    .replace(/\s*CONTEXT:[\s\S]*$/i, "")
    .trim();
}

/**
 * Convert any thrown error / Supabase error object into a sentence a
 * non-technical user can act on. Never returns a bare code.
 */
export function friendlyError(err: AnyErr, fallback = "The action could not be completed. Please refresh the page and try again."): string {
  if (!err) return fallback;
  if (typeof err === "string") return matchMessage(err) || cleanupPgMessage(err) || fallback;

  const code = String(err.code ?? "");
  if (code && PG_CODE_MESSAGES[code]) return PG_CODE_MESSAGES[code](err);

  const raw = cleanupPgMessage(err.message || err.error_description || err.error || err.hint || err.details);
  const matched = matchMessage(raw);
  if (matched) return matched;

  // Business-rule messages raised by our own triggers are already readable.
  if (raw && raw.length > 3 && !/^[A-Z0-9_]+$/.test(raw)) return raw;

  return fallback;
}

function matchMessage(raw: string): string | null {
  if (!raw) return null;
  for (const [pattern, message] of MESSAGE_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  return null;
}
