import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db/index.js';
import { accounts, sessions, users, verificationTokens } from './db/schema.js';

const ALLOWED_USERNAME = process.env.ALLOWED_GITHUB_USERNAME;

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	providers: [
		GitHub({
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET
		})
	],
	callbacks: {
		async signIn({ profile }) {
			if (!ALLOWED_USERNAME) {
				throw new Error('ALLOWED_GITHUB_USERNAME environment variable is not set');
			}
			// Only allow the configured GitHub account
			return (profile as { login?: string })?.login === ALLOWED_USERNAME;
		},
		async session({ session, user }) {
			session.user.id = user.id;
			return session;
		}
	},
	pages: {
		signIn: '/auth/signin',
		error: '/auth/error'
	}
});
