import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();

	if (!session) {
		redirect(303, '/signin');
	}

	return { session };
};
