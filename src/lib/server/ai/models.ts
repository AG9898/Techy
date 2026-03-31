export type Provider = 'anthropic' | 'openai';

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

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4-6';
export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';

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
	}
];

export const DEFAULT_PROVIDER: Provider = 'anthropic';
export const DEFAULT_MODEL = ANTHROPIC_DEFAULT_MODEL;

export function isValidProviderModel(provider: string, model: string): boolean {
	const p = PROVIDERS.find((entry) => entry.id === provider);
	if (!p) return false;
	return p.models.some((m) => m.id === model);
}
