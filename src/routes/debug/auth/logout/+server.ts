import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { clearDebugAuthCookie, getSafeRedirectTarget } from '$lib/server/debug-auth.js';

const logout: RequestHandler = ({ cookies, url }) => {
	clearDebugAuthCookie(cookies, url.protocol === 'https:');
	redirect(303, getSafeRedirectTarget(url.searchParams.get('redirectTo') ?? '/signin'));
};

export const GET = logout;
export const POST = logout;
