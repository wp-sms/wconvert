import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Node, NodeChange, Edge, NodeProps, NodeTypes } from '@xyflow/react';
import type { ReactNode, MouseEvent } from 'react';
import { JourneyMap } from '../../resources/admin/src/builder/JourneyMap';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';
import branchedFixture from '../fixtures/journey-graph-branch-groups.json';

const canvas = vi.hoisted(() => ({ fitView: vi.fn(), setViewport: vi.fn(), edgeClick: (() => {}) as (edge: Edge) => void, nodes: [] as Node[], change: (() => {}) as (changes: NodeChange[]) => void }));

vi.mock('@tisoap/react-flow-smart-edge', () => ({
  createSmartEdge: () => () => null, SmartEdgeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  Position: { Left: 'left', Right: 'right' }, MarkerType: { ArrowClosed: 'arrowclosed' },
  NodeToolbar: ({ children, isVisible }: { children: ReactNode; isVisible: boolean }) => isVisible ? <div>{children}</div> : null,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Handle: () => null, Controls: () => null, Background: () => null,
  useUpdateNodeInternals: () => () => {},
  useReactFlow: () => ({ getNodes: () => canvas.nodes, fitView: canvas.fitView, viewportInitialized: true, getViewport: () => ({ x: 10, y: 20, zoom: 0.75 }), setViewport: canvas.setViewport }), useStore: (selector: (state: { width: number; height: number; transform: number[] }) => unknown) => selector({ width: 1000, height: 700, transform: [0, 0, 1] }), useNodesInitialized: () => true,
  ReactFlow: ({ nodes, edges, nodeTypes, children, onNodesChange, onNodeClick, onEdgeClick }: { nodes: Node[]; edges: Edge[]; nodeTypes: NodeTypes; children: ReactNode; onNodesChange(changes: NodeChange[]): void; onNodeClick(event: MouseEvent, node: Node): void; onEdgeClick(event: MouseEvent, edge: Edge): void }) => {
    canvas.nodes = nodes; canvas.change = onNodesChange; canvas.edgeClick = edge => onEdgeClick({} as MouseEvent, edge);
    return <div className="react-flow">
    {nodes.map(node => { const Card = nodeTypes[node.type!]; return <div role="presentation" className="react-flow__node" data-testid="map-node" data-id={node.id} key={node.id} onClick={event => onNodeClick(event, node)}>
      <Card {...{ ...node, dragging: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, zIndex: 0 } as NodeProps} />
    </div>; })}<output data-testid="map-edges">{JSON.stringify(edges)}</output>{children}</div>;
  },
}));
beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const tree = fixture as unknown as TemplateTree;

it('labels disconnected follow-ups in both grouped and expanded maps and keeps them selectable', async () => {
  const user = userEvent.setup(), select = vi.fn();
  const changed = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === 'start' ? { ...edge, to: 'contact' } : edge) } };
  render(<JourneyMap tree={changed} selected={null} onSelect={select} onSelectPath={() => {}} onConnect={() => {}} />);
  expect(screen.getByText('Unreachable — connect an incoming path to show these screens.')).toBeInTheDocument();
  expect(screen.queryByText('Ask every match, one at a time. Skip the rest.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Garden details$/ }));
  expect(select).toHaveBeenCalledWith(tree.steps.findIndex(item => item.id === 'garden'));
  await user.click(screen.getByRole('button', { name: 'Edit individual connections' }));
  expect(screen.getAllByText('Unreachable — connect an incoming path')).toHaveLength(3);
});

