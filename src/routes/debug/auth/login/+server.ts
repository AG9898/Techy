import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	getSafeRedirectTarget,
	isDebugAuthEnabled,
	isDebugAuthSecretValid,
	setDebugAuthCookie
} from '$lib/server/debug-auth.js';

const resolveSecret = async (request: Request, url: URL) => {
	if (request.method === 'GET') {
		return {
			secret: url.searchParams.get('secret'),
			redirectTo: url.searchParams.get('redirectTo')
		};
	}

	const formData = await request.formData();

	return {
		secret: formData.get('secret')?.toString() ?? null,
		redirectTo: formData.get('redirectTo')?.toString() ?? null
	};
};

const login: RequestHandler = async ({ request, url, cookies }) => {
	if (!isDebugAuthEnabled()) {
		error(404, 'Debug auth bypass is not enabled');
	}

	const { secret, redirectTo } = await resolveSecret(request, url);

	if (!isDebugAuthSecretValid(secret)) {
		error(403, 'Invalid debug auth secret');
	}

	setDebugAuthCookie(cookies, url.protocol === 'https:');
	redirect(303, getSafeRedirectTarget(redirectTo));
};

export const GET = login;
export const POST = login;
