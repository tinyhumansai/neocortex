import debug from "debug";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getEcourtsCaptchaImage, fetchEcourtsCaseByCnrWithCaptcha } from "../services/ecourts";
import { getRelevantBookChunks, getRelevantCaseChunks } from "../services/bookAbsorption";
import { getCaseByCnrFromChroma } from "../services/caseAbsorption";
import { Case } from "../models";
import { Redis } from "ioredis";
import { getConfig } from "../config";

const log = debug("app:cases:tools");
const PENDING_CAPTCHA_PREFIX = "cases:pending_captcha:";
const PENDING_CAPTCHA_TTL = 300; // 5 min

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(getConfig().REDIS_URL);
  return _redis;
}

export type CaseToolsContext = {
  userId: string;
  conversationId: string;
  pendingCaptcha?: { sessionId: string; cnr: string; captchaText: string };
};

export function getCaptchaTool() {
  return tool(
    async ({ cnr }, config) => {
      log("Tool invoked: get_captcha", {
        cnr,
        conversationId: (config?.configurable as CaseToolsContext)?.conversationId,
      });
      const ctx = config?.configurable as CaseToolsContext | undefined;
      if (!ctx?.userId) throw new Error("Missing user context");
      const normalized = cnr.trim().toUpperCase();
      if (!/^[A-Z0-9]{16}$/.test(normalized)) {
        log("get_captcha: invalid CNR", { cnr: normalized });
        return JSON.stringify({
          error: "Invalid CNR. Must be 16 alphanumeric characters (e.g. DLCT010001232019).",
        });
      }

      const mongoose = (await import("mongoose")).default;
      const existing = (await Case.findOne({
        userId: new mongoose.Types.ObjectId(ctx.userId),
        cnr: normalized,
      }).lean()) as {
        cnr: string;
        caseDetails?: { text?: string; fields?: Record<string, string>; fetchedAt?: string };
      } | null;

      if (existing?.caseDetails) {
        log("get_captcha: case already fetched from MongoDB, returning stored data", {
          cnr: normalized,
        });
        return JSON.stringify({
          success: true,
          cnr: normalized,
          caseDetails: {
            text: (existing.caseDetails.text ?? "").slice(0, 3000),
            fields: existing.caseDetails.fields ?? {},
            fetchedAt: existing.caseDetails.fetchedAt,
          },
          message: `Case ${normalized} was already fetched previously. Details retrieved from stored data — no CAPTCHA needed.`,
        });
      }

      const chromaText = await getCaseByCnrFromChroma(normalized);
      if (chromaText) {
        log("get_captcha: case found in Chroma (ingested), returning", { cnr: normalized });
        return JSON.stringify({
          success: true,
          cnr: normalized,
          caseDetails: {
            text: chromaText.slice(0, 3000),
            fields: {},
            fetchedAt: "from ingested cases",
          },
          message: `Case ${normalized} found in our ingested case database. Details retrieved — no CAPTCHA needed.`,
        });
      }

      log("get_captcha: calling eCourts API getEcourtsCaptchaImage");
      const { sessionId, captchaImage } = await getEcourtsCaptchaImage();
      const key = PENDING_CAPTCHA_PREFIX + ctx.conversationId;
      await getRedis().setex(
        key,
        PENDING_CAPTCHA_TTL,
        JSON.stringify({ sessionId, cnr: normalized })
      );
      log("get_captcha: success", { cnr: normalized, sessionId });
      return JSON.stringify({
        sessionId,
        captchaImage,
        cnr: normalized,
        message: "CAPTCHA_NEEDED",
      });
    },
    {
      name: "get_captcha",
      description:
        "Get a CAPTCHA image and session for fetching a case from eCourts. Call this when the user wants to fetch case details by CNR. The CNR is a 16-character alphanumeric (e.g. DLCT010001232019). Returns the CAPTCHA image URL and stores session. The user must then enter the CAPTCHA characters in their next message.",
      schema: z.object({
        cnr: z.string().describe("The 16-character CNR number (e.g. DLCT010001232019)"),
      }),
    }
  );
}

