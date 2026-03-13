import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type ProviderAuthResult = {
    profiles: Array<{
        profileId: string;
        credential: { type: 'api_key'; provider: string; key: string };
    }>;
    configPatch?: unknown;
    defaultModel?: string;
    notes?: string[];
};
type ProviderAuthContext = {
    prompter: {
        text: (p: { message: string; validate?: (v: string) => string | undefined }) => Promise<string>;
    };
};
type PluginLogger = {
    info: (m: string) => void;
    warn: (m: string) => void;
    error: (m: string) => void;
};
type OpenClawPluginApi = {
    pluginConfig?: Record<string, unknown>;
    logger: PluginLogger;
    registerProvider: (p: {
        id: string;
        label: string;
        docsPath?: string;
        aliases?: string[];
        envVars?: string[];
        models?: unknown;
        auth: Array<{
            id: string;
            label: string;
            hint?: string;
            kind: 'api_key';
            run: (ctx: ProviderAuthContext) => Promise<ProviderAuthResult>;
        }>;
    }) => void;
    registerService: (s: {
        id: string;
        start: (ctx: { workspaceDir?: string; stateDir: string }) => Promise<void> | void;
    }) => void;
    on: (
        hook: 'agent_end',
        handler: (
            event: { success: boolean; error?: string; durationMs?: number },
            ctx: { agentId?: string; workspaceDir?: string }
        ) => Promise<void> | void
    ) => void;
};

const DEFAULTS = {
    providerId: 'alphahuman',
    providerLabel: 'Alphahuman',
    providerAlias: 'being-alphahuman',
    docsPath: '/providers/models',
    baseUrl: 'http://localhost:3000/openai/v1',
    apiKeyEnvVar: 'ALPHAHUMAN_API_KEY',
    modelId: 'neocortex-mk1',
    modelName: 'Neocortex MK1',
    memorySyncEnabled: true,
    memorySyncPath: '/memory/sync',
    memorySyncApiKeyEnvVar: 'ALPHAHUMAN_API_KEY',
    memorySyncTimeoutMs: 15000,
} as const;

type Config = {
    baseUrl: string;
    apiKeyEnvVar: string;
    modelId: string;
    modelName: string;
    memorySyncEnabled: boolean;
    memorySyncUrl: string;
    memorySyncApiKeyEnvVar: string;
    memorySyncApiKey?: string;
    memorySyncTimeoutMs: number;
    workspaceId?: string;
};
type SyncState = { version: 1; files: Record<string, { hash: string; timestamp: string }> };

const trim = (s: string): string => s.trim().replace(/\/+$/, '');
const normalizeBaseUrl = (s: string): string => {
    const cleaned = trim(s);
    return cleaned.endsWith('/openai') ? `${cleaned}/v1` : cleaned;
};
const hashOf = (s: string): string => createHash('sha256').update(s).digest('hex');
const stateFileName = 'memory-sync-index.json';

const defaultWorkspaceDir = (): string => {
    const env = process.env.OPENCLAW_WORKSPACE_DIR;
    if (env && env.trim()) return path.resolve(env.trim());
    return path.join(os.homedir(), '.openclaw', 'workspace');
};

function readConfig(input: unknown): Config {
    const raw =
        input && typeof input === 'object' && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : {};
    const baseUrl = normalizeBaseUrl(
        typeof raw.baseUrl === 'string' && raw.baseUrl.trim() !== '' ? raw.baseUrl : DEFAULTS.baseUrl
    );
    const modelRoot = baseUrl.endsWith('/openai/v1') ? baseUrl.slice(0, -3) : baseUrl;
    const serverOrigin = modelRoot.endsWith('/openai') ? modelRoot.slice(0, -7) : modelRoot;
    return {
        baseUrl,
        apiKeyEnvVar: typeof raw.apiKeyEnvVar === 'string' ? raw.apiKeyEnvVar : DEFAULTS.apiKeyEnvVar,
        modelId: typeof raw.modelId === 'string' ? raw.modelId : DEFAULTS.modelId,
        modelName: typeof raw.modelName === 'string' ? raw.modelName : DEFAULTS.modelName,
        memorySyncEnabled:
            typeof raw.memorySyncEnabled === 'boolean'
                ? raw.memorySyncEnabled
                : DEFAULTS.memorySyncEnabled,
        memorySyncUrl:
            typeof raw.memorySyncUrl === 'string' && raw.memorySyncUrl.trim() !== ''
                ? trim(raw.memorySyncUrl)
                : `${serverOrigin}${DEFAULTS.memorySyncPath}`,
        memorySyncApiKeyEnvVar:
            typeof raw.memorySyncApiKeyEnvVar === 'string'
                ? raw.memorySyncApiKeyEnvVar
                : DEFAULTS.memorySyncApiKeyEnvVar,
        memorySyncApiKey: typeof raw.memorySyncApiKey === 'string' ? raw.memorySyncApiKey : undefined,
        memorySyncTimeoutMs:
            typeof raw.memorySyncTimeoutMs === 'number' && raw.memorySyncTimeoutMs > 0
                ? Math.floor(raw.memorySyncTimeoutMs)
                : DEFAULTS.memorySyncTimeoutMs,
        workspaceId:
            typeof raw.workspaceId === 'string' && raw.workspaceId.trim()
                ? raw.workspaceId.trim()
                : undefined,
    };
}

async function discoverMemoryFiles(workspaceDir: string): Promise<string[]> {
    const out: string[] = [];
    const root = path.join(workspaceDir, 'MEMORY.md');
    try {
        await fs.access(root);
        out.push(root);
    } catch {
        // file does not exist, skip
    }
    const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
        }
    };
    const memoryDir = path.join(workspaceDir, 'memory');
    try {
        await fs.access(memoryDir);
        await walk(memoryDir);
    } catch {
        // directory does not exist, skip
    }
    return out.sort((a, b) => a.localeCompare(b));
}

const loadState = async (filePath: string): Promise<SyncState> => {
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Partial<SyncState>;
        return parsed.version === 1 && parsed.files
            ? { version: 1, files: parsed.files }
            : { version: 1, files: {} };
    } catch {
        return { version: 1, files: {} };
    }
};

const saveState = async (filePath: string, state: SyncState): Promise<void> => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
};

const plugin = {
    id: 'openclaw-model-provider',
    name: 'Alphahuman Model Provider',
    description: 'Registers Alphahuman model provider and syncs OpenClaw memory to backend',
    configSchema: { parse: readConfig } as const,
    register(api: OpenClawPluginApi) {
        const cfg = readConfig(api.pluginConfig);
        let workspaceDir = '';
        let statePath = '';
        let queue: Promise<void> = Promise.resolve();

        const syncMemory = (
            source: 'startup' | 'agent_end',
            agentId?: string,
            workspaceOverride?: string
        ): void => {
            queue = queue
                .then(async () => {
                    if (!cfg.memorySyncEnabled) return;
                    const ws =
                        (workspaceOverride && workspaceOverride.trim()) ||
                        (workspaceDir && workspaceDir.trim()) ||
                        defaultWorkspaceDir();
                    if (
                        !(workspaceOverride && workspaceOverride.trim()) &&
                        !(workspaceDir && workspaceDir.trim())
                    ) {
                        api.logger.info(
                            `[openclaw-model-provider] Using default workspace for memory sync: ${ws}`
                        );
                    }
                    const files = await discoverMemoryFiles(ws);
                    const prev = statePath ? await loadState(statePath) : { version: 1 as const, files: {} };
                    const next: SyncState['files'] = {};
                    const changed: Array<{
                        filePath: string;
                        content: string;
                        timestamp: string;
                        hash: string;
                    }> = [];
                    for (const file of files) {
                        const rel = path.relative(ws, file).split(path.sep).join('/');
                        const content = await fs.readFile(file, 'utf8');
                        const timestamp = (await fs.stat(file)).mtime.toISOString();
                        const hash = hashOf(content);
                        next[rel] = { hash, timestamp };
                        if (!prev.files[rel] || prev.files[rel].hash !== hash)
                            changed.push({ filePath: rel, content, timestamp, hash });
                    }
                    const deletedFiles = Object.keys(prev.files).filter(k => !(k in next));
                    if (deletedFiles.length > 0) {
                        api.logger.info(
                            `[openclaw-model-provider] Detected ${deletedFiles.length} deleted memory file(s): ${deletedFiles.join(', ')}`
                        );
                    }
                    if (changed.length === 0) {
                        if (statePath) await saveState(statePath, { version: 1, files: next });
                        if (files.length === 0 && deletedFiles.length === 0) {
                            api.logger.info(
                                '[openclaw-model-provider] No memory files found (add MEMORY.md or memory/*.md in workspace)'
                            );
                        }
                        return;
                    }

                    const apiKey =
                        cfg.memorySyncApiKey ??
                        process.env[cfg.memorySyncApiKeyEnvVar] ??
                        process.env[cfg.apiKeyEnvVar];
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), cfg.memorySyncTimeoutMs);
                    try {
                        const response = await fetch(cfg.memorySyncUrl, {
                            method: 'POST',
                            headers: {
                                'content-type': 'application/json',
                                ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
                            },
                            body: JSON.stringify({
                                workspaceId: cfg.workspaceId ?? path.basename(ws),
                                agentId: agentId ?? 'unknown',
                                source,
                                files: changed,
                            }),
                            signal: controller.signal,
                        });
                        if (!response.ok) {
                            const status = response.status;
                            throw new Error(`memory sync failed: HTTP ${status}`);
                        }
                        if (statePath) await saveState(statePath, { version: 1, files: next });
                        api.logger.info(
                            `[openclaw-model-provider] Synced ${changed.length} memory file(s) (${source})`
                        );
                    } finally {
                        clearTimeout(timeout);
                    }
                })
                .catch(error => {
                    const message = error instanceof Error ? error.message : String(error);
                    if (error instanceof Error && error.name === 'AbortError') {
                        api.logger.error(`[openclaw-model-provider] Memory sync timeout`);
                    } else {
                        api.logger.error(`[openclaw-model-provider] Memory sync error: ${message}`);
                    }
                });
        };

        api.registerProvider({
            id: DEFAULTS.providerId,
            label: DEFAULTS.providerLabel,
            docsPath: DEFAULTS.docsPath,
            aliases: [DEFAULTS.providerAlias],
            envVars: [cfg.apiKeyEnvVar, cfg.memorySyncApiKeyEnvVar],
            models: {
                baseUrl: cfg.baseUrl,
                apiKey: `\${${cfg.apiKeyEnvVar}}`,
                api: 'openai-completions',
                authHeader: true,
                models: [
                    {
                        id: cfg.modelId,
                        name: cfg.modelName,
                        reasoning: true,
                        input: ['text'],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 128000,
                        maxTokens: 8192,
                    },
                ],
            },
            auth: [
                {
                    id: 'api-key',
                    label: 'API Key / JWT',
                    hint: 'Get your token from the Alphahuman backend (see README)',
                    kind: 'api_key',
                    run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
                        const rawUrl = await ctx.prompter.text({
                            message:
                                'Alphahuman backend URL (e.g. https://api.yourapp.com or http://localhost:5000)',
                            validate: v => {
                                const s = v.trim();
                                if (!s) return 'Backend URL is required';
                                try {
                                    new URL(s);
                                    return undefined;
                                } catch {
                                    return 'Enter a valid URL (include http:// or https://)';
                                }
                            },
                        });

                        const backendOrigin = rawUrl.trim().replace(/\/+$/, '');
                        const baseUrl = `${backendOrigin}/openai/v1`;
                        const memorySyncUrl = `${backendOrigin}/memory/sync`;

                        const key = await ctx.prompter.text({
                            message: 'JWT or API key (get one from your backend admin)',
                            validate: v => (v.trim() ? undefined : 'Token is required'),
                        });

                        const modelRef = `${DEFAULTS.providerId}/${cfg.modelId}`;
                        return {
                            profiles: [
                                {
                                    profileId: `${DEFAULTS.providerId}:default`,
                                    credential: { type: 'api_key', provider: DEFAULTS.providerId, key: key.trim() },
                                },
                            ],
                            defaultModel: modelRef,
                            notes: [
                                `Backend: ${backendOrigin}`,
                                `Token stored. Also add to ~/.openclaw/.env: ALPHAHUMAN_API_KEY=<token>`,
                            ],
                            configPatch: {
                                models: {
                                    providers: {
                                        [DEFAULTS.providerId]: {
                                            baseUrl,
                                            apiKey: `\${${cfg.apiKeyEnvVar}}`,
                                            api: 'openai-completions',
                                            authHeader: true,
                                        },
                                    },
                                },
                                plugins: {
                                    entries: { 'openclaw-model-provider': { config: { baseUrl, memorySyncUrl } } },
                                },
                            },
                        };
                    },
                },
            ],
        });

        api.registerService({
            id: 'alphahuman-memory-sync',
            start: async ctx => {
                workspaceDir = ctx.workspaceDir ?? '';
                statePath = path.join(ctx.stateDir, stateFileName);
                syncMemory('startup', 'startup', workspaceDir);
            },
        });

        api.on('agent_end', async (_event, ctx) => {
            syncMemory('agent_end', ctx.agentId, ctx.workspaceDir ?? workspaceDir);
        });
    },
};

export default plugin;
