import OpenAI from "openai";
import { getConfig } from "./config";

let _openai: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: getConfig().OPENAI_API_KEY });
  return _openai;
}
export const openai = {
  get chat() {
    return getOpenAI().chat;
  },
};

export const AVAILABLE_MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Best for complex legal analysis and multi-jurisdictional tax questions",
    contextWindow: 128000,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and cost-effective for straightforward legal/tax queries",
    contextWindow: 128000,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "Strong legal reasoning with large document analysis",
    contextWindow: 128000,
  },
  {
    id: "o1-mini",
    name: "o1-mini",
    description: "Deep step-by-step reasoning for complex tax calculations",
    contextWindow: 65536,
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];
