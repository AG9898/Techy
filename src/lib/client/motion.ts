let gsapPromise: Promise<typeof import('gsap').gsap> | null = null;

export async function loadGsap() {
	if (typeof window === 'undefined') return null;

	gsapPromise ??= import('gsap').then((module) => module.gsap);
	return gsapPromise;
}

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return true;

	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
