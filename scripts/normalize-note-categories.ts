#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import { eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { notes } from '../src/lib/server/db/schema.js';
import {
	CANONICAL_NOTE_CATEGORIES,
	type CanonicalNoteCategory
} from '../src/lib/utils/note-taxonomy.js';

type NoteCategoryRow = {
	id: string;
	title: string;
	category: string | null;
};

type CategoryResolution =
	| { kind: 'canonical'; category: CanonicalNoteCategory }
	| { kind: 'safe-update'; category: CanonicalNoteCategory }
	| { kind: 'ambiguous'; suggestions: readonly CanonicalNoteCategory[] }
	| { kind: 'unknown' };

const CANONICAL_CATEGORY_LOOKUP = new Map(
	CANONICAL_NOTE_CATEGORIES.map((category) => [normalizeCategoryKey(category), category])
);

const SAFE_CATEGORY_ALIASES = new Map<string, CanonicalNoteCategory>([
	[normalizeCategoryKey('Web Frameworks'), 'Frameworks & Libraries'],
	[normalizeCategoryKey('Web Framework'), 'Frameworks & Libraries'],
	[normalizeCategoryKey('Frameworks'), 'Frameworks & Libraries'],
	[normalizeCategoryKey('Libraries'), 'Frameworks & Libraries'],
	[normalizeCategoryKey('Databases'), 'Databases & Storage'],
	[normalizeCategoryKey('Database'), 'Databases & Storage'],
	[normalizeCategoryKey('DevOps & CI/CD'), 'DevOps & Delivery'],
	[normalizeCategoryKey('DevOps and CI/CD'), 'DevOps & Delivery'],
	[normalizeCategoryKey('Cloud Infrastructure'), 'Cloud & Infrastructure'],
	[normalizeCategoryKey('Developer Tools'), 'Developer Tools'],
	[normalizeCategoryKey('Hardware & Devices'), 'Hardware & Devices'],
	[normalizeCategoryKey('Hardware'), 'Hardware & Devices'],
	[normalizeCategoryKey('Data & Analytics'), 'Data & Analytics'],
	[normalizeCategoryKey('Analytics'), 'Data & Analytics'],
	[normalizeCategoryKey('AI & Machine Learning'), 'AI & Machine Learning'],
	[normalizeCategoryKey('Machine Learning'), 'AI & Machine Learning'],
	[normalizeCategoryKey('Programming Languages'), 'Programming Languages'],
	[normalizeCategoryKey('Language'), 'Programming Languages'],
	[normalizeCategoryKey('Software Architecture'), 'Software Architecture'],
	[normalizeCategoryKey('Architecture'), 'Software Architecture'],
	[normalizeCategoryKey('Networking & Protocols'), 'Networking & Protocols'],
	[normalizeCategoryKey('Security & Identity'), 'Security & Identity'],
	[normalizeCategoryKey('APIs & Integration'), 'APIs & Integration'],
	[normalizeCategoryKey('Platforms & Operating Systems'), 'Platforms & Operating Systems'],
	[normalizeCategoryKey('Concepts & Methodologies'), 'Concepts & Methodologies'],
	[normalizeCategoryKey('DevOps & Delivery'), 'DevOps & Delivery']
]);

const AMBIGUOUS_CATEGORY_HINTS = new Map<string, readonly CanonicalNoteCategory[]>([
	[
		normalizeCategoryKey('APIs & Services'),
		['APIs & Integration', 'Cloud & Infrastructure', 'Platforms & Operating Systems']
	],
	[
		normalizeCategoryKey('API Services'),
		['APIs & Integration', 'Cloud & Infrastructure', 'Platforms & Operating Systems']
	],
	[normalizeCategoryKey('Protocols & Standards'), ['Networking & Protocols', 'Security & Identity']],
	[normalizeCategoryKey('Protocols'), ['Networking & Protocols', 'Security & Identity']],
	[normalizeCategoryKey('Services'), ['APIs & Integration', 'Cloud & Infrastructure']]
]);

