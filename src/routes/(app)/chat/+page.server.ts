import type { PageServerLoad } from './$types.js';
import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '$lib/server/ai/models.js';

export const load: PageServerLoad = async () => {
	return {
		providers: PROVIDERS.map((p) => ({
			id: p.id,
			label: p.label,
			models: p.models,
			defaultModel: p.defaultModel
		})),
		defaultProvider: DEFAULT_PROVIDER,
		defaultModel: DEFAULT_MODEL
	};
};
