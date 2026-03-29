import type { DefaultSession } from '@auth/sveltekit';

declare global {
	namespace App {
		interface Locals {
			auth: () => Promise<DefaultSession | null>;
		}
		interface PageData {
			session?: DefaultSession | null;
		}
	}
}

export {};
