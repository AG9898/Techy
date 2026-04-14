/**
 * Browser speech helpers — SSR-safe. No browser globals are referenced at module
 * import time. All capability checks are deferred to call time.
 */

// ─── Capability detection ─────────────────────────────────────────────────────

/** Returns true if the browser exposes SpeechSynthesis. */
export function canSpeak(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Returns true if the browser exposes a speech recognition constructor. */
export function canListen(): boolean {
	return (
		typeof window !== 'undefined' &&
		('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
	);
}

// ─── Text extraction (pure, no browser globals) ───────────────────────────────

/**
 * Strip HTML tags and decode common entities, returning plain readable text.
 * Intended for reading rendered note bodies and assistant reply HTML aloud.
 */
export function extractHtmlText(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Strip Markdown control syntax, returning plain readable text.
 * Handles headings, bold, italic, links, wikilinks, code, and list markers.
 */
export function extractMarkdownText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`\n]+`/g, ' ')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\*\*([^*\n]+)\*\*/g, '$1')
		.replace(/__([^_\n]+)__/g, '$1')
		.replace(/\*([^*\n]+)\*/g, '$1')
		.replace(/_([^_\n]+)_/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias ?? target)
		.replace(/^[-*_]{3,}\s*$/gm, '')
		.replace(/^>\s*/gm, '')
		.replace(/^[ \t]*[-*+]\s+/gm, '')
		.replace(/^[ \t]*\d+\.\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

// ─── Speech synthesis (browser-only, safe at call time) ──────────────────────

let _currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Speak the given text using browser SpeechSynthesis. Cancels any in-progress
 * speech first so only one readback is active at a time.
 * Calls `onEnd` when the utterance finishes or errors.
 * No-ops when SpeechSynthesis is unavailable or text is blank.
 */
export function speak(text: string, onEnd?: () => void): void {
	if (!canSpeak() || !text.trim()) return;

	stopSpeaking();

	const utterance = new window.SpeechSynthesisUtterance(text);
	_currentUtterance = utterance;

	const finish = () => {
		_currentUtterance = null;
		onEnd?.();
	};

	utterance.addEventListener('end', finish);
	utterance.addEventListener('error', finish);

	window.speechSynthesis.speak(utterance);
}

/**
 * Cancel the active speech synthesis utterance, if any.
 * No-ops when SpeechSynthesis is unavailable.
 */
export function stopSpeaking(): void {
	if (!canSpeak()) return;
	window.speechSynthesis.cancel();
	_currentUtterance = null;
}

/**
 * Returns true when a readback utterance is currently active.
 * Based on module-level utterance tracking; not reactive.
 * Components should track play/stop state via the `onEnd` callback.
 */
export function isSpeaking(): boolean {
	return _currentUtterance !== null;
}
