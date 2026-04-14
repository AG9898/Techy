import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	canSpeak,
	canListen,
	extractHtmlText,
	extractMarkdownText,
	speak,
	stopSpeaking,
	isSpeaking
} from './speech.js';

// ─── Capability detection ─────────────────────────────────────────────────────

describe('canSpeak', () => {
	it('returns false when window is undefined (SSR)', () => {
		// node test environment has no window by default
		expect(canSpeak()).toBe(false);
	});

	it('returns false when window exists but speechSynthesis is absent', () => {
		vi.stubGlobal('window', {});
		expect(canSpeak()).toBe(false);
		vi.unstubAllGlobals();
	});

	it('returns true when window.speechSynthesis is present', () => {
		vi.stubGlobal('window', { speechSynthesis: {} });
		expect(canSpeak()).toBe(true);
		vi.unstubAllGlobals();
	});
});

describe('canListen', () => {
	it('returns false when window is undefined (SSR)', () => {
		expect(canListen()).toBe(false);
	});

	it('returns false when window lacks both recognition constructors', () => {
		vi.stubGlobal('window', {});
		expect(canListen()).toBe(false);
		vi.unstubAllGlobals();
	});

	it('returns true when SpeechRecognition is present', () => {
		vi.stubGlobal('window', { SpeechRecognition: class {} });
		expect(canListen()).toBe(true);
		vi.unstubAllGlobals();
	});

	it('returns true when webkitSpeechRecognition is present', () => {
		vi.stubGlobal('window', { webkitSpeechRecognition: class {} });
		expect(canListen()).toBe(true);
		vi.unstubAllGlobals();
	});
});

// ─── Text extraction ──────────────────────────────────────────────────────────

describe('extractHtmlText', () => {
	it('strips all HTML tags', () => {
		expect(extractHtmlText('<h1>Title</h1><p>Body text.</p>')).toBe('Title Body text.');
	});

	it('decodes common HTML entities', () => {
		expect(
			extractHtmlText('a &amp; b &lt;3&gt; &quot;hi&quot; &#39;hey&#39; hello&nbsp;world')
		).toBe("a & b <3> \"hi\" 'hey' hello world");
	});

	it('collapses whitespace', () => {
		expect(extractHtmlText('  <p>  Hello   world  </p>  ')).toBe('Hello world');
	});

	it('returns empty string for empty input', () => {
		expect(extractHtmlText('')).toBe('');
	});
});

describe('extractMarkdownText', () => {
	it('strips heading markers', () => {
		const result = extractMarkdownText('# Title\n## Subtitle\nBody');
		expect(result).toContain('Title');
		expect(result).not.toContain('#');
	});

	it('strips bold and italic markers', () => {
		const result = extractMarkdownText('**bold** and *italic* and __bold2__ and _italic2_');
		expect(result).toBe('bold and italic and bold2 and italic2');
	});

	it('strips links and keeps link text', () => {
		expect(extractMarkdownText('[click here](https://example.com)')).toBe('click here');
	});

	it('strips images', () => {
		expect(extractMarkdownText('before ![alt text](image.png) after')).toBe('before after');
	});

	it('replaces wikilinks with target text', () => {
		expect(extractMarkdownText('See [[TypeScript]] for details.')).toBe(
			'See TypeScript for details.'
		);
	});

	it('uses alias from wikilinks when present', () => {
		expect(extractMarkdownText('See [[TypeScript|TS]] for details.')).toBe(
			'See TS for details.'
		);
	});

	it('strips fenced code blocks', () => {
		const md = 'Before\n```\nconst x = 1;\n```\nAfter';
		const result = extractMarkdownText(md);
		expect(result).not.toContain('const x');
		expect(result).toContain('Before');
		expect(result).toContain('After');
	});

	it('strips inline code', () => {
		expect(extractMarkdownText('Use `npm install` to install')).toBe('Use to install');
	});

	it('strips unordered list markers', () => {
		const result = extractMarkdownText('- first\n- second\n* third');
		expect(result).not.toMatch(/^[-*]/m);
		expect(result).toContain('first');
		expect(result).toContain('second');
	});

	it('strips ordered list markers', () => {
		const result = extractMarkdownText('1. first\n2. second');
		expect(result).not.toMatch(/^\d+\./m);
		expect(result).toContain('first');
	});

	it('returns empty string for empty input', () => {
		expect(extractMarkdownText('')).toBe('');
	});
});

// ─── Speech synthesis ─────────────────────────────────────────────────────────

class MockUtterance {
	text: string;
	handlers: Record<string, Array<() => void>> = {};

	constructor(text: string) {
		this.text = text;
	}

	addEventListener(event: string, fn: () => void) {
		(this.handlers[event] ??= []).push(fn);
	}

	trigger(event: string) {
		this.handlers[event]?.forEach((fn) => fn());
	}
}

describe('speak and stopSpeaking', () => {
	let mockCancel: ReturnType<typeof vi.fn>;
	let mockSpeak: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockCancel = vi.fn();
		mockSpeak = vi.fn();
		vi.stubGlobal('window', {
			speechSynthesis: { speak: mockSpeak, cancel: mockCancel },
			SpeechSynthesisUtterance: MockUtterance
		});
	});

	afterEach(() => {
		stopSpeaking();
		vi.unstubAllGlobals();
	});

	it('no-ops when SpeechSynthesis is unavailable', () => {
		vi.unstubAllGlobals();
		speak('hello');
		expect(mockSpeak).not.toHaveBeenCalled();
	});

	it('calls speechSynthesis.speak with the utterance', () => {
		speak('hello world');
		expect(mockSpeak).toHaveBeenCalledOnce();
		const utterance = mockSpeak.mock.calls[0][0] as MockUtterance;
		expect(utterance.text).toBe('hello world');
	});

	it('cancels existing speech before starting new', () => {
		speak('first');
		speak('second');
		// first speak() triggers internal stopSpeaking() → cancel once
		// second speak() triggers internal stopSpeaking() → cancel again
		expect(mockCancel).toHaveBeenCalledTimes(2);
		expect(mockSpeak).toHaveBeenCalledTimes(2);
	});

	it('calls onEnd when utterance fires end event', () => {
		const onEnd = vi.fn();
		speak('hello', onEnd);
		const utterance = mockSpeak.mock.calls[0][0] as MockUtterance;
		utterance.trigger('end');
		expect(onEnd).toHaveBeenCalledOnce();
	});

	it('calls onEnd when utterance fires error event', () => {
		const onEnd = vi.fn();
		speak('hello', onEnd);
		const utterance = mockSpeak.mock.calls[0][0] as MockUtterance;
		utterance.trigger('error');
		expect(onEnd).toHaveBeenCalledOnce();
	});

	it('stopSpeaking calls speechSynthesis.cancel', () => {
		stopSpeaking();
		expect(mockCancel).toHaveBeenCalledOnce();
	});

	it('isSpeaking returns true after speak and false after stop', () => {
		speak('hello');
		expect(isSpeaking()).toBe(true);
		stopSpeaking();
		expect(isSpeaking()).toBe(false);
	});

	it('isSpeaking returns false after utterance ends naturally', () => {
		speak('hello');
		const utterance = mockSpeak.mock.calls[0][0] as MockUtterance;
		utterance.trigger('end');
		expect(isSpeaking()).toBe(false);
	});

	it('does not speak blank text', () => {
		speak('   ');
		expect(mockSpeak).not.toHaveBeenCalled();
	});
});
