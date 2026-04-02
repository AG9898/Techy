export const CANONICAL_NOTE_CATEGORIES = [
	'Programming Languages',
	'Frameworks & Libraries',
	'Developer Tools',
	'Platforms & Operating Systems',
	'Cloud & Infrastructure',
	'Databases & Storage',
	'Networking & Protocols',
	'Security & Identity',
	'APIs & Integration',
	'DevOps & Delivery',
	'AI & Machine Learning',
	'Data & Analytics',
	'Hardware & Devices',
	'Software Architecture',
	'Concepts & Methodologies'
] as const;

export type CanonicalNoteCategory = (typeof CANONICAL_NOTE_CATEGORIES)[number];

const categoryLookup = new Map(
	CANONICAL_NOTE_CATEGORIES.map((category) => [category.toLowerCase(), category])
);

export function normalizeNoteCategory(raw: string | null | undefined): CanonicalNoteCategory | null {
	if (typeof raw !== 'string') return null;

	const trimmed = raw.trim();
	if (!trimmed) return null;

	return categoryLookup.get(trimmed.toLowerCase()) ?? null;
}

export function validateNoteCategory(raw: string | null | undefined): {
	category: CanonicalNoteCategory | null;
	error: string | null;
} {
	if (typeof raw !== 'string' || raw.trim().length === 0) {
		return { category: null, error: null };
	}

	const category = normalizeNoteCategory(raw);
	if (category) {
		return { category, error: null };
	}

	return {
		category: null,
		error: `Category must be one of: ${CANONICAL_NOTE_CATEGORIES.join(', ')}`
	};
}

export function isCanonicalNoteCategory(raw: string | null | undefined): raw is CanonicalNoteCategory {
	return normalizeNoteCategory(raw) !== null;
}
