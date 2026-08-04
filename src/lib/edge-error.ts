// Supabase functions.invoke() hides the response body on non-2xx responses and
// only reports "Edge Function returned a non-2xx status code".
// This helper reads the real error message out of the response.
export async function extractEdgeError(error: any, data?: any): Promise<string | null> {
  if (data && typeof data === 'object' && (data as any).error) {
    return String((data as any).error);
  }
  if (!error) return null;

  const res = (error as any)?.context;
  if (res && typeof res.text === 'function') {
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.error) return String(parsed.error);
          if (parsed?.message) return String(parsed.message);
        } catch {
          return raw;
        }
      }
    } catch {
      /* body already consumed */
    }
  }
  return error?.message || 'Request failed';
}

/** Throws an Error carrying the real server-side message, if any. */
export async function throwEdgeError(error: any, data?: any): Promise<void> {
  if (!error && !(data && (data as any).error)) return;
  const msg = await extractEdgeError(error, data);
  throw new Error(msg || 'Request failed');
}