it.each(['ltr', 'rtl'])('keeps card content and path arrows aligned with the %s journey', direction => {
  const originalDirection = document.documentElement.dir;
  document.documentElement.dir = direction;
  try {
    // React Flow deliberately uses LTR coordinates even within an RTL page.
    // Content must set its own direction without changing that coordinate system.
    const branched = branchedFixture as unknown as TemplateTree;
    const changed = { ...branched, graph: { ...branched.graph!, edges: branched.graph!.edges.map(edge =>
      edge.id === 'home_garden_hidden' ? { ...edge, to: 'contact' } : edge) } };
    const { container } = render(<JourneyMap tree={changed} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
    const cards = container.querySelectorAll('.wconvert-flow-node,.wconvert-followup-group');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(card => expect(card).toHaveAttribute('dir', direction));
    const arrow = direction === 'rtl' ? '←' : '→';
    expect(screen.getByRole('button', { name: `Everyone else ${arrow} Your business interests` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `When hidden ${arrow} Send one combined enquiry` })).toBeInTheDocument();
    const firstX = canvas.nodes.find(node => node.id === 'scope')!.position.x;
    const endingX = canvas.nodes.find(node => node.id === 'received')!.position.x;
    expect(direction === 'rtl' ? firstX > endingX : firstX < endingX).toBe(true);
  } finally {
    document.documentElement.dir = originalDirection;
  }
});

it('summarizes independent follow-ups and expands to the exact original nodes and routes', async () => {
  const user = userEvent.setup(), select = vi.fn(), connect = vi.fn();
  render(<JourneyMap tree={tree} selected={null} onSelect={select} onSelectPath={() => {}} onConnect={connect} />);
  expect(screen.getAllByTestId('map-node')).toHaveLength(4);
  expect(canvas.nodes.map(node => node.id)).toEqual(['interests', 'followups:garden', 'contact', 'received']);
  expect(screen.getByText('Ask every match, one at a time. Skip the rest.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Indoor details$/ }));
  expect(select).toHaveBeenCalledWith(tree.steps.findIndex(step => step.id === 'indoors'));
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.map(edge => [edge.source, edge.target])).toContainEqual(['interests', 'followups:garden']);
  expect(edges.find(edge => edge.target === 'followups:garden')?.reconnectable).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Edit individual connections' }));
  expect(screen.getAllByTestId('map-node')).toHaveLength(6);
  expect(canvas.nodes.map(node => node.id)).toEqual(['interests', 'garden', 'indoors', 'balcony', 'contact', 'received']);
  expect(screen.queryByText('Ask every match, one at a time. Skip the rest.')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: /Question Garden details/ })).toHaveFocus());
  expect(connect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Group follow-ups' }));
  expect(screen.getAllByTestId('map-node')).toHaveLength(4);
});

