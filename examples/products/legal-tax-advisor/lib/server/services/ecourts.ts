import { load } from "cheerio";
import { Redis } from "ioredis";
import { getConfig } from "../config";
import { randomBytes } from "crypto";

export type EcourtsCaseDetails = {
  cnr: string;
  fetchedAt: string;
  /** Raw HTML returned by eCourts (usually a full case status page fragment). */
  rawHtml: string;
  /** Extracted text (best-effort) for LLM consumption. */
  text: string;
  /** Best-effort structured fields extracted from the HTML. */
  fields: Record<string, string>;
};

const ECOURTS_SESSION_PREFIX = "ecourts:session:";
const ECOURTS_SESSION_TTL = 300; // 5 minutes

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(getConfig().REDIS_URL);
  return _redis;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "") + "/";
}

function getCookieHeaderFromSetCookie(setCookies: string[]): string {
  const parts = setCookies.map((c) => c.split(";")[0]?.trim()).filter(Boolean) as string[];
  const byName = new Map<string, string>();
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    byName.set(p.slice(0, eq), p);
  }
  return Array.from(byName.values()).join("; ");
}

function getSetCookie(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCaseHtml(html: string): { text: string; fields: Record<string, string> } {
  const $ = load(html);
  const text = $("body")
    .text()
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // Best-effort: extract key/value pairs from tables.
  const fields: Record<string, string> = {};
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td,th")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim());
    if (cells.length >= 2) {
      const k = cells[0];
      const v = cells[1];
      if (k && v && k.length <= 80 && v.length <= 500 && !fields[k]) fields[k] = v;
    }
  });

  return { text, fields };
}

function validateCnr(cnrRaw: string): string {
  const cnr = cnrRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cnr)) {
    throw new Error("Invalid CNR number (expected 16 alphanumeric characters)");
  }
  return cnr;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function extractHiddenInputValue(html: string, idOrName: string): string | null {
  const idRe = new RegExp(`id=["']${idOrName}["'][^>]*value=["']([^"']+)["']`, "i");
  const nameRe = new RegExp(`name=["']${idOrName}["'][^>]*value=["']([^"']+)["']`, "i");
  return html.match(idRe)?.[1] ?? html.match(nameRe)?.[1] ?? null;
}

type EcourtsSessionState = {
  cookieHeader: string;
  appToken: string;
};

function parseUpdatedAppTokenFromResponseText(text: string): string | null {
  // Some responses include token separated by '#####'
  const parts = text.split("#####");
  if (parts.length >= 2 && parts[1]) return parts[1].trim() || null;

  // Some responses include JSON-ish `"app_token":"..."}`
  const m = text.match(/"app_token"\s*:\s*"([^"]+)"/i);
  return m?.[1]?.trim() || null;
}

/**
 * Get a fresh eCourts CAPTCHA image and store session cookies in Redis.
 * Returns sessionId and image as data URL so the user can solve it manually.
 */
export async function getEcourtsCaptchaImage(): Promise<{
  sessionId: string;
  captchaImage: string;
}> {
  const base = normalizeBaseUrl(getConfig().ECOURTS_BASE_URL);
  const baseNoSlash = base.replace(/\/+$/, "");

  const entryRes = await fetch(base, {
    method: "GET",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const entryCookies = getSetCookie(entryRes);
  const cookieHeader = getCookieHeaderFromSetCookie(entryCookies);
  const entryHtml = await entryRes.text();
  // eCourts renders app_token as an empty hidden input initially and may update it via subsequent responses.
  const appToken = extractHiddenInputValue(entryHtml, "app_token") ?? "";

  // The site refresh flow first hits this endpoint, then loads the image.
  // This often initializes/rotates the captcha session server-side.
  const getCaptchaUrl = `${baseNoSlash}/?p=casestatus/getCaptcha`;
  const getCaptchaRes = await fetch(getCaptchaUrl, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      Referer: base,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": UA,
    },
    body: new URLSearchParams({ ajax_req: "true", app_token: appToken }),
  });
  const getCaptchaCookies = getSetCookie(getCaptchaRes);
  const mergedAfterInit = getCookieHeaderFromSetCookie([...entryCookies, ...getCaptchaCookies]);

  const initBody = await getCaptchaRes.text();
  const updatedToken = parseUpdatedAppTokenFromResponseText(initBody);
  const finalAppToken = updatedToken ?? appToken;

  // `securimage_show.php` only needs the correct session cookies.
  const captchaUrl = `${base}vendor/securimage/securimage_show.php?${Math.random()}`;
  const captchaRes = await fetch(captchaUrl, {
    method: "GET",
    headers: {
      Cookie: mergedAfterInit,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: base,
      "User-Agent": UA,
    },
  });
  // Some deployments set/refresh cookies on the CAPTCHA request. Preserve them for the subsequent POST.
  const captchaCookies = getSetCookie(captchaRes);
  const mergedCookieHeader = getCookieHeaderFromSetCookie([
    ...entryCookies,
    ...getCaptchaCookies,
    ...captchaCookies,
  ]);

  const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
  const captchaB64 = captchaBuf.toString("base64");
  const sessionId = randomBytes(16).toString("hex");
  const key = ECOURTS_SESSION_PREFIX + sessionId;
  const state: EcourtsSessionState = { cookieHeader: mergedCookieHeader, appToken: finalAppToken };
  await getRedis().setex(key, ECOURTS_SESSION_TTL, JSON.stringify(state));

  return {
    sessionId,
    captchaImage: `data:image/png;base64,${captchaB64}`,
  };
}