export function fetchCaseWithCaptchaTool() {
  return tool(
    async ({ captchaText }, config) => {
      log("Tool invoked: fetch_case_with_captcha", {
        captchaTextLen: captchaText?.length,
        hasPendingCaptcha: !!(config?.configurable as CaseToolsContext)?.pendingCaptcha,
      });
      const ctx = config?.configurable as CaseToolsContext | undefined;
      if (!ctx?.userId) throw new Error("Missing user context");
      const pending = ctx.pendingCaptcha;
      if (!pending) {
        log("fetch_case_with_captcha: no pending captcha");
        return JSON.stringify({
          error: "No pending CAPTCHA. Ask the user to get a new CAPTCHA first (fetch case by CNR).",
        });
      }
      const key = PENDING_CAPTCHA_PREFIX + ctx.conversationId;
      await getRedis().del(key);

      const mongoose = (await import("mongoose")).default;

      const existing = (await Case.findOne({
        userId: new mongoose.Types.ObjectId(ctx.userId),
        cnr: pending.cnr,
      }).lean()) as {
        cnr: string;
        caseDetails?: { text?: string; fields?: Record<string, string>; fetchedAt?: string };
      } | null;

      if (existing?.caseDetails) {
        log("fetch_case_with_captcha: returning stored case from MongoDB", { cnr: pending.cnr });
        return JSON.stringify({
          success: true,
          cnr: existing.cnr,
          caseDetails: {
            text: (existing.caseDetails.text ?? "").slice(0, 3000),
            fields: existing.caseDetails.fields ?? {},
            fetchedAt: existing.caseDetails.fetchedAt,
          },
          message: `Case ${existing.cnr} already fetched previously. Details retrieved from stored data.`,
        });
      }

      const chromaText = await getCaseByCnrFromChroma(pending.cnr);
      if (chromaText) {
        log("fetch_case_with_captcha: case found in Chroma (ingested), returning", {
          cnr: pending.cnr,
        });
        return JSON.stringify({
          success: true,
          cnr: pending.cnr,
          caseDetails: {
            text: chromaText.slice(0, 3000),
            fields: {},
            fetchedAt: "from ingested cases",
          },
          message: `Case ${pending.cnr} found in our ingested case database. Details retrieved.`,
        });
      }

      try {
        log("fetch_case_with_captcha: calling eCourts API fetchEcourtsCaseByCnrWithCaptcha", {
          cnr: pending.cnr,
        });
        const result = await fetchEcourtsCaseByCnrWithCaptcha(
          pending.sessionId,
          pending.cnr,
          captchaText.trim()
        );
        await Case.create({
          userId: new mongoose.Types.ObjectId(ctx.userId),
          cnr: result.cnr,
          caseDetails: {
            text: result.text,
            fields: result.fields,
            rawHtml: result.rawHtml,
            fetchedAt: result.fetchedAt,
          },
          conversationId: new mongoose.Types.ObjectId(ctx.conversationId),
        });
        log("fetch_case_with_captcha: success", {
          cnr: result.cnr,
          textLen: result.text?.length ?? 0,
        });
        return JSON.stringify({
          success: true,
          cnr: result.cnr,
          caseDetails: {
            text: result.text.slice(0, 3000),
            fields: result.fields,
            fetchedAt: result.fetchedAt,
          },
          message: `Case ${result.cnr} fetched and saved.`,
        });
      } catch (err) {
        log("fetch_case_with_captcha: error", {
          error: err instanceof Error ? err.message : String(err),
        });
        return JSON.stringify({
          error: err instanceof Error ? err.message : "Failed to fetch case. Try a new CAPTCHA.",
        });
      }
    },
    {
      name: "fetch_case_with_captcha",
      description:
        "Fetch case details from eCourts using the CAPTCHA text the user just entered. Only call this when the user has entered CAPTCHA characters in response to a CAPTCHA image. The session was stored when get_captcha was called.",
      schema: z.object({
        captchaText: z.string().describe("The CAPTCHA characters the user entered"),
      }),
    }
  );
}

