/**
 * Extracts all [[wikilink]] targets from a note body string.
 * "See [[React]] and [[Next.js]]" → ["React", "Next.js"]
 */
export function extractWikilinks(body: string): string[] {
	const matches = body.matchAll(/\[\[([^\]]+)\]\]/g);
	const titles = new Set<string>();
	for (const match of matches) {
		titles.add(match[1].trim());
	}
	return [...titles];
}

/**
 * Replaces [[wikilink]] syntax with HTML anchor tags for rendering.
 * Unresolved links render as <span class="wikilink-broken">.
 *
 * @param body - Raw markdown body with [[wikilink]] syntax
 * @param slugMap - Map of note title → slug for link resolution
 */
export function resolveWikilinks(body: string, slugMap: Map<string, string>): string {
	return body.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) => {
		const trimmed = title.trim();
		const slug = slugMap.get(trimmed);
		if (slug) {
			return `<a href="/notes/${slug}" class="wikilink">${trimmed}</a>`;
		}
		return `<span class="wikilink-broken" title="Note not found">${trimmed}</span>`;
	});
}
