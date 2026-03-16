const DEFAULT_BASE_URL = "https://staging-api.alphahuman.xyz";

export function getEnv(name: string): string | undefined {
  try {
    const g =
      typeof globalThis !== "undefined"
        ? globalThis
        : ((undefined as unknown) as Record<string, unknown>);
    const env = (g as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

export function resolveBaseUrl(explicit?: string): string {
  const baseUrl = explicit ?? getEnv("ALPHAHUMAN_BASE_URL") ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

