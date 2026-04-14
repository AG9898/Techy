<script lang="ts">
	import type { PageData } from './$types.js';
	import { canSpeak, speak, stopSpeaking, extractHtmlText } from '$lib/client/speech.js';

	let { data }: { data: PageData } = $props();

	let speechSupported = $state(false);
	let isPlaying = $state(false);

	$effect(() => {
		speechSupported = canSpeak();
		return () => {
			stopSpeaking();
		};
	});

	function handleReadAloud() {
		if (isPlaying) {
			stopSpeaking();
			isPlaying = false;
		} else {
			const text = extractHtmlText(data.htmlBody);
			isPlaying = true;
			speak(text, () => {
				isPlaying = false;
			});
		}
	}
</script>

<div class="note-detail">
	<div class="note-header">
		<a href="/notes" class="back-link">← Notes</a>
		<div class="header-actions">
			<span class="status-badge" data-status={data.note.status}>{data.note.status}</span>
			<a href="/notes/{data.note.slug}/history" class="btn-secondary">History</a>
			<a href="/notes/{data.note.slug}/edit" class="btn-secondary">Edit</a>
			{#if speechSupported}
				<button
					class="btn-secondary btn-read-aloud"
					class:playing={isPlaying}
					onclick={handleReadAloud}
					aria-pressed={isPlaying}
					title={isPlaying ? 'Stop reading' : 'Read note aloud'}
				>
					{isPlaying ? 'Stop' : 'Read'}
				</button>
			{/if}
		</div>
	</div>

	<h1>{data.note.title}</h1>

	<div class="note-meta">
		{#if data.note.category}
			<span class="meta-category">{data.note.category}</span>
		{/if}
		{#each data.note.tags as tag}
			<span class="meta-tag">{tag}</span>
		{/each}
		{#if data.note.aiGenerated}
			<span class="meta-ai" title={data.note.aiModel ?? ''}>AI Generated</span>
		{/if}
		<span class="meta-date">{new Date(data.note.createdAt).toLocaleDateString()}</span>
	</div>

	<article class="note-body">
		{@html data.htmlBody}
	</article>

	{#if data.outgoing.length > 0 || data.incoming.length > 0}
		<div class="note-relations">
			{#if data.outgoing.length > 0}
				<div class="relations-group">
					<p class="relations-label">Links to</p>
					<ul class="relations-list">
						{#each data.outgoing as linked}
							<li><a href="/notes/{linked.slug}">{linked.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if data.incoming.length > 0}
				<div class="relations-group">
					<p class="relations-label">Linked from</p>
					<ul class="relations-list">
						{#each data.incoming as linked}
							<li><a href="/notes/{linked.slug}">{linked.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.note-detail {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.back-link {
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}
	.back-link:hover {
		color: var(--text-secondary);
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.status-badge {
		font-size: 0.72rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.status-badge[data-status='stub'] {
		background: color-mix(in srgb, var(--graph-node-stub) 15%, transparent);
		color: var(--graph-node-stub);
	}
	.status-badge[data-status='growing'] {
		background: color-mix(in srgb, var(--graph-node-growing) 15%, transparent);
		color: var(--graph-node-growing);
	}
	.status-badge[data-status='mature'] {
		background: color-mix(in srgb, var(--graph-node-mature) 15%, transparent);
		color: var(--graph-node-mature);
	}
	.btn-secondary {
		padding: 0.3rem 0.8rem;
		background: var(--bg-surface);
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.82rem;
		transition: color 0.15s, border-color 0.15s;
	}
	.btn-secondary:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}
	.btn-read-aloud {
		cursor: pointer;
		font-family: inherit;
	}
	.btn-read-aloud.playing {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}
	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.3;
		margin: 0;
	}
	.note-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-soft);
	}
	.meta-category {
		font-size: 0.75rem;
		padding: 0.15rem 0.55rem;
		background: color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface));
		color: var(--accent-primary);
		border-radius: 4px;
		font-weight: 500;
	}
	.meta-tag {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		background: var(--bg-raised);
		color: var(--text-muted);
		border-radius: 4px;
	}
	.meta-ai {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		background: color-mix(in srgb, var(--accent-purple) 15%, transparent);
		color: var(--accent-purple);
		border-radius: 4px;
	}
	.meta-date {
		font-size: 0.72rem;
		color: var(--text-subtle);
		margin-left: 0.15rem;
	}
	.note-body {
		line-height: 1.75;
		color: var(--text-secondary);
		font-size: 0.92rem;
	}
	.note-body :global(h1),
	.note-body :global(h2),
	.note-body :global(h3) {
		color: var(--text-primary);
		margin: 1.75rem 0 0.6rem;
		line-height: 1.4;
	}
	.note-body :global(h2) {
		font-size: 1.15rem;
	}
	.note-body :global(h3) {
		font-size: 1rem;
	}
	.note-body :global(p) {
		margin-bottom: 1rem;
	}
	.note-body :global(code) {
		background: var(--bg-raised);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.85em;
		color: var(--text-primary);
	}
	.note-body :global(pre) {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		padding: 1rem 1.25rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}
	.note-body :global(pre code) {
		background: transparent;
		padding: 0;
	}
	.note-body :global(ul),
	.note-body :global(ol) {
		margin: 0.5rem 0 1rem 1.5rem;
	}
	.note-body :global(blockquote) {
		border-left: 3px solid var(--border-strong);
		padding-left: 1rem;
		margin: 1rem 0;
		color: var(--text-muted);
	}
	.note-relations {
		border-top: 1px solid var(--border-soft);
		padding-top: 1.25rem;
		display: flex;
		gap: 2.5rem;
		flex-wrap: wrap;
	}
	.relations-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 0 0 0.5rem;
		font-weight: 500;
	}
	.relations-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.relations-list a {
		font-size: 0.88rem;
		color: var(--accent-primary);
		text-decoration: none;
	}
	.relations-list a:hover {
		text-decoration: underline;
	}
</style>
