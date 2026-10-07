export function getCorsAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV === 'production' && (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS === '*')) {
    throw new Error('FATAL ERROR: ALLOWED_ORIGINS must be set to specific origins in production to prevent overly permissive CORS.');
  }

  const allowedOriginsRaw = env.ALLOWED_ORIGINS || '';
  const defaultNonProdOrigins = ['http://localhost:3000', 'http://localhost:4000'];

  if (!allowedOriginsRaw || allowedOriginsRaw === '*') {
    return defaultNonProdOrigins;
  }

  const parts = allowedOriginsRaw.split(',');
  const origins: string[] = [];
  // ⚡ Bolt: Consolidated mapping and filtering into a single loop to avoid intermediate array allocations (O(N) overhead reduction)
  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim();
    if (trimmed) {
      try {
        origins.push(new URL(trimmed).origin);
      } catch {
        throw new Error(`Invalid origin in ALLOWED_ORIGINS: ${trimmed}`);
      }
    }
  }

  return origins.length > 0 ? origins : defaultNonProdOrigins;
}
