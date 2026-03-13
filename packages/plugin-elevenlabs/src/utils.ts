import { SaveMemoryRequest, RecallMemoryRequest } from "./types";

/**
 * Default namespace strategy:
 * 1. explicit namespace
 * 2. user-ID
 * 3. conversation-ID
 * 4. phone-number
 */
export const defaultNamespaceStrategy = (input: {
  userId?: string;
  conversationId?: string;
  phoneNumber?: string;
  explicitNamespace?: string;
}) => {
  if (input.explicitNamespace?.trim()) return input.explicitNamespace.trim();
  if (input.userId?.trim()) return `user-${input.userId.trim()}`;
  if (input.conversationId?.trim()) return `conv-${input.conversationId.trim()}`;
  if (input.phoneNumber?.trim()) return `phone-${input.phoneNumber.trim()}`;
  return "default";
};

/**
 * Schemas for ElevenLabs Client Tools.
 * Use these with Conversation.startSession clientTools definition.
 */
export const NEOCORTEX_CLIENT_TOOL_SCHEMAS = {
  addMemories: {
    name: "addMemories",
    description: "Stores important facts, preferences, and context for future conversations.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The fact or preference to remember." },
      },
      required: ["message"],
    },
  },
  retrieveMemories: {
    name: "retrieveMemories",
    description: "Recalls relevant information from past conversations.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The query to search for in past memories." },
      },
      required: ["message"],
    },
  },
};

/**
 * Recommended system prompt addition for ElevenLabs agents.
 */
export const NEOCORTEX_SYSTEM_PROMPT_ADDON = `
You have access to memory tools to store and recall information across conversations.
- Use addMemories to store user preferences, facts about the user, or important context.
- Use retrieveMemories to check if you have existing information that would help answer the user's request.
Always check memory when the user asks about personal details or past shared information.
`.trim();

/**
 * Production utility to help patch an ElevenLabs agent with Neocortex tools.
 * Requires ELEVENLABS_API_KEY.
 */
export async function enableNeocortexOnAgent(params: {
  apiKey: string;
  agentId: string;
  baseUrl?: string;
}): Promise<{ toolIds: string[] }> {
  const { apiKey, agentId, baseUrl = "https://api.elevenlabs.io" } = params;

  const headers = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };

  const toolIds: string[] = [];

  // 1. Create tools
  for (const tool of Object.values(NEOCORTEX_CLIENT_TOOL_SCHEMAS)) {
    const res = await fetch(`${baseUrl}/v1/convai/tools`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool_config: {
          type: "client",
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          expect_response: true,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      toolIds.push(data.id);
    }
  }

  // 2. Patch agent
  const agentRes = await fetch(`${baseUrl}/v1/convai/agents/${agentId}`, { headers });
  if (agentRes.ok) {
    const agent = await agentRes.json();
    const prompt = agent.conversation_config?.agent?.prompt?.prompt || "";

    await fetch(`${baseUrl}/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        conversation_config: {
          ...agent.conversation_config,
          agent: {
            ...agent.conversation_config?.agent,
            prompt: {
              ...agent.conversation_config?.agent?.prompt,
              prompt: prompt.includes("Neocortex") ? prompt : `${prompt}\n\n${NEOCORTEX_SYSTEM_PROMPT_ADDON}`,
              tool_ids: [...new Set([...(agent.conversation_config?.agent?.prompt?.tool_ids || []), ...toolIds])],
            },
          },
        },
      }),
    });
  }

  return { toolIds };
}
