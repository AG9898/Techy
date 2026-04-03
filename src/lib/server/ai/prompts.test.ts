import { describe, expect, it } from 'vitest';
import {
	buildNoteSectionStructurePrompt,
	DEPRECATED_NOTE_HEADINGS,
	OPTIONAL_NOTE_SECTIONS,
	REQUIRED_NOTE_SECTIONS
} from '$lib/utils/note-structure.js';
import { buildRespondSystemPrompt } from './prompts.js';

describe('buildRespondSystemPrompt', () => {
	it('injects the shared note structure contract into create prompts', () => {
		const prompt = buildRespondSystemPrompt({ mode: 'create' });
		const structurePrompt = buildNoteSectionStructurePrompt();

		expect(prompt).toContain('Active skill: create note.');
		expect(prompt).toContain(structurePrompt);
		expect(prompt).toContain(`Use these required sections in this order: ${REQUIRED_NOTE_SECTIONS.join(' → ')}.`);
		expect(prompt).toContain(
			`Optional sections are allowed only when they materially improve the note, and only in this order between \`Key Concepts\` and \`Connections\`: ${OPTIONAL_NOTE_SECTIONS.join(' → ')}.`
		);

		for (const heading of DEPRECATED_NOTE_HEADINGS) {
			expect(prompt).toContain(heading);
		}
	});

	it('injects the shared note structure contract into update prompts', () => {
		const prompt = buildRespondSystemPrompt({ mode: 'update' });

		expect(prompt).toContain('Active skill: review existing note for update.');
		expect(prompt).toContain('Normalize the replacement body toward the shared note structure exactly.');
		expect(prompt).toContain(buildNoteSectionStructurePrompt());
		expect(prompt).toContain(
			'Prefer evergreen explanation over release-churn or transient ecosystem updates unless `Version Notes` is genuinely warranted.'
		);
	});

	it('instructs the assistant to keep sources out of the prose body', () => {
		const prompt = buildRespondSystemPrompt({ mode: 'chat' });

		expect(prompt).toContain('Do not include a Sources, References, Links, or Citations section in "content".');
		expect(prompt).toContain('The UI renders citations separately.');
	});

	it('keeps chat replies concise and leaves note offers to the app', () => {
		const prompt = buildRespondSystemPrompt({ mode: 'chat' });

		expect(prompt).toContain('Do not return create_note in chat mode.');
		expect(prompt).toContain('Keep the reply concise by default');
		expect(prompt).toContain('Use light markdown for readability when helpful');
	});
});
