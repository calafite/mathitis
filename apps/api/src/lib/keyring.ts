export interface SessionSecrets {
  current: string;
  legacy: string[];
}

export function parseKeyring(current: string, keyringEnv: string | undefined): SessionSecrets {
  if (!keyringEnv) return { current, legacy: [] };
  const raw = keyringEnv.trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { current, legacy: parsed.filter((s): s is string => typeof s === 'string') };
    }
  } catch {
    // Not JSON - fall through to comma-separated parsing.
  }
  const legacy = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { current, legacy };
}