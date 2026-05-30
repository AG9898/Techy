export type Provider = 'anthropic' | 'openai' | 'openrouter';

export interface ModelOption {
	id: string;
	label: string;
}

export interface ProviderOption {
	id: Provider;
	label: string;
	models: ModelOption[];
	defaultModel: string;
}

export const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';

// Curated free OpenRouter models — one per vendor, chosen for quality/reliability.
export const OPENROUTER_MODEL_KIMI = 'moonshotai/kimi-k2.6:free';
export const OPENROUTER_MODEL_DEEPSEEK = 'deepseek/deepseek-v4-flash:free';
export const OPENROUTER_MODEL_QWEN = 'qwen/qwen3-coder:free';
export const OPENROUTER_MODEL_GEMMA = 'google/gemma-4-31b-it:free';

// Default for the chat UI (strong general-purpose coder).
export const OPENROUTER_DEFAULT_MODEL = OPENROUTER_MODEL_KIMI;

// Default for the LeetCode practice tutor — Qwen3 Coder is purpose-built for
// algorithmic coding tasks, code review, and long-context repository reasoning.
export const OPENROUTER_LEETCODE_MODEL = OPENROUTER_MODEL_QWEN;

export const PROVIDERS: ProviderOption[] = [
	{
		id: 'anthropic',
		label: 'Anthropic',
		defaultModel: ANTHROPIC_DEFAULT_MODEL,
		models: [
			{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
			{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
			{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
		]
	},
	{
		id: 'openai',
		label: 'OpenAI',
		defaultModel: OPENAI_DEFAULT_MODEL,
		models: [
			{ id: 'gpt-5.2', label: 'GPT-5.2' },
			{ id: 'gpt-5-mini', label: 'GPT-5 Mini' },
			{ id: 'gpt-4o', label: 'GPT-4o' },
			{ id: 'gpt-4o-mini', label: 'GPT-4o Mini' }
		]
	},
	{
		id: 'openrouter',
		label: 'OpenRouter (Free)',
		defaultModel: OPENROUTER_DEFAULT_MODEL,
		models: [
			{ id: OPENROUTER_MODEL_KIMI, label: 'Kimi K2.6' },
			{ id: OPENROUTER_MODEL_DEEPSEEK, label: 'DeepSeek V4 Flash' },
			{ id: OPENROUTER_MODEL_QWEN, label: 'Qwen3 Coder' },
			{ id: OPENROUTER_MODEL_GEMMA, label: 'Gemma 4 31B' }
		]
	}
];

export const DEFAULT_PROVIDER: Provider = 'openai';
export const DEFAULT_MODEL = OPENAI_DEFAULT_MODEL;

export function isValidProviderModel(provider: string, model: string): boolean {
	const p = PROVIDERS.find((entry) => entry.id === provider);
	if (!p) return false;
	return p.models.some((m) => m.id === model);
}
