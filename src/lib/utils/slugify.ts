/**
 * Converts a note title to a URL-safe slug.
 * "Next.js & React" → "nextjs-react"
 */
export function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}
