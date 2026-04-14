import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Techy',
				short_name: 'Techy',
				description: 'Personal tech knowledge graph',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				theme_color: '#09090b',
				background_color: '#09090b',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Cache static app-shell and build assets only
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				// Do not intercept navigation for API, auth, or sign-in routes
				navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/debug\//, /^\/signin/],
				// No runtime caching — authenticated data always goes to the network
				runtimeCaching: []
			}
		})
	],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