/**
 * Fetch case details from eCourts using a session (from getEcourtsCaptchaImage) and user-entered CAPTCHA text.
 */
export async function fetchEcourtsCaseByCnrWithCaptcha(
  sessionId: string,
  cnrRaw: string,
  captchaText: string
): Promise<EcourtsCaseDetails> {
  const cnr = validateCnr(cnrRaw);
  const base = normalizeBaseUrl(getConfig().ECOURTS_BASE_URL);
  const baseNoSlash = base.replace(/\/+$/, "");
  const key = ECOURTS_SESSION_PREFIX + sessionId;
  const rawState = await getRedis().get(key);
  if (!rawState) throw new Error("CAPTCHA session expired. Please get a new CAPTCHA.");
  await getRedis().del(key);

  // Support both JSON session { cookieHeader, appToken } and legacy plain cookie string
  let cookieHeader: string;
  let appToken = "";
  try {
    const parsed = JSON.parse(rawState) as EcourtsSessionState;
    if (parsed && typeof parsed.cookieHeader === "string" && parsed.cookieHeader) {
      cookieHeader = parsed.cookieHeader;
      appToken = typeof parsed.appToken === "string" ? parsed.appToken : "";
    } else {
      throw new Error("Missing cookieHeader");
    }
  } catch {
    // Legacy: value was stored as plain cookie string
    if (rawState && rawState.length > 0 && !rawState.startsWith("{")) {
      cookieHeader = rawState;
    } else {
      throw new Error("CAPTCHA session is invalid. Please get a new CAPTCHA.");
    }
  }

  const code = String(captchaText ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "");
  if (!code) throw new Error("Please enter the CAPTCHA characters.");

  // The actual XHR endpoint includes the `?p=` query parameter.
  const searchUrl = `${baseNoSlash}/?p=cnr_status/searchByCNR/`;
  const body = new URLSearchParams({
    cino: cnr,
    fcaptcha_code: code,
    ajax_req: "true",
    app_token: appToken,
  });
  const searchRes = await fetch(searchUrl, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      Referer: base,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": UA,
    },
    body,
  });

  const rawBody = await searchRes.text();
  type EcourtsSearchResponse = {
    status?: number;
    casetype_list?: string;
    div_captcha?: string;
    error?: string;
    errorMsg?: string;
    message?: string;
  };
  let json: EcourtsSearchResponse | null = null;
  try {
    json = rawBody ? (JSON.parse(rawBody) as EcourtsSearchResponse) : null;
  } catch {
    // eCourts often returns HTML when CAPTCHA is wrong or session is invalid
    const isHtml = /<\s*html|<\s*!DOCTYPE|<\s*div\s/i.test(rawBody);
    throw new Error(
      isHtml
        ? 'eCourts returned a page instead of case data. The CAPTCHA may be wrong or expired — try "Get new CAPTCHA", enter the characters carefully, and fetch again.'
        : "Failed to parse eCourts response. Try a new CAPTCHA and ensure the CNR is correct."
    );
  }
  if (!json) throw new Error("Empty response from eCourts. Try a new CAPTCHA.");
  if (json.status !== 1 || !json.casetype_list) {
    throw new Error(
      json.errorMsg ||
        json.error ||
        json.message ||
        "eCourts lookup failed (wrong CAPTCHA or invalid CNR). Try a new CAPTCHA."
    );
  }

  const rawHtml = String(json.casetype_list);
  const { text, fields } = parseCaseHtml(rawHtml);

  return {
    cnr,
    fetchedAt: new Date().toISOString(),
    rawHtml,
    text,
    fields,
  };
}
