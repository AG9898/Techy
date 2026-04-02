export const REQUIRED_NOTE_SECTIONS = [
	'Overview',
	'Description',
	'Key Concepts',
	'Connections',
	'Resources'
] as const;

export const OPTIONAL_NOTE_SECTIONS = [
	'Use Cases',
	'Tradeoffs',
	'Ecosystem',
	'Version Notes',
	'Example'
] as const;

export const DEPRECATED_NOTE_HEADINGS = [
	'Current Status',
	'Notable Features',
	'Quick Examples',
	'Industry Usage'
] as const;

export type RequiredNoteSection = (typeof REQUIRED_NOTE_SECTIONS)[number];
export type OptionalNoteSection = (typeof OPTIONAL_NOTE_SECTIONS)[number];
export type NoteSection = RequiredNoteSection | OptionalNoteSection;

function normalizeHeadingText(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

function canonicalSectionHeading(text: string): NoteSection | null {
	const normalized = normalizeHeadingText(text).toLowerCase();
	const section = [...REQUIRED_NOTE_SECTIONS, ...OPTIONAL_NOTE_SECTIONS].find(
		(candidate) => candidate.toLowerCase() === normalized
	);
	return section ?? null;
}

function isDeprecatedHeading(text: string): boolean {
	const normalized = normalizeHeadingText(text).toLowerCase();
	return DEPRECATED_NOTE_HEADINGS.some((candidate) => candidate.toLowerCase() === normalized);
}

export function buildNoteSectionStructurePrompt(): string {
	return `
Note body structure:
- Use these required sections in this order: ${REQUIRED_NOTE_SECTIONS.join(' → ')}.
- The body must always include all required sections.
- Treat this as the exact working skeleton:
  # Topic Name

  ## Overview
  ## Description
  ## Key Concepts
  ## Connections
  ## Resources
- Keep \`Overview\` brief: 2-4 sentences that orient the reader without repeating the full explanation.
- Use \`Description\` as the primary deep-explanation section.
- Optional sections are allowed only when they materially improve the note, and only in this order between \`Key Concepts\` and \`Connections\`: ${OPTIONAL_NOTE_SECTIONS.join(' → ')}.
- Keep optional sections concise and skip them when they would only add churn or repetition.
- Prefer evergreen explanation over release-churn or transient ecosystem updates unless \`Version Notes\` is genuinely warranted.
- Do not use these deprecated default headings anywhere in the body: ${DEPRECATED_NOTE_HEADINGS.join(', ')}.
`.trim();
}

export type NoteBodyValidationResult =
	| {
			ok: true;
			normalizedBody: string;
			topLevelSections: NoteSection[];
	  }
	| {
			ok: false;
			error: string;
	  };

export function validateStandardNoteBody(body: string): NoteBodyValidationResult {
	const lines = body.split(/\r?\n/);
	const topLevelSections: NoteSection[] = [];
	const normalizedLines = [...lines];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const headingMatch = line.match(/^(\s*)(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!headingMatch) continue;

		const [, leadingWhitespace, hashes, rawHeading] = headingMatch;
		const headingLevel = hashes.length;
		const headingText = normalizeHeadingText(rawHeading);

		if (isDeprecatedHeading(headingText)) {
			return {
				ok: false,
				error: `Assistant note bodies cannot use deprecated heading "${headingText}"`
			};
		}

		const canonicalHeading = canonicalSectionHeading(headingText);
		if (headingLevel === 2) {
			if (!canonicalHeading) {
				return {
					ok: false,
					error: `Assistant note bodies must use only the approved section headings. Unsupported heading "${headingText}" is not allowed.`
				};
			}

			topLevelSections.push(canonicalHeading);
			normalizedLines[index] = `${leadingWhitespace}${hashes} ${canonicalHeading}`;
			continue;
		}

		if (canonicalHeading) {
			return {
				ok: false,
				error: `Assistant note bodies must use "${canonicalHeading}" as an h2 section heading.`
			};
		}
	}

	if (topLevelSections.length < REQUIRED_NOTE_SECTIONS.length) {
		return {
			ok: false,
			error: 'Assistant note bodies must include Overview, Description, Key Concepts, Connections, and Resources in order.'
		};
	}

	let cursor = 0;
	for (const section of REQUIRED_NOTE_SECTIONS.slice(0, 3)) {
		if (topLevelSections[cursor] !== section) {
			return {
				ok: false,
				error: 'Assistant note bodies must start with Overview, Description, and Key Concepts in that order.'
			};
		}
		cursor += 1;
	}

	for (const section of OPTIONAL_NOTE_SECTIONS) {
		if (topLevelSections[cursor] === section) {
			cursor += 1;
		}
	}

	if (topLevelSections[cursor] !== 'Connections') {
		return {
			ok: false,
			error: 'Assistant note bodies must place only approved optional sections between Key Concepts and Connections.'
		};
	}
	cursor += 1;

	if (topLevelSections[cursor] !== 'Resources' || cursor !== topLevelSections.length - 1) {
		return {
			ok: false,
			error: 'Assistant note bodies must end with Resources after Connections.'
		};
	}

	return {
		ok: true,
		normalizedBody: normalizedLines.join('\n'),
		topLevelSections
	};
}
