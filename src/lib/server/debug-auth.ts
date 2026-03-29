import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DefaultSession } from '@auth/sveltekit';
import type { Cookies } from '@sveltejs/kit';

const DEBUG_AUTH_COOKIE = 'techy_debug_session';
const DEBUG_AUTH_MAX_AGE = 60 * 60 * 8;
const DEFAULT_DEBUG_AUTH_NAME = 'Agent';

type DebugAuthPayload = {
	sub: string;
	name: string;
	exp: number;
};

const getDebugAuthSecret = () => process.env.DEBUG_AUTH_BYPASS_SECRET?.trim() ?? '';

const signPayload = (payload: string, secret: string) =>
	createHmac('sha256', secret).update(payload).digest('base64url');

const safeCompare = (left: string, right: string) => {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}

	return timingSafeEqual(leftBuffer, rightBuffer);
};

const decodePayload = (encodedPayload: string): DebugAuthPayload | null => {
	try {
		const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

		if (
			typeof payload !== 'object' ||
			payload === null ||
			typeof payload.sub !== 'string' ||
			typeof payload.name !== 'string' ||
			typeof payload.exp !== 'number'
		) {
			return null;
		}

		return payload as DebugAuthPayload;
	} catch {
		return null;
	}
};

export const isDebugAuthEnabled = () =>
	process.env.DEBUG_AUTH_BYPASS_ENABLED === 'true' && getDebugAuthSecret().length > 0;

export const isDebugAuthSecretValid = (candidate: string | null) => {
	const secret = getDebugAuthSecret();

	if (!candidate || !secret) {
		return false;
	}

	return safeCompare(candidate, secret);
};

export const getDebugAuthDisplayName = () =>
	process.env.DEBUG_AUTH_BYPASS_NAME?.trim() || DEFAULT_DEBUG_AUTH_NAME;

export const getSafeRedirectTarget = (redirectTo: string | null) => {
	if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
		return '/';
	}

	return redirectTo;
};

export const createDebugAuthToken = () => {
	const payload: DebugAuthPayload = {
		sub: 'debug-agent',
		name: getDebugAuthDisplayName(),
		exp: Date.now() + DEBUG_AUTH_MAX_AGE * 1000
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const signature = signPayload(encodedPayload, getDebugAuthSecret());

	return `${encodedPayload}.${signature}`;
};

export const setDebugAuthCookie = (cookies: Cookies, secure: boolean) => {
	cookies.set(DEBUG_AUTH_COOKIE, createDebugAuthToken(), {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure,
		maxAge: DEBUG_AUTH_MAX_AGE
	});
};

export const clearDebugAuthCookie = (cookies: Cookies, secure: boolean) => {
	cookies.delete(DEBUG_AUTH_COOKIE, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure
	});
};

export const getDebugSession = (cookies: Cookies): DefaultSession | null => {
	if (!isDebugAuthEnabled()) {
		return null;
	}

	const rawToken = cookies.get(DEBUG_AUTH_COOKIE);

	if (!rawToken) {
		return null;
	}

	const [encodedPayload, providedSignature] = rawToken.split('.');

	if (!encodedPayload || !providedSignature) {
		return null;
	}

	const expectedSignature = signPayload(encodedPayload, getDebugAuthSecret());

	if (!safeCompare(providedSignature, expectedSignature)) {
		return null;
	}

	const payload = decodePayload(encodedPayload);

	if (!payload || payload.exp <= Date.now()) {
		return null;
	}

	return {
		user: {
			id: payload.sub,
			name: payload.name,
			email: `${payload.sub}@debug.local`,
			image: null
		},
		expires: new Date(payload.exp).toISOString()
	} as DefaultSession;
};
