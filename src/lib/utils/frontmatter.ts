/**
 * Parses YAML-style frontmatter from a Markdown string.
 * Handles the subset of YAML used by Techy note files:
 *   title, tags, aliases (inline arrays), category, status (scalar strings).
 */

function parseInlineArray(raw: string): string[] {
	const trimmed = raw.trim();
	if (!trimmed.startsWith('[')) return [];
	const inner = trimmed.slice(1, trimmed.lastIndexOf(']'));
	if (!inner.trim()) return [];
	return inner
		.split(',')
		.map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
}

export interface ParsedFrontmatter {
	title: string | undefined;
	tags: string[];
	aliases: string[];
	category: string | undefined;
	status: string | undefined;
	body: string;
}

/**
 * Parses YAML frontmatter and body from a Markdown file string.
 * Returns null if no frontmatter block is found.
 * Title is taken from `title:` frontmatter, or falls back to the first `# Heading`.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;

	const yaml = match[1];
	const body = match[2].trim();
	const result: ParsedFrontmatter = {
		title: undefined,
		tags: [],
		aliases: [],
		category: undefined,
		status: undefined,
		body
	};

	for (const line of yaml.split('\n')) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();

		if (key === 'tags') result.tags = parseInlineArray(value);
		else if (key === 'aliases') result.aliases = parseInlineArray(value);
		else if (key === 'title') result.title = value || undefined;
		else if (key === 'category') result.category = value || undefined;
		else if (key === 'status') result.status = value || undefined;
	}

	// Fall back to first # heading if no explicit title in frontmatter
	if (!result.title) {
		const headingMatch = body.match(/^#\s+(.+)$/m);
		if (headingMatch) result.title = headingMatch[1].trim();
	}

	return result;
}
