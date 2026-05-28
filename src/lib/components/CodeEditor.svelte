<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, lineNumbers } from '@codemirror/view';
	import { EditorState, Compartment } from '@codemirror/state';
	import { defaultKeymap, indentWithTab } from '@codemirror/commands';
	import { indentUnit, bracketMatching } from '@codemirror/language';
	import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
	import { python } from '@codemirror/lang-python';
	import { javascript } from '@codemirror/lang-javascript';
	import { java } from '@codemirror/lang-java';
	import { cpp } from '@codemirror/lang-cpp';

	type SupportedLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'cpp';

	type Props = {
		value?: string;
		language?: SupportedLanguage;
		readonly?: boolean;
		onchange?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		language = 'python',
		readonly = false,
		onchange
	}: Props = $props();

	let container: HTMLDivElement;
	let view: EditorView | null = null;
	let languageCompartment = new Compartment();
	let readonlyCompartment = new Compartment();

	/** Resolve the CodeMirror language extension for a given language key. */
	function resolveLanguage(lang: SupportedLanguage) {
		switch (lang) {
			case 'python':
				return python();
			case 'javascript':
				return javascript({ jsx: false, typescript: false });
			case 'typescript':
				return javascript({ jsx: false, typescript: true });
			case 'java':
				return java();
			case 'cpp':
				return cpp();
			default:
				return python();
		}
	}

	/**
	 * Techy-palette CodeMirror theme.
	 * All values reference CSS custom properties — no hardcoded hex values.
	 * The custom properties are resolved by the browser at render time so the
	 * theme responds to data-theme / data-accent changes without rebuilding the view.
	 */
	const techyTheme = EditorView.theme(
		{
			'&': {
				background: 'var(--bg-raised)',
				color: 'var(--text-primary)',
				height: '100%',
				fontFamily: "'Space Mono', monospace",
				fontSize: '0.875rem'
			},
			'.cm-scroller': {
				overflow: 'auto',
				height: '100%'
			},
			'.cm-content': {
				caretColor: 'var(--accent-primary)',
				padding: '0.5rem 0'
			},
			'.cm-cursor': {
				borderLeftColor: 'var(--accent-primary)'
			},
			'.cm-selectionBackground': {
				background: 'var(--accent-soft) !important'
			},
			'&.cm-focused .cm-selectionBackground': {
				background: 'var(--accent-soft) !important'
			},
			'.cm-gutters': {
				background: 'var(--bg-surface)',
				color: 'var(--text-subtle)',
				border: 'none',
				borderRight: '1px solid var(--border-soft)'
			},
			'.cm-lineNumbers .cm-gutterElement': {
				paddingRight: '0.75rem',
				paddingLeft: '0.5rem',
				minWidth: '2rem',
				textAlign: 'right',
				color: 'var(--text-subtle)'
			},
			'.cm-activeLineGutter': {
				background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-surface))',
				color: 'var(--text-secondary)'
			},
			'.cm-activeLine': {
				background: 'color-mix(in srgb, var(--accent-primary) 6%, var(--bg-raised))'
			},
			'.cm-matchingBracket': {
				background: 'color-mix(in srgb, var(--accent-primary) 20%, transparent)',
				color: 'var(--text-primary) !important',
				outline: '1px solid var(--accent-primary)'
			},
			'.cm-tooltip': {
				background: 'var(--bg-overlay)',
				border: '1px solid var(--border-soft)',
				color: 'var(--text-primary)'
			},
			'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
				background: 'var(--accent-soft)',
				color: 'var(--text-primary)'
			},
			'.cm-focused': {
				outline: 'none'
			},
			'&.cm-focused': {
				outline: 'none'
			}
		},
		{ dark: true }
	);

	onMount(() => {
		const startState = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				bracketMatching(),
				closeBrackets(),
				autocompletion(),
				indentUnit.of('  '),
				keymap.of([indentWithTab, ...defaultKeymap]),
				languageCompartment.of(resolveLanguage(language)),
				readonlyCompartment.of(EditorState.readOnly.of(readonly)),
				techyTheme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newValue = update.state.doc.toString();
						value = newValue;
						onchange?.(newValue);
					}
				})
			]
		});

		view = new EditorView({
			state: startState,
			parent: container
		});
	});

	/** When the language prop changes, swap the compartment without rebuilding the view. */
	$effect(() => {
		if (view && language) {
			view.dispatch({
				effects: languageCompartment.reconfigure(resolveLanguage(language))
			});
		}
	});

	/** When the readonly prop changes, swap the compartment. */
	$effect(() => {
		if (view) {
			view.dispatch({
				effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(readonly))
			});
		}
	});

	/**
	 * Sync external value changes into the editor.
	 * Guard against the update loop: only apply if the editor's current content differs.
	 */
	$effect(() => {
		if (view && value !== view.state.doc.toString()) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value }
			});
		}
	});

	onDestroy(() => {
		view?.destroy();
		view = null;
	});
</script>

<div class="code-editor" bind:this={container}></div>

<style>
	.code-editor {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		overflow: hidden;
		background: var(--bg-raised);
	}

	.code-editor :global(.cm-editor) {
		height: 100%;
	}

	.code-editor :global(.cm-editor.cm-focused) {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
</style>
