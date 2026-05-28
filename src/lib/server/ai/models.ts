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

// Ordered fallback list: OpenRouter tries each in sequence, skipping unavailable ones.
// Update this list (one place) when models are deprecated or better free options emerge.
// Max 3 items — OpenRouter's models fallback array limit.
export const OPENROUTER_FREE_MODELS: readonly string[] = [
	'meta-llama/llama-3.3-70b-instruct:free',
	'meta-llama/llama-3.1-8b-instruct:free',
	'google/gemma-3-27b-it:free'
] as const;

// Sentinel used by the UI provider/model selector — the actual model is chosen at runtime.
export const OPENROUTER_DEFAULT_MODEL = 'auto';

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
		label: 'OpenRouter',
		defaultModel: OPENROUTER_DEFAULT_MODEL,
		models: [{ id: 'auto', label: 'Free Models (Auto-routed)' }]
	}
];

export const DEFAULT_PROVIDER: Provider = 'openai';
export const DEFAULT_MODEL = OPENAI_DEFAULT_MODEL;

export function isValidProviderModel(provider: string, model: string): boolean {
	const p = PROVIDERS.find((entry) => entry.id === provider);
	if (!p) return false;
	return p.models.some((m) => m.id === model);
}