it('explains shown and skipped group members when trying sample answers', () => {
  render(<JourneyMap tree={tree} selected={null} samplePath={[2, 5, 0, 3]} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  expect(screen.getAllByText('Shown for these answers')).toHaveLength(1);
  expect(screen.getAllByText('Skipped for these answers')).toHaveLength(2);
});

it('keeps members grouped until connections are explicitly inspected', async () => {
  const user = userEvent.setup();
  const props = { tree, onSelect: () => {}, onSelectPath: () => {}, onConnect: () => {} };
  const { rerender } = render(<JourneyMap {...props} selected={null} />);
  expect(canvas.nodes.some(node => node.id === 'followups:garden')).toBe(true);
  const garden = tree.steps.findIndex(step => step.id === 'garden');
  rerender(<JourneyMap {...props} selected={garden} />);
  expect(canvas.nodes.some(node => node.id === 'followups:garden')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Edit individual connections' }));
  expect(canvas.nodes.some(node => node.id === 'garden')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Group follow-ups' }));
  expect(canvas.nodes.some(node => node.id === 'followups:garden')).toBe(true);
  rerender(<JourneyMap {...props} selected={garden} />);
  expect(canvas.nodes.some(node => node.id === 'followups:garden')).toBe(true);
  rerender(<JourneyMap {...props} selected={tree.steps.findIndex(step => step.id === 'indoors')} />);
  expect(canvas.nodes.some(node => node.id === 'followups:garden')).toBe(true);
});

it('spaces tall parallel cards by measured size without resetting a manually arranged map', async () => {
  const user = userEvent.setup();
  const branched = branchedFixture as unknown as TemplateTree;
  render(<JourneyMap tree={branched} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Expand follow-ups' }));
  expect(canvas.nodes).toHaveLength(13);
  act(() => canvas.change(canvas.nodes.map(node => ({ id: node.id, type: 'dimensions', dimensions: { width: 252, height: 500 } }))));
  const overlaps = () => canvas.nodes.flatMap((a, i) => canvas.nodes.slice(i + 1).filter(b =>
    Math.min(a.position.x + a.measured!.width!, b.position.x + b.measured!.width!) > Math.max(a.position.x, b.position.x)
    && Math.min(a.position.y + a.measured!.height!, b.position.y + b.measured!.height!) > Math.max(a.position.y, b.position.y)));
  expect(overlaps()).toEqual([]);
  act(() => canvas.change([{ id: 'home_garden', type: 'position', position: { x: 42, y: 73 }, dragging: true }]));
  const arranged = canvas.nodes.map(node => ({ id: node.id, position: node.position }));
  act(() => canvas.change([{ id: 'business_office', type: 'dimensions', dimensions: { width: 252, height: 620 } }]));
  expect(canvas.nodes.map(node => ({ id: node.id, position: node.position }))).toEqual(arranged);
  await user.click(screen.getByRole('button', { name: 'Tidy up' }));
  expect(overlaps()).toEqual([]);
  expect(canvas.nodes.find(node => node.id === 'home_garden')!.position).not.toEqual({ x: 42, y: 73 });
});


it('reveals an off-canvas keyboard control without changing zoom or moving nodes', async () => {
  const { container } = render(<JourneyMap tree={tree} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  const viewport = container.querySelector('.react-flow')!;
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 } as DOMRect);
  const ending = screen.getByRole('button', { name: /Ending/ });
  vi.spyOn(ending, 'matches').mockReturnValue(true);
  const bounds = vi.spyOn(ending, 'getBoundingClientRect').mockReturnValue({ left: 1100, top: 650, right: 1300, bottom: 730 } as DOMRect);
  const before = canvas.nodes.map(node => node.position);
  canvas.setViewport.mockClear();
  ending.focus();
  await waitFor(() => expect(canvas.setViewport).toHaveBeenCalledWith({ x: -302, y: -122, zoom: 0.75 }));
  expect(canvas.nodes.map(node => node.position)).toEqual(before);
  ending.blur();
  bounds.mockReturnValue({ left: 20, top: 20, right: 220, bottom: 100 } as DOMRect);
  canvas.setViewport.mockClear();
  ending.focus();
  await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  expect(canvas.setViewport).not.toHaveBeenCalled();
});


it('opens normal and hidden paths without the enclosing card overriding the action', async () => {
  const user = userEvent.setup(), select = vi.fn(), path = vi.fn();
  const changed = { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.map(edge => edge.id === 'garden_hidden' ? { ...edge, to: 'contact' } : edge) } };
  render(<JourneyMap tree={changed} selected={null} onSelect={select} onSelectPath={path} onConnect={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Check next: Garden details' }));
  expect(path).toHaveBeenLastCalledWith(tree.steps.findIndex(step => step.id === 'interests'), 0);
  expect(select).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'When hidden → One enquiry' }));
  const garden = tree.steps.findIndex(step => step.id === 'garden');
  expect(path).toHaveBeenLastCalledWith(garden, 'hidden');
  expect(select).not.toHaveBeenCalled();
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  canvas.edgeClick(edges.find(edge => edge.id === 'garden_hidden')!);
  expect(path).toHaveBeenLastCalledWith(garden, 'hidden');
  await user.click(screen.getByRole('button', { name: /Question Garden details/ }));
  expect(select).toHaveBeenCalledExactlyOnceWith(garden);
});


it('keeps a shared visible/hidden connection highlighted when inspecting the hidden continuation', async () => {
  render(<JourneyMap tree={tree} selected={tree.steps.findIndex(step => step.id === 'garden')} focusedPath="hidden" onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.find(edge => edge.id === 'garden_next')?.style?.opacity).toBe(1);
  expect(edges.find(edge => edge.id === 'indoor_next')?.style?.opacity).toBe(1);
  expect(edges.find(edge => edge.id === 'start')?.style?.opacity).toBe(0.2);
});


it('keeps the last inspected screen in view after its settings close', async () => {
  canvas.fitView.mockClear();
  const props = { tree, onSelect: () => {}, onSelectPath: () => {}, onConnect: () => {} };
  const contactIndex = tree.steps.findIndex(step => step.id === 'contact');
  const { rerender } = render(<JourneyMap {...props} selected={contactIndex} />);
  await waitFor(() => expect(canvas.fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.arrayContaining([{ id: 'contact' }]) })));
  canvas.fitView.mockClear();
  rerender(<JourneyMap {...props} selected={null} />);
  // Closing the inspector may leave the viewport unchanged, or refit after its width grows.
  // Tidy up requests a fresh fit and must retain the last screen, not jump to entry.
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tidy up' }));
  await waitFor(() => expect(canvas.fitView).toHaveBeenLastCalledWith(expect.objectContaining({ nodes: expect.arrayContaining([{ id: 'contact' }]) })));
});


