import { describe, expect, it } from 'vitest';
import { resolveAssistantRouting } from './routing.js';

const NOTES = [
	{
		id: 'note-1',
		title: 'npm',
		slug: 'npm',
		aliases: ['Node Package Manager']
	}
];

describe('resolveAssistantRouting', () => {
	it('keeps plain learning prompts conversational', () => {
		const routing = resolveAssistantRouting({
			messages: [{ role: 'user', content: 'What is npm?' }],
			notes: NOTES
		});

		expect(routing.resolvedMode).toBe('chat');
		expect(routing.intent).toBe('conversational');
	});

	it('treats follow-up note creation asks as create intent', () => {
		const routing = resolveAssistantRouting({
			messages: [
				{ role: 'user', content: 'What is npm?' },
				{ role: 'assistant', content: 'npm is the default package manager for Node.js.' },
				{ role: 'user', content: 'Can you add it to notes' }
			],
			notes: NOTES
		});

		expect(routing.resolvedMode).toBe('create');
		expect(routing.intent).toBe('create');
	});

	it('treats save-this follow-ups as create intent', () => {
		const routing = resolveAssistantRouting({
			messages: [
				{ role: 'user', content: 'Teach me about npm' },
				{ role: 'assistant', content: 'npm manages packages and dependencies for Node.js projects.' },
				{ role: 'user', content: 'Save this to my notes' }
			],
			notes: NOTES
		});

		expect(routing.resolvedMode).toBe('create');
		expect(routing.intent).toBe('create');
	});
});
