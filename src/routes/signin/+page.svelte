<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const errorMessages: Record<string, string> = {
		AccessDenied: 'This GitHub account is not authorised to access Techy.',
		OAuthSignin: 'Could not start the GitHub sign-in flow. Please try again.',
		OAuthCallback: 'GitHub returned an error during sign-in. Please try again.',
		Default: 'Something went wrong. Please try again.'
	};

	const errorMessage = $derived(
		data.error ? (errorMessages[data.error] ?? errorMessages.Default) : null
	);
</script>

<div class="signin-shell">
	<div class="signin-card">
		<div class="brand">
			<span class="logo">Techy</span>
			<p class="tagline">Your private knowledge graph</p>
		</div>

		{#if errorMessage}
			<div class="error-banner" role="alert">
				{errorMessage}
			</div>
		{/if}

		<form method="post" action="/auth/signin/github" class="signin-form">
			<input type="hidden" name="callbackUrl" value={data.callbackUrl} />
			<button type="submit" class="github-btn">
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="github-icon">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
				</svg>
				Sign in with GitHub
			</button>
		</form>
	</div>
</div>

<style>
	.signin-shell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 60px - 4rem);
	}

	.signin-card {
		width: 100%;
		max-width: 380px;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 1.5rem;
		padding: 2.75rem 2.5rem;
		box-shadow: 0 4px 32px color-mix(in srgb, var(--bg-base) 60%, transparent);
	}

	.brand {
		text-align: center;
		margin-bottom: 2rem;
	}

	.logo {
		display: block;
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--accent-primary);
		margin-bottom: 0.4rem;
	}

	.tagline {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.error-banner {
		background: color-mix(in srgb, var(--accent-red, #f87171) 12%, var(--bg-surface));
		border: 1px solid color-mix(in srgb, var(--accent-red, #f87171) 30%, transparent);
		color: var(--accent-red, #f87171);
		border-radius: 0.75rem;
		padding: 0.65rem 1rem;
		font-size: 0.82rem;
		margin-bottom: 1.25rem;
		text-align: center;
	}

	.signin-form {
		display: flex;
		flex-direction: column;
	}

	.github-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.75rem 1.5rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 0.875rem;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.github-btn:hover {
		background: color-mix(in srgb, var(--accent-primary) 8%, var(--bg-raised));
		border-color: var(--accent-primary);
	}

	.github-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
</style>
