import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
	return {
		callbackUrl: url.searchParams.get('callbackUrl') ?? '/',
		error: url.searchParams.get('error') ?? null
	};
};
