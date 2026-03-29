import { handle as authHandle } from '$lib/server/auth.js';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/auth'];

const authGuard: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();
	const isPublicPath = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));

	if (!session && !isPublicPath) {
		redirect(303, '/auth/signin');
	}

	return resolve(event);
};

export const handle = sequence(authHandle, authGuard);
