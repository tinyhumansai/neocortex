import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "") + "/";
}

function getSetCookie(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
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

function extractHiddenInputValue(html: string, idOrName: string): string | null {
  const idRe = new RegExp(`id=["']${idOrName}["'][^>]*value=["']([^"']*)["']`, "i");
  const nameRe = new RegExp(`name=["']${idOrName}["'][^>]*value=["']([^"']*)["']`, "i");
  return html.match(idRe)?.[1] ?? html.match(nameRe)?.[1] ?? null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

/**
 * Dev-only probe endpoint to verify eCourts XHR responses are JSON (not HTML).
 * Does NOT solve CAPTCHA; uses a dummy captcha to check response shape.
 */
export async function GET(req: NextRequest) {
  if (getConfig().NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = normalizeBaseUrl(getConfig().ECOURTS_BASE_URL);
  const baseNoSlash = base.replace(/\/+$/, "");
  const cnr = new URL(req.url).searchParams.get("cnr") ?? "DLCT010001232019";

  const entryRes = await fetch(base, {
    method: "GET",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const entryHtml = await entryRes.text();
  const entryCookies = getSetCookie(entryRes);
  const cookieHeader = getCookieHeaderFromSetCookie(entryCookies);
  const appToken = extractHiddenInputValue(entryHtml, "app_token") ?? "";

  const initUrl = `${baseNoSlash}/?p=casestatus/getCaptcha`;
  const initRes = await fetch(initUrl, {
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
  const initText = await initRes.text();

  const searchUrl = `${baseNoSlash}/?p=cnr_status/searchByCNR/`;
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
    body: new URLSearchParams({
      cino: cnr.trim().toUpperCase(),
      fcaptcha_code: "abcdef",
      ajax_req: "true",
      app_token: appToken,
    }),
  });
  const searchText = await searchRes.text();

  let searchJson: unknown = null;
  let searchIsJson = false;
  try {
    searchJson = JSON.parse(searchText);
    searchIsJson = true;
  } catch {
    searchIsJson = false;
  }

  return NextResponse.json({
    base,
    cnr,
    entry: {
      status: entryRes.status,
      setCookieCount: entryCookies.length,
      appTokenLength: appToken.length,
    },
    init: {
      status: initRes.status,
      contentType: initRes.headers.get("content-type"),
      bodyPrefix: initText.slice(0, 140),
    },
    search: {
      status: searchRes.status,
      contentType: searchRes.headers.get("content-type"),
      isJson: searchIsJson,
      bodyPrefix: searchText.slice(0, 140),
      parsed: searchIsJson ? searchJson : null,
    },
  });
}