it('lets merchants turn relationship highlighting off without moving cards or editing routes', async () => {
  const user = userEvent.setup();
  render(<JourneyMap tree={tree} selected={tree.steps.findIndex(step => step.id === 'interests')} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'View options' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Highlight related paths' })).toHaveAttribute('aria-checked', 'true');
  expect(canvas.nodes.find(node => node.id === 'contact')?.data.muted).toBe(true);
  const positions = canvas.nodes.map(node => node.position);
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Highlight related paths' }));
  expect(canvas.nodes.every(node => !node.data.muted)).toBe(true);
  expect(canvas.nodes.map(node => node.position)).toEqual(positions);
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.every(edge => edge.style?.opacity === 1)).toBe(true);
});

it.each(['ltr', 'rtl'])('pans to later screens in %s without zooming or changing layout', async direction => {
  const previous = document.documentElement.dir;
  document.documentElement.dir = direction;
  try {
    render(<JourneyMap tree={tree} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
    const positions = canvas.nodes.map(node => node.position);
    canvas.setViewport.mockClear();
    await userEvent.setup().click(screen.getByRole('button', { name: 'View options' }));
    await userEvent.setup().click(screen.getByRole('menuitem', { name: 'Pan to later screens' }));
    expect(canvas.setViewport).toHaveBeenCalledWith({ x: direction === 'rtl' ? 660 : -640, y: 20, zoom: .75 }, { duration: 180 });
    expect(canvas.nodes.map(node => node.position)).toEqual(positions);
  } finally { document.documentElement.dir = previous; }
});

it('highlights a tested hidden continuation when it shares the visible default line', async () => {
  render(<JourneyMap tree={tree} selected={null} samplePath={[2, 4, 0]} sampleEdges={['start', 'garden_hidden', 'indoor_hidden', 'balcony_next']} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Edit individual connections' }));
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.find(edge => edge.id === 'garden_next')?.style?.opacity).toBe(1);
  expect(edges.find(edge => edge.id === 'indoor_next')?.style?.opacity).toBe(1);
  expect(edges.find(edge => edge.id === 'balcony_next')?.style?.opacity).toBe(1);
  expect(edges.find(edge => edge.id === 'submitted')?.style?.opacity).toBe(.15);
});


it('connects an optional grouped follow-up through its vertical handles and keeps the join horizontal', () => {
  const optional: TemplateTree = { ...tree, graph: { ...tree.graph!, edges: [
    ...tree.graph!.edges.map(edge => edge.id === 'start' ? { ...edge, to: 'contact' } : edge),
    { id: 'optional-group', from: 'interests', to: 'garden', kind: 'answer', when: {
      match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['garden'] }],
    } },
  ] } };
  render(<JourneyMap tree={optional} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  const entry = canvas.nodes.find(node => node.id === 'interests')!;
  const group = canvas.nodes.find(node => node.id === 'followups:garden')!;
  const join = canvas.nodes.find(node => node.id === 'contact')!;
  expect(group.data.detourEntry).toBe(true);
  expect(group.position.x).toBe(entry.position.x);
  expect(group.position.y).toBeGreaterThan(entry.position.y);
  expect(join.position.x).toBeGreaterThan(entry.position.x);
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.find(edge => edge.id === 'optional-group')).toMatchObject({ sourceHandle: 'detour-out', targetHandle: 'detour-in' });
  expect(edges.find(edge => edge.id === 'start')).toMatchObject({ label: 'Everyone else', target: 'contact' });
});


it('gives each path into a shared screen its own named target port and approach lane', () => {
  render(<JourneyMap tree={branchedFixture as unknown as TemplateTree} selected={null} onSelect={()=>{}} onSelectPath={()=>{}} onConnect={()=>{}} />);
  const edges = (JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[]).filter(edge=>edge.target==='contact');
  expect(edges.length).toBeGreaterThan(1);
  expect(new Set(edges.map(edge=>edge.targetHandle)).size).toBe(edges.length);
  expect(new Set(edges.map(edge=>edge.data?.corridorOffset)).size).toBe(edges.length);
  expect(canvas.nodes.find(node=>node.id==='contact')?.data.incomingPorts).toEqual(expect.arrayContaining(edges.map(edge=>edge.id)));
});