export function searchBooksTool() {
  return tool(
    async ({ query }) => {
      log("Tool invoked: search_books (book knowledge)", { query, limit: 10 });
      const chunks = await getRelevantBookChunks(query, 10);
      const used = !!chunks && chunks.trim().length > 0;
      log("search_books: result", {
        query,
        bookKnowledgeUsed: used,
        contentLen: chunks?.length ?? 0,
      });
      if (!chunks) return JSON.stringify({ content: "No book content available." });
      return JSON.stringify({ content: chunks });
    },
    {
      name: "search_books",
      description:
        "Search CA books and ingested legal/tax material for questions about laws, sections, compliance, deductions, GST, income tax, etc. Use when the user asks about legal/tax concepts, code sections, or needs grounding from official sources. Do NOT use for case status or procedural questions.",
      schema: z.object({
        query: z.string().describe("Search query for legal/tax concepts"),
      }),
    }
  );
}

export function searchRelevantCasesTool() {
  return tool(
    async (_, config) => {
      log("Tool invoked: search_relevant_cases", {
        userId: (config?.configurable as CaseToolsContext)?.userId,
      });
      const ctx = config?.configurable as CaseToolsContext | undefined;
      if (!ctx?.userId) throw new Error("Missing user context");
      const mongoose = (await import("mongoose")).default;
      const userCases = await Case.find({ userId: new mongoose.Types.ObjectId(ctx.userId) })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      if (!userCases.length) {
        log("search_relevant_cases: no user cases");
        return JSON.stringify({
          content:
            "You have no fetched cases yet. Fetch a case by CNR first, then I can find similar cases from our case database.",
        });
      }
      const queryParts = userCases.map(
        (c) => `CNR ${c.cnr}: ${(c.caseDetails?.text ?? "").slice(0, 1500)}`
      );
      const query = queryParts.join("\n\n");
      const chunks = await getRelevantCaseChunks(query, 12);
      const used = !!chunks && chunks.trim().length > 0;
      log("search_relevant_cases: result", {
        userCasesCount: userCases.length,
        relevantCasesUsed: used,
        contentLen: chunks?.length ?? 0,
      });
      if (!chunks) {
        return JSON.stringify({
          content:
            "No similar cases found in our case database. Try fetching your case first if you haven't.",
        });
      }
      return JSON.stringify({ content: chunks });
    },
    {
      name: "search_relevant_cases",
      description:
        "Find cases from our ingested case database that are similar or relevant to the user's fetched cases. Use when the user asks for 'relevant cases', 'similar cases', 'cases like mine', 'precedents for my case', or wants to compare their case with others. Requires the user to have at least one fetched case.",
      schema: z.object({}),
    }
  );
}

export function getUserCasesTool() {
  return tool(
    async (_, config) => {
      log("Tool invoked: get_user_cases", {
        userId: (config?.configurable as CaseToolsContext)?.userId,
      });
      const ctx = config?.configurable as CaseToolsContext | undefined;
      if (!ctx?.userId) throw new Error("Missing user context");
      const mongoose = (await import("mongoose")).default;
      const cases = await Case.find({ userId: new mongoose.Types.ObjectId(ctx.userId) })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      const list = cases.map((c) => ({
        cnr: c.cnr,
        fetchedAt: c.caseDetails?.fetchedAt,
        textPreview: (c.caseDetails?.text ?? "").slice(0, 200),
      }));
      log("get_user_cases: result", { count: list.length });
      return JSON.stringify({ cases: list });
    },
    {
      name: "get_user_cases",
      description:
        "List cases the user has previously fetched. Use when the user asks about 'my cases', 'cases I fetched', 'previous cases', or 'case from last week'.",
      schema: z.object({}),
    }
  );
}

export function createCaseTools(ctx: CaseToolsContext) {
  return [
    getCaptchaTool(),
    fetchCaseWithCaptchaTool(),
    searchBooksTool(),
    searchRelevantCasesTool(),
    getUserCasesTool(),
  ];
}
