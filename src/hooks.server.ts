import { handle as authHandle } from '$lib/server/auth.js';
import { clearDebugAuthCookie, getDebugSession } from '$lib/server/debug-auth.js';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/auth', '/signin', '/debug/auth'];

const debugAuthHandle: Handle = async ({ event, resolve }) => {
	const debugSession = getDebugSession(event.cookies);

	if (debugSession) {
		event.locals.auth = async () => debugSession;

		if (event.url.pathname === '/auth/signout' && event.request.method === 'POST') {
			clearDebugAuthCookie(event.cookies, event.url.protocol === 'https:');
			redirect(303, '/signin');
		}
	}

	return resolve(event);
};

const authGuard: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();
	const isPublicPath = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));

	if (!session && !isPublicPath) {
		redirect(303, '/signin');
	}

	return resolve(event);
};

export const handle = sequence(debugAuthHandle, authHandle, authGuard);