function normalizeCategoryKey(value: string): string {
	return value
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/\band\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function resolveCategory(rawCategory: string): CategoryResolution {
	const normalized = normalizeCategoryKey(rawCategory);

	if (!normalized) {
		return { kind: 'unknown' };
	}

	const canonical = CANONICAL_CATEGORY_LOOKUP.get(normalized);
	if (canonical) {
		return { kind: 'canonical', category: canonical };
	}

	const safeAlias = SAFE_CATEGORY_ALIASES.get(normalized);
	if (safeAlias) {
		return { kind: 'safe-update', category: safeAlias };
	}

	const ambiguous = AMBIGUOUS_CATEGORY_HINTS.get(normalized);
	if (ambiguous) {
		return { kind: 'ambiguous', suggestions: ambiguous };
	}

	return { kind: 'unknown' };
}

function formatNoteList(notes: NoteCategoryRow[], limit = 5): string {
	return notes
		.slice(0, limit)
		.map((note) => `${note.title} (${note.id})`)
		.join(', ');
}

async function main(): Promise<void> {
	const shouldApply = process.argv.includes('--apply');
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	const db = drizzle(neon(databaseUrl));
	const noteRows = await db
		.select({
			id: notes.id,
			title: notes.title,
			category: notes.category
		})
		.from(notes)
		.where(isNotNull(notes.category));

	const rowsByCategory = new Map<string, NoteCategoryRow[]>();
	for (const row of noteRows) {
		const category = row.category?.trim();
		if (!category) continue;

		const bucket = rowsByCategory.get(category) ?? [];
		bucket.push(row);
		rowsByCategory.set(category, bucket);
	}

	const updates: Array<{
		from: string;
		to: CanonicalNoteCategory;
		rows: NoteCategoryRow[];
	}> = [];
	const ambiguous: Array<{
		category: string;
		rows: NoteCategoryRow[];
		suggestions: readonly CanonicalNoteCategory[];
	}> = [];
	const unknown: Array<{
		category: string;
		rows: NoteCategoryRow[];
	}> = [];

	for (const [category, rows] of rowsByCategory.entries()) {
		const resolved = resolveCategory(category);

		if (resolved.kind === 'canonical') {
			if (category !== resolved.category) {
				updates.push({ from: category, to: resolved.category, rows });
			}
			continue;
		}

		if (resolved.kind === 'safe-update') {
			updates.push({ from: category, to: resolved.category, rows });
			continue;
		}

		if (resolved.kind === 'ambiguous') {
			ambiguous.push({ category, rows, suggestions: resolved.suggestions });
			continue;
		}

		unknown.push({ category, rows });
	}

	console.log(`Found ${noteRows.length} notes with non-empty categories.`);
	console.log(`Safe category updates: ${updates.length} distinct legacy labels.`);

	if (updates.length > 0) {
		for (const update of updates) {
			console.log(`- ${update.from} -> ${update.to} (${update.rows.length} notes)`);
			console.log(`  Examples: ${formatNoteList(update.rows)}`);
		}
	}

	if (ambiguous.length > 0) {
		console.log('');
		console.log('Ambiguous categories requiring manual review:');
		for (const item of ambiguous) {
			console.log(`- ${item.category} (${item.rows.length} notes)`);
			console.log(`  Suggested canonical buckets: ${item.suggestions.join(', ')}`);
			console.log(`  Examples: ${formatNoteList(item.rows)}`);
		}
	}

	if (unknown.length > 0) {
		console.log('');
		console.log('Unknown categories requiring manual review:');
		for (const item of unknown) {
			console.log(`- ${item.category} (${item.rows.length} notes)`);
			console.log(`  Examples: ${formatNoteList(item.rows)}`);
		}
	}

	if (!shouldApply) {
		console.log('');
		console.log('Dry run only. Re-run with `--apply` to write safe updates.');
		return;
	}

	if (updates.length === 0) {
		console.log('');
		console.log('No safe category updates were needed.');
		return;
	}

	const updatedAt = new Date();
	for (const update of updates) {
		await db
			.update(notes)
			.set({ category: update.to, updatedAt })
			.where(eq(notes.category, update.from));
	}

	console.log('');
	console.log(`Applied ${updates.length} category label updates.`);
}

main().catch((error) => {
	console.error('[normalize-note-categories]', error);
	process.exitCode = 1;
});
