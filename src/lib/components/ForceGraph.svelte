<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { goto } from '$app/navigation';

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

	// Unique filter values derived from node data
	let categories = $derived(
		[...new Set(nodes.map((n) => n.category).filter((c): c is string => c !== null))].sort()
	);
	let statuses = $derived([...new Set(nodes.map((n) => n.status))].sort());

	// Filter state (local, not persisted)
	let hiddenCategories = $state<string[]>([]);
	let hiddenStatuses = $state<string[]>([]);
	let filterOpen = $state(false);

	// D3 selections — assigned in onMount, read in $effect
	let nodeSelection: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
	let linkSelection: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null = null;

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

	function applyFilters(hc: string[], hs: string[]) {
		if (!nodeSelection || !linkSelection) return;

		nodeSelection.attr('display', (d) => {
			const cat = d.category ?? '';
			if ((cat && hc.includes(cat)) || hs.includes(d.status)) return 'none';
			return null;
		});

		linkSelection.attr('display', (d) => {
			const src = d.source as GraphNode;
			const tgt = d.target as GraphNode;
			const srcCat = src.category ?? '';
			const tgtCat = tgt.category ?? '';
			const srcHidden = (srcCat && hc.includes(srcCat)) || hs.includes(src.status);
			const tgtHidden = (tgtCat && hc.includes(tgtCat)) || hs.includes(tgt.status);
			return srcHidden || tgtHidden ? 'none' : null;
		});
	}

	$effect(() => {
		applyFilters(hiddenCategories, hiddenStatuses);
	});

	let activeFilters = $derived(hiddenCategories.length + hiddenStatuses.length);

	onMount(() => {
		const width = container.clientWidth || 800;
		const height = container.clientHeight || 600;

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
				})
		);

		// Deep-copy nodes/links so D3 can mutate them
		const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
		const simLinks: GraphLink[] = links.map((l) => ({ ...l }));

		const simulation = d3
			.forceSimulation<GraphNode>(simNodes)
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphLink>(simLinks)
					.id((d) => d.id)
					.distance(80)
			)
			.force('charge', d3.forceManyBody().strength(-200))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide(20));

		linkSelection = g
			.append('g')
			.selectAll<SVGLineElement, GraphLink>('line')
			.data(simLinks)
			.join('line')
			.attr('stroke', 'var(--graph-link)')
			.attr('stroke-width', 1.5)
			.attr('marker-end', 'url(#arrow)');

		nodeSelection = g
			.append('g')
			.selectAll<SVGGElement, GraphNode>('g')
			.data(simNodes)
			.join('g')
			.attr('cursor', 'pointer')
			.on('click', (_, d) => goto(`/notes/${d.slug}`))
			.on('mouseenter', function () {
				d3.select(this)
					.select('circle')
					.transition()
					.duration(150)
					.attr('r', 13)
					.attr('stroke', 'var(--graph-focus)')
					.attr('stroke-width', 2.5);
			})
			.on('mouseleave', function () {
				d3.select(this)
					.select('circle')
					.transition()
					.duration(150)
					.attr('r', 10)
					.attr('stroke', 'var(--bg-surface)')
					.attr('stroke-width', 2);
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
			.attr('r', 10)
			.attr('fill', (d) => statusColor[d.status] ?? 'var(--graph-node-stub)')
			.attr('stroke', 'var(--bg-surface)')
			.attr('stroke-width', 2);

		nodeSelection
			.append('text')
			.text((d) => d.title)
			.attr('x', 14)
			.attr('y', 4)
			.attr('font-size', '11px')
			.attr('fill', 'var(--text-secondary)')
			.attr('pointer-events', 'none');

		nodeSelection.append('title').text((d) => `${d.title} [${d.status}]`);

		simulation.on('tick', () => {
			linkSelection!
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
	{#if categories.length > 0 || statuses.length > 0}
		<div class="filter-wrap">
			{#if filterOpen}
				<div class="filter-panel">
					{#if categories.length > 0}
						<div class="filter-section">
							<div class="filter-section-label">Category</div>
							{#each categories as cat}
								<label class="filter-item">
									<input
										type="checkbox"
										checked={!hiddenCategories.includes(cat)}
										onchange={() => toggleCategory(cat)}
									/>
									<span>{cat}</span>
								</label>
							{/each}
						</div>
					{/if}
					{#if statuses.length > 0}
						<div class="filter-section">
							<div class="filter-section-label">Status</div>
							{#each statuses as status}
								<label class="filter-item">
									<input
										type="checkbox"
										checked={!hiddenStatuses.includes(status)}
										onchange={() => toggleStatus(status)}
									/>
									<span
										class="status-dot"
										style="background: {statusColor[status] ?? 'var(--graph-node-stub)'}"
									></span>
									<span>{status}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			<button
				class="filter-btn"
				class:active={activeFilters > 0}
				onclick={() => (filterOpen = !filterOpen)}
			>
				{#if activeFilters > 0}
					Filters · {activeFilters}
				{:else}
					Filters
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.graph-container {
		position: relative;
		width: 100%;
		height: calc(100vh - 60px);
		overflow: hidden;
		background: var(--bg-base);
	}

	/* Filter overlay — bottom-right */
	.filter-wrap {
		position: absolute;
		bottom: 1.5rem;
		right: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.4rem;
		z-index: 10;
	}

	.filter-btn {
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.35rem 0.8rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		backdrop-filter: blur(6px);
		transition: border-color 150ms, color 150ms;
		letter-spacing: 0.01em;
	}

	.filter-btn:hover {
		border-color: var(--border-strong);
		color: var(--text-secondary);
	}

	.filter-btn.active {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.filter-panel {
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.75rem 0.9rem;
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 160px;
	}

	.filter-section {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.filter-section-label {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.1rem;
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

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
