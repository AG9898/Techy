<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	type GraphNode = {
		id: string;
		slug: string;
		title: string;
		status: string;
		category: string | null;
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
	};
	type GraphLink = { source: string | GraphNode; target: string | GraphNode };

	let { nodes, links }: { nodes: GraphNode[]; links: GraphLink[] } = $props();

	let container: HTMLDivElement;

	const statusColor: Record<string, string> = {
		stub: 'var(--graph-node-stub)',
		growing: 'var(--graph-node-growing)',
		mature: 'var(--graph-node-mature)'
	};
	const UNCATEGORIZED_COLOR = 'var(--text-muted)';
	const DIMMED_NODE_OPACITY = 0.16;
	const DIMMED_LABEL_OPACITY = 0.12;
	const DIMMED_LINK_OPACITY = 0.08;
	const PRESERVED_NEIGHBOR_OPACITY = 0.9;
	const PRESERVED_LINK_OPACITY = 0.78;

	// Stable category colour palette (tailwind-400 range, works on dark/light)
	const CATEGORY_PALETTE = [
		'#7dd3fc', // sky
		'#86efac', // mint
		'#fcd34d', // amber
		'#fda4af', // rose
		'#c084fc', // purple
		'#fb923c', // orange
		'#2dd4bf', // teal
		'#818cf8' //  indigo
	];

	// Unique filter values derived from node data
	let categories = $derived(
		[...new Set(nodes.map((n) => n.category).filter((c): c is string => c !== null))].sort()
	);
	let statuses = $derived([...new Set(nodes.map((n) => n.status))].sort());

	// Stable category→colour map (sorted so same set always produces same assignment)
	let categoryColorMap = $derived(
		Object.fromEntries(
			categories.map((cat, i) => [cat, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]])
		)
	);

	// Graph settings persistence
	const STORAGE_KEY = 'techy:graph-settings';

	const DEFAULT_SETTINGS = {
		colorMode: 'category' as 'status' | 'category',
		hiddenCategories: [] as string[],
		hiddenStatuses: [] as string[],
		nodeScale: 1,
		linkThickness: 1.5,
		textFadeThreshold: 0.95,
		linkDistance: 80,
		chargeStrength: 200,
		collisionPadding: 5,
		centeringStrength: 0.08,
		velocityDecay: 0.4,
		alphaDecay: 0.0228
	};

	function clampNumber(
		value: unknown,
		min: number,
		max: number,
		fallback: number
	): number {
		return typeof value === 'number' && Number.isFinite(value)
			? Math.max(min, Math.min(max, value))
			: fallback;
	}

	function loadGraphSettings(): typeof DEFAULT_SETTINGS {
		if (!browser) return { ...DEFAULT_SETTINGS };
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return { ...DEFAULT_SETTINGS };
			const p = JSON.parse(raw) as Record<string, unknown>;
			return {
				colorMode:
					p.colorMode === 'status' || p.colorMode === 'category'
						? (p.colorMode as 'status' | 'category')
						: DEFAULT_SETTINGS.colorMode,
				hiddenCategories:
					Array.isArray(p.hiddenCategories) &&
					(p.hiddenCategories as unknown[]).every((x) => typeof x === 'string')
						? (p.hiddenCategories as string[])
						: DEFAULT_SETTINGS.hiddenCategories,
				hiddenStatuses:
					Array.isArray(p.hiddenStatuses) &&
					(p.hiddenStatuses as unknown[]).every((x) => typeof x === 'string')
						? (p.hiddenStatuses as string[])
						: DEFAULT_SETTINGS.hiddenStatuses,
				nodeScale: clampNumber(p.nodeScale, 0.6, 2.4, DEFAULT_SETTINGS.nodeScale),
				linkThickness: clampNumber(
					p.linkThickness,
					1,
					6,
					DEFAULT_SETTINGS.linkThickness
				),
				textFadeThreshold: clampNumber(
					p.textFadeThreshold,
					0.4,
					2.2,
					DEFAULT_SETTINGS.textFadeThreshold
				),
				linkDistance: clampNumber(p.linkDistance, 30, 300, DEFAULT_SETTINGS.linkDistance),
				chargeStrength: clampNumber(
					p.chargeStrength,
					50,
					600,
					DEFAULT_SETTINGS.chargeStrength
				),
				collisionPadding: clampNumber(
					p.collisionPadding,
					0,
					30,
					DEFAULT_SETTINGS.collisionPadding
				),
				centeringStrength: clampNumber(
					p.centeringStrength,
					0,
					0.3,
					DEFAULT_SETTINGS.centeringStrength
				),
				velocityDecay: clampNumber(
					p.velocityDecay,
					0.1,
					0.9,
					DEFAULT_SETTINGS.velocityDecay
				),
				alphaDecay: clampNumber(p.alphaDecay, 0.005, 0.1, DEFAULT_SETTINGS.alphaDecay)
			};
		} catch {
			return { ...DEFAULT_SETTINGS };
		}
	}

	const _init = loadGraphSettings();

	// Controls panel state (transient — not persisted)
	let controlsOpen = $state(false);

	// Colour mode toggle
	let colorMode = $state<'status' | 'category'>(_init.colorMode);

	// Filter state
	let hiddenCategories = $state<string[]>(_init.hiddenCategories);
	let hiddenStatuses = $state<string[]>(_init.hiddenStatuses);

	// Appearance state
	let nodeScale = $state(_init.nodeScale);
	let linkThickness = $state(_init.linkThickness);
	let textFadeThreshold = $state(_init.textFadeThreshold);

	// Physics state
	let linkDistance = $state(_init.linkDistance);
	let chargeStrength = $state(_init.chargeStrength); // user-facing positive; applied as negative internally
	let collisionPadding = $state(_init.collisionPadding);
	let centeringStrength = $state(_init.centeringStrength);
	let velocityDecay = $state(_init.velocityDecay);
	let alphaDecay = $state(_init.alphaDecay);
	let zoomScale = $state(1);
	let focusedNodeId = $state<string | null>(null);

	// D3 selections — assigned in onMount, read in $effect
	let nodeSelection: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
	let linkSelection: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null = null;
	let linkHitSelection: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null =
		null;
	let labelSelection: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null = null;

	// Simulation refs for live physics tuning
	let simRef: d3.Simulation<GraphNode, GraphLink> | null = null;
	let linkForceRef: d3.ForceLink<GraphNode, GraphLink> | null = null;
	let chargeForceRef: d3.ForceManyBody<GraphNode> | null = null;
	let centerXForceRef: d3.ForceX<GraphNode> | null = null;
	let centerYForceRef: d3.ForceY<GraphNode> | null = null;

	// Degree map for node radius — populated in onMount
	let degreeMap: Map<string, number> = new Map();
	let nodeMap: Map<string, GraphNode> = new Map();
	let neighborMap: Map<string, Set<string>> = new Map();

	function getBaseRadius(id: string): number {
		const degree = degreeMap.get(id) ?? 0;
		return Math.max(6, Math.min(20, 6 + Math.sqrt(degree) * 2));
	}

	function getRadius(id: string): number {
		return getBaseRadius(id) * nodeScale;
	}

	function getNodeId(node: string | GraphNode): string {
		return typeof node === 'string' ? node : node.id;
	}

	function getNodeFill(
		node: GraphNode,
		mode: 'status' | 'category',
		catMap: Record<string, string>
	): string {
		if (mode === 'category') {
			return node.category ? (catMap[node.category] ?? UNCATEGORIZED_COLOR) : UNCATEGORIZED_COLOR;
		}
		return statusColor[node.status] ?? 'var(--graph-node-stub)';
	}

	function getHighlightedNeighborIds(focusedId: string | null): Set<string> {
		if (!focusedId) return new Set();
		const focusedNode = nodeMap.get(focusedId);
		if (!focusedNode) return new Set();
		const highlighted = new Set<string>();
		const focusedCategory = focusedNode.category;
		for (const neighborId of neighborMap.get(focusedId) ?? []) {
			const neighbor = nodeMap.get(neighborId);
			if (neighbor && neighbor.category === focusedCategory) {
				highlighted.add(neighborId);
			}
		}
		return highlighted;
	}

	function isEmphasizedLink(
		link: GraphLink,
		focusedId: string | null,
		highlightedNeighborIds: Set<string>
	): boolean {
		if (!focusedId) return true;
		const sourceId = getNodeId(link.source);
		const targetId = getNodeId(link.target);
		return (
			(sourceId === focusedId && highlightedNeighborIds.has(targetId)) ||
			(targetId === focusedId && highlightedNeighborIds.has(sourceId))
		);
	}

	function applyVisualState() {
		if (!nodeSelection || !labelSelection || !linkSelection || !linkHitSelection) return;

		const mode = colorMode;
		const catMap = categoryColorMap;
		const baseLabelOpacity = getLabelOpacity(zoomScale, textFadeThreshold);
		const focusedId = focusedNodeId;
		const highlightedNeighborIds = getHighlightedNeighborIds(focusedId);
		const focusActive = focusedId !== null;

		nodeSelection
			.select('circle')
			.attr('fill', (d: GraphNode) => getNodeFill(d, mode, catMap))
			.attr('r', (d: GraphNode) => getRadius(d.id) + (d.id === focusedId ? 3 : 0))
			.attr('opacity', (d: GraphNode) => {
				if (!focusActive || d.id === focusedId) return 1;
				return highlightedNeighborIds.has(d.id) ? PRESERVED_NEIGHBOR_OPACITY : DIMMED_NODE_OPACITY;
			})
			.attr('stroke', (d: GraphNode) =>
				d.id === focusedId ? 'var(--graph-focus)' : 'var(--bg-surface)'
			)
			.attr('stroke-width', (d: GraphNode) => (d.id === focusedId ? 2.5 : 2));

		labelSelection.attr('opacity', (d: GraphNode) => {
			if (!focusActive || d.id === focusedId) return baseLabelOpacity;
			return highlightedNeighborIds.has(d.id)
				? baseLabelOpacity * PRESERVED_NEIGHBOR_OPACITY
				: baseLabelOpacity * DIMMED_LABEL_OPACITY;
		});

		linkSelection.attr('opacity', (d: GraphLink) =>
			!focusActive
				? 1
				: isEmphasizedLink(d, focusedId, highlightedNeighborIds)
					? PRESERVED_LINK_OPACITY
					: DIMMED_LINK_OPACITY
		);

		linkHitSelection
			.attr('opacity', 1)
			.attr('pointer-events', (d: GraphLink) =>
				focusActive && !isEmphasizedLink(d, focusedId, highlightedNeighborIds) ? 'none' : 'stroke'
			);
	}

	function getLabelOpacity(scale: number, threshold: number): number {
		const fadeWindow = 0.3;
		if (scale >= threshold) return 1;
		if (scale <= threshold - fadeWindow) return 0;
		return (scale - (threshold - fadeWindow)) / fadeWindow;
	}

	// Edge drilldown state
	let selectedEdge = $state<{ source: GraphNode; target: GraphNode } | null>(null);

	function toggleCategory(cat: string) {
		if (hiddenCategories.includes(cat)) {
			hiddenCategories = hiddenCategories.filter((c) => c !== cat);
		} else {
			hiddenCategories = [...hiddenCategories, cat];
		}
	}

	function toggleStatus(status: string) {
		if (hiddenStatuses.includes(status)) {
			hiddenStatuses = hiddenStatuses.filter((s) => s !== status);
		} else {
			hiddenStatuses = [...hiddenStatuses, status];
		}
	}

	function edgeHidden(d: GraphLink, hc: string[], hs: string[]): boolean {
		const src = d.source as GraphNode;
		const tgt = d.target as GraphNode;
		const srcCat = src.category ?? '';
		const tgtCat = tgt.category ?? '';
		return (
			((srcCat && hc.includes(srcCat)) || hs.includes(src.status)) ||
			((tgtCat && hc.includes(tgtCat)) || hs.includes(tgt.status))
		);
	}

	function applyFilters(hc: string[], hs: string[]) {
		if (!nodeSelection || !linkSelection) return;

		nodeSelection.attr('display', (d) => {
			const cat = d.category ?? '';
			if ((cat && hc.includes(cat)) || hs.includes(d.status)) return 'none';
			return null;
		});

		linkSelection.attr('display', (d) => (edgeHidden(d, hc, hs) ? 'none' : null));
		linkHitSelection?.attr('display', (d) => (edgeHidden(d, hc, hs) ? 'none' : null));
	}

	$effect(() => {
		applyFilters(hiddenCategories, hiddenStatuses);
	});

	$effect(() => {
		colorMode;
		categoryColorMap;
		nodeScale;
		zoomScale;
		textFadeThreshold;
		focusedNodeId;
		applyVisualState();
	});

	$effect(() => {
		nodeScale;
		if (!simRef) return;
		simRef.force('collision', d3.forceCollide<GraphNode>((n) => getRadius(n.id) + collisionPadding));
		simRef.alpha(0.18).restart();
	});

	$effect(() => {
		const thickness = linkThickness;
		linkSelection?.attr('stroke-width', thickness);
		linkHitSelection?.attr('stroke-width', Math.max(12, thickness + 8));
	});

	// Physics tuning — reads reactive state before guard so tracking is established on first run
	$effect(() => {
		const d = linkDistance;
		const s = chargeStrength;
		const cp = collisionPadding;
		const cs = centeringStrength;
		const vd = velocityDecay;
		const ad = alphaDecay;
		if (!simRef || !linkForceRef || !chargeForceRef || !centerXForceRef || !centerYForceRef) return;
		linkForceRef.distance(d);
		chargeForceRef.strength(-s);
		centerXForceRef.strength(cs);
		centerYForceRef.strength(cs);
		simRef.force('collision', d3.forceCollide<GraphNode>((n) => getRadius(n.id) + cp));
		simRef.velocityDecay(vd);
		simRef.alphaDecay(ad);
		simRef.alpha(0.3).restart();
	});

	// Persist settings to localStorage whenever they change
	$effect(() => {
		if (!browser) return;
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				colorMode,
				hiddenCategories,
				hiddenStatuses,
				nodeScale,
				linkThickness,
				textFadeThreshold,
				linkDistance,
				chargeStrength,
				collisionPadding,
				centeringStrength,
				velocityDecay,
				alphaDecay
			})
		);
	});

	let activeFilters = $derived(hiddenCategories.length + hiddenStatuses.length);

	function resetDefaults() {
		colorMode = DEFAULT_SETTINGS.colorMode;
		hiddenCategories = [...DEFAULT_SETTINGS.hiddenCategories];
		hiddenStatuses = [...DEFAULT_SETTINGS.hiddenStatuses];
		nodeScale = DEFAULT_SETTINGS.nodeScale;
		linkThickness = DEFAULT_SETTINGS.linkThickness;
		textFadeThreshold = DEFAULT_SETTINGS.textFadeThreshold;
		linkDistance = DEFAULT_SETTINGS.linkDistance;
		chargeStrength = DEFAULT_SETTINGS.chargeStrength;
		collisionPadding = DEFAULT_SETTINGS.collisionPadding;
		centeringStrength = DEFAULT_SETTINGS.centeringStrength;
		velocityDecay = DEFAULT_SETTINGS.velocityDecay;
		alphaDecay = DEFAULT_SETTINGS.alphaDecay;
	}

	onMount(() => {
		const width = container.clientWidth || 800;
		const height = container.clientHeight || 600;

		// Compute degree (incoming + outgoing) for each node from link props
		degreeMap = new Map<string, number>();
		nodeMap = new Map();
		neighborMap = new Map();
		for (const n of nodes) degreeMap.set(n.id, 0);
		for (const l of links) {
			const src = getNodeId(l.source);
			const tgt = getNodeId(l.target);
			degreeMap.set(src, (degreeMap.get(src) ?? 0) + 1);
			degreeMap.set(tgt, (degreeMap.get(tgt) ?? 0) + 1);
			if (!neighborMap.has(src)) neighborMap.set(src, new Set());
			if (!neighborMap.has(tgt)) neighborMap.set(tgt, new Set());
			neighborMap.get(src)?.add(tgt);
			neighborMap.get(tgt)?.add(src);
		}

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', `0 0 ${width} ${height}`);

		// Arrow marker
		svg
			.append('defs')
			.append('marker')
			.attr('id', 'arrow')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 20)
			.attr('refY', 0)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-5L10,0L0,5')
			.attr('fill', 'var(--text-subtle)');

		const g = svg.append('g');

		// Pan + zoom
		svg.call(
			d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.1, 4])
				.on('zoom', (event) => {
					g.attr('transform', event.transform);
					zoomScale = event.transform.k;
				})
		);

		// Close edge drilldown on SVG background click
		svg.on('click', () => {
			selectedEdge = null;
		});

		// Deep-copy nodes/links so D3 can mutate them
		const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
		const simLinks: GraphLink[] = links.map((l) => ({ ...l }));
		nodeMap = new Map(simNodes.map((node) => [node.id, node]));

		const linkForce = d3
			.forceLink<GraphNode, GraphLink>(simLinks)
			.id((d) => d.id)
			.distance(linkDistance);

		const chargeForce = d3.forceManyBody<GraphNode>().strength(-chargeStrength);
		const centerXForce = d3.forceX<GraphNode>(width / 2).strength(centeringStrength);
		const centerYForce = d3.forceY<GraphNode>(height / 2).strength(centeringStrength);

		const simulation = d3
			.forceSimulation<GraphNode>(simNodes)
			.force('link', linkForce)
			.force('charge', chargeForce)
			.force('x', centerXForce)
			.force('y', centerYForce)
			.force('collision', d3.forceCollide<GraphNode>((d) => getRadius(d.id) + collisionPadding));

		simRef = simulation;
		linkForceRef = linkForce;
		chargeForceRef = chargeForce;
		centerXForceRef = centerXForce;
		centerYForceRef = centerYForce;

		linkSelection = g
			.append('g')
			.selectAll<SVGLineElement, GraphLink>('line')
			.data(simLinks)
			.join('line')
			.attr('stroke', 'var(--graph-link)')
			.attr('stroke-width', linkThickness)
			.attr('stroke-linecap', 'round')
			.attr('marker-end', 'url(#arrow)');

		// Wider transparent hit zones for edge clicks
		linkHitSelection = g
			.append('g')
			.selectAll<SVGLineElement, GraphLink>('line')
			.data(simLinks)
			.join('line')
			.attr('stroke', 'transparent')
			.attr('stroke-width', Math.max(12, linkThickness + 8))
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				selectedEdge = {
					source: d.source as GraphNode,
					target: d.target as GraphNode
				};
			});

		nodeSelection = g
			.append('g')
			.selectAll<SVGGElement, GraphNode>('g')
			.data(simNodes)
			.join('g')
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				goto(`/notes/${d.slug}`);
			})
			.on('mouseenter', (_, d) => {
				focusedNodeId = d.id;
			})
			.on('mouseleave', () => {
				focusedNodeId = null;
			})
			.call(
				d3
					.drag<SVGGElement, GraphNode>()
					.on('start', (event, d) => {
						if (!event.active) simulation.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on('drag', (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on('end', (event, d) => {
						if (!event.active) simulation.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					})
			);

		nodeSelection
			.append('circle')
			.attr('r', (d) => getRadius(d.id))
			.attr('fill', (d) => getNodeFill(d, colorMode, categoryColorMap))
			.attr('stroke', 'var(--bg-surface)')
			.attr('stroke-width', 2);

		nodeSelection
			.append('text')
			.text((d) => d.title)
			.attr('x', 14)
			.attr('y', 4)
			.attr('font-size', '11px')
			.attr('fill', 'var(--text-secondary)')
			.attr('opacity', getLabelOpacity(zoomScale, textFadeThreshold))
			.attr('pointer-events', 'none');

		labelSelection = nodeSelection.select<SVGTextElement>('text');
		applyFilters(hiddenCategories, hiddenStatuses);
		applyVisualState();

		nodeSelection.append('title').text((d) => `${d.title} [${d.status}]`);

		simulation.on('tick', () => {
			linkSelection!
				.attr('x1', (d) => (d.source as GraphNode).x ?? 0)
				.attr('y1', (d) => (d.source as GraphNode).y ?? 0)
				.attr('x2', (d) => (d.target as GraphNode).x ?? 0)
				.attr('y2', (d) => (d.target as GraphNode).y ?? 0);

			linkHitSelection!
				.attr('x1', (d) => (d.source as GraphNode).x ?? 0)
				.attr('y1', (d) => (d.source as GraphNode).y ?? 0)
				.attr('x2', (d) => (d.target as GraphNode).x ?? 0)
				.attr('y2', (d) => (d.target as GraphNode).y ?? 0);

			nodeSelection!.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});

		return () => simulation.stop();
	});
</script>

<div bind:this={container} class="graph-container">
	{#if selectedEdge}
		<div class="edge-drilldown">
			<div class="edge-drilldown-header">
				<span class="edge-drilldown-label">Connection</span>
				<button class="edge-close-btn" onclick={() => (selectedEdge = null)}>×</button>
			</div>
			<div class="edge-notes">
				<a href="/notes/{selectedEdge.source.slug}" class="edge-note-link">
					<span
						class="edge-note-dot"
						style="background: {getNodeFill(selectedEdge.source, colorMode, categoryColorMap)}"
					></span>
					{selectedEdge.source.title}
				</a>
				<span class="edge-connector">→</span>
				<a href="/notes/{selectedEdge.target.slug}" class="edge-note-link">
					<span
						class="edge-note-dot"
						style="background: {getNodeFill(selectedEdge.target, colorMode, categoryColorMap)}"
					></span>
					{selectedEdge.target.title}
				</a>
			</div>
		</div>
	{/if}

	<!-- Unified graph controls dock — bottom-right -->
	<div class="controls-dock">
		{#if controlsOpen}
			<div class="controls-panel">
				<!-- Appearance -->
				<div class="panel-section">
					<div class="panel-section-label">Appearance</div>
					<div class="colour-mode-row">
						<button
							class="mode-btn"
							class:active={colorMode === 'status'}
							onclick={() => (colorMode = 'status')}
						>Status</button>
						<button
							class="mode-btn"
							class:active={colorMode === 'category'}
							onclick={() => (colorMode = 'category')}
						>Category</button>
					</div>
					<div class="legend-items">
						{#if colorMode === 'status'}
							{#each ['stub', 'growing', 'mature'] as s}
								<span class="legend-item">
									<span class="legend-dot" style="background: {statusColor[s]}"></span>
									<span>{s}</span>
								</span>
							{/each}
						{:else if categories.length === 0}
							<span class="legend-empty">No categories</span>
						{:else}
							{#each categories as cat}
								<span class="legend-item">
									<span class="legend-dot" style="background: {categoryColorMap[cat]}"></span>
									<span>{cat}</span>
								</span>
							{/each}
						{/if}
					</div>
					<div class="size-hint-row">
						<span class="size-hint-bubbles">
							<span class="size-bubble small"></span>
							<span class="size-bubble large"></span>
						</span>
						<span>size = link count</span>
					</div>
					<div class="setting-row">
						<div class="setting-copy">
							<span class="setting-label">Node scale</span>
							<span class="setting-help">Multiplier on degree-based sizing</span>
						</div>
						<input
							type="range"
							min="0.6"
							max="2.4"
							step="0.05"
							bind:value={nodeScale}
							class="physics-slider"
						/>
						<span class="physics-val">{nodeScale.toFixed(2)}x</span>
					</div>
					<div class="setting-row">
						<div class="setting-copy">
							<span class="setting-label">Link thickness</span>
							<span class="setting-help">Visible edge stroke only</span>
						</div>
						<input
							type="range"
							min="1"
							max="6"
							step="0.25"
							bind:value={linkThickness}
							class="physics-slider"
						/>
						<span class="physics-val">{linkThickness.toFixed(2)}</span>
					</div>
					<div class="setting-row">
						<div class="setting-copy">
							<span class="setting-label">Text fade</span>
							<span class="setting-help">Zoom level where labels fully appear</span>
						</div>
						<input
							type="range"
							min="0.4"
							max="2.2"
							step="0.05"
							bind:value={textFadeThreshold}
							class="physics-slider"
						/>
						<span class="physics-val">{textFadeThreshold.toFixed(2)}x</span>
					</div>
				</div>

				<div class="panel-divider"></div>

				<!-- Filters -->
				{#if categories.length > 0 || statuses.length > 0}
					<div class="panel-section">
						<div class="panel-section-label">
							Filters
							{#if activeFilters > 0}
								<span class="filter-badge">{activeFilters}</span>
							{/if}
						</div>
						{#if categories.length > 0}
							<div class="filter-group-label">Category</div>
							{#each categories as cat}
								<label class="filter-item">
									<input
										type="checkbox"
										checked={!hiddenCategories.includes(cat)}
										onchange={() => toggleCategory(cat)}
									/>
									<span class="legend-dot" style="background: {categoryColorMap[cat]}"></span>
									<span>{cat}</span>
								</label>
							{/each}
						{/if}
						{#if statuses.length > 0}
							<div class="filter-group-label">Status</div>
							{#each statuses as status}
								<label class="filter-item">
									<input
										type="checkbox"
										checked={!hiddenStatuses.includes(status)}
										onchange={() => toggleStatus(status)}
									/>
									<span
										class="legend-dot"
										style="background: {statusColor[status] ?? 'var(--graph-node-stub)'}"
									></span>
									<span>{status}</span>
								</label>
							{/each}
						{/if}
					</div>

					<div class="panel-divider"></div>
				{/if}

				<!-- Physics -->
				<div class="panel-section">
					<div class="panel-section-label">Physics</div>
					<div class="physics-row">
						<span class="physics-label">Link distance</span>
						<input
							type="range"
							min="30"
							max="300"
							step="10"
							bind:value={linkDistance}
							class="physics-slider"
						/>
						<span class="physics-val">{linkDistance}</span>
					</div>
					<div class="physics-row">
						<span class="physics-label">Repulsion</span>
						<input
							type="range"
							min="50"
							max="600"
							step="10"
							bind:value={chargeStrength}
							class="physics-slider"
						/>
						<span class="physics-val">{chargeStrength}</span>
					</div>
					<div class="physics-row">
						<span class="physics-label">Collision</span>
						<input
							type="range"
							min="0"
							max="30"
							step="1"
							bind:value={collisionPadding}
							class="physics-slider"
						/>
						<span class="physics-val">{collisionPadding}</span>
					</div>
					<div class="physics-row">
						<span class="physics-label">Centering</span>
						<input
							type="range"
							min="0"
							max="0.3"
							step="0.01"
							bind:value={centeringStrength}
							class="physics-slider"
						/>
						<span class="physics-val">{centeringStrength.toFixed(2)}</span>
					</div>
					<div class="physics-row">
						<span class="physics-label">Velocity decay</span>
						<input
							type="range"
							min="0.1"
							max="0.9"
							step="0.01"
							bind:value={velocityDecay}
							class="physics-slider"
						/>
						<span class="physics-val">{velocityDecay.toFixed(2)}</span>
					</div>
					<div class="physics-row">
						<span class="physics-label">Alpha decay</span>
						<input
							type="range"
							min="0.005"
							max="0.1"
							step="0.001"
							bind:value={alphaDecay}
							class="physics-slider"
						/>
						<span class="physics-val">{alphaDecay.toFixed(3)}</span>
					</div>
				</div>

				<div class="panel-divider"></div>

				<button class="reset-btn" onclick={resetDefaults}>Reset to defaults</button>
			</div>
		{/if}

		<button
			class="controls-trigger"
			class:open={controlsOpen}
			class:has-filters={activeFilters > 0}
			onclick={() => (controlsOpen = !controlsOpen)}
		>
			<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
				<line x1="0" y1="1.5" x2="12" y2="1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
				<circle cx="4" cy="1.5" r="1.5" fill="var(--bg-overlay)" stroke="currentColor" stroke-width="1.25"/>
				<line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
				<circle cx="8" cy="5" r="1.5" fill="var(--bg-overlay)" stroke="currentColor" stroke-width="1.25"/>
				<line x1="0" y1="8.5" x2="12" y2="8.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
				<circle cx="3" cy="8.5" r="1.5" fill="var(--bg-overlay)" stroke="currentColor" stroke-width="1.25"/>
			</svg>
			Graph controls
			{#if activeFilters > 0}
				<span class="trigger-badge">{activeFilters}</span>
			{/if}
		</button>
	</div>
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg-base);
	}

	/* Edge drilldown panel — bottom-center */
	.edge-drilldown {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.65rem 1rem;
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		z-index: 10;
	}

	.edge-drilldown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.edge-drilldown-label {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.edge-close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		line-height: 1;
		font-size: 1rem;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.edge-close-btn:hover {
		color: var(--text-secondary);
		background: var(--bg-raised);
	}

	.edge-notes {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.edge-note-link {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		color: var(--text-primary);
		text-decoration: none;
		padding: 0.2rem 0.5rem;
		border-radius: 0.4rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		transition: border-color 120ms, color 120ms;
	}

	.edge-note-link:hover {
		color: var(--accent-primary);
		border-color: var(--border-strong);
	}

	.edge-note-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.edge-connector {
		font-size: 0.75rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	/* Controls dock — bottom-right */
	.controls-dock {
		position: absolute;
		bottom: 1.5rem;
		right: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.4rem;
		z-index: 10;
	}

	.controls-trigger {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.35rem 0.75rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		backdrop-filter: blur(6px);
		transition: border-color 150ms, color 150ms;
		letter-spacing: 0.01em;
	}

	.controls-trigger:hover,
	.controls-trigger.open {
		border-color: var(--border-strong);
		color: var(--text-secondary);
	}

	.controls-trigger.has-filters {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.trigger-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		border-radius: 8px;
		padding: 0 3px;
		background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
		color: var(--accent-primary);
		font-size: 0.65rem;
		font-weight: 600;
	}

	.controls-panel {
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.75rem 0.9rem;
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 292px;
		max-height: calc(100vh - 6rem);
		overflow-y: auto;
	}

	.panel-section {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.4rem 0;
	}

	.panel-section:first-child {
		padding-top: 0;
	}

	.panel-section-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.2rem;
	}

	.panel-divider {
		height: 1px;
		background: var(--border-soft);
		margin: 0.1rem 0;
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		border-radius: 8px;
		padding: 0 3px;
		background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
		color: var(--accent-primary);
		font-size: 0.6rem;
		font-weight: 700;
	}

	/* Appearance */
	.colour-mode-row {
		display: flex;
		gap: 0.2rem;
		margin-bottom: 0.2rem;
	}

	.mode-btn {
		flex: 1;
		background: none;
		border: 1px solid var(--border-soft);
		border-radius: 0.4rem;
		padding: 0.15rem 0.4rem;
		font-size: 0.68rem;
		color: var(--text-muted);
		cursor: pointer;
		letter-spacing: 0.01em;
		transition: border-color 120ms, color 120ms, background 120ms;
	}

	.mode-btn:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}

	.mode-btn.active {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
		background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
	}

	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-empty {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.size-hint-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.2rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--border-soft);
	}

	.setting-row {
		display: grid;
		grid-template-columns: minmax(0, 108px) 1fr 42px;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.35rem;
	}

	.setting-copy {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.setting-label {
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.setting-help {
		font-size: 0.62rem;
		color: var(--text-subtle);
		line-height: 1.25;
	}

	.size-hint-bubbles {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.size-bubble {
		background: var(--text-muted);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.size-bubble.small {
		width: 6px;
		height: 6px;
	}

	.size-bubble.large {
		width: 11px;
		height: 11px;
	}

	/* Filters */
	.filter-group-label {
		font-size: 0.68rem;
		color: var(--text-subtle);
		margin-top: 0.1rem;
	}

	.filter-item {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
		cursor: pointer;
		user-select: none;
	}

	.filter-item input[type='checkbox'] {
		accent-color: var(--accent-primary);
		cursor: pointer;
		width: 13px;
		height: 13px;
		flex-shrink: 0;
	}

	/* Physics */
	.physics-row {
		display: grid;
		grid-template-columns: 92px 1fr 42px;
		align-items: center;
		gap: 0.4rem;
	}

	.physics-label {
		font-size: 0.72rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.physics-slider {
		width: 100%;
		accent-color: var(--accent-primary);
		cursor: pointer;
	}

	.physics-val {
		font-size: 0.68rem;
		color: var(--text-muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* Reset */
	.reset-btn {
		background: none;
		border: 1px solid var(--border-soft);
		border-radius: 0.5rem;
		padding: 0.3rem 0.6rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		cursor: pointer;
		text-align: center;
		width: 100%;
		margin-top: 0.15rem;
		transition: border-color 120ms, color 120ms;
	}

	.reset-btn:hover {
		border-color: var(--border-strong);
		color: var(--text-secondary);
	}
</style>
