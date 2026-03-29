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
		stub: '#64748b',
		growing: '#38bdf8',
		mature: '#4ade80'
	};

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
			.attr('fill', '#475569');

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

		const link = g
			.append('g')
			.selectAll('line')
			.data(simLinks)
			.join('line')
			.attr('stroke', '#1e293b')
			.attr('stroke-width', 1.5)
			.attr('marker-end', 'url(#arrow)');

		const node = g
			.append('g')
			.selectAll<SVGGElement, GraphNode>('g')
			.data(simNodes)
			.join('g')
			.attr('cursor', 'pointer')
			.on('click', (_, d) => goto(`/notes/${d.slug}`))
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

		node
			.append('circle')
			.attr('r', 10)
			.attr('fill', (d) => statusColor[d.status] ?? '#64748b')
			.attr('stroke', '#0f172a')
			.attr('stroke-width', 2);

		node
			.append('text')
			.text((d) => d.title)
			.attr('x', 14)
			.attr('y', 4)
			.attr('font-size', '11px')
			.attr('fill', '#cbd5e1')
			.attr('pointer-events', 'none');

		node.append('title').text((d) => `${d.title} [${d.status}]`);

		simulation.on('tick', () => {
			link
				.attr('x1', (d) => (d.source as GraphNode).x ?? 0)
				.attr('y1', (d) => (d.source as GraphNode).y ?? 0)
				.attr('x2', (d) => (d.target as GraphNode).x ?? 0)
				.attr('y2', (d) => (d.target as GraphNode).y ?? 0);

			node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});

		return () => simulation.stop();
	});
</script>

<div bind:this={container} class="graph-container"></div>

<style>
	.graph-container {
		width: 100%;
		height: calc(100vh - 60px);
		overflow: hidden;
		background: #0a0f1e;
	}
</style>
