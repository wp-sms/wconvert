import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Node, Edge, NodeProps, NodeTypes } from '@xyflow/react';
import type { ReactNode } from 'react';
import { JourneyMap } from '../../resources/admin/src/builder/JourneyMap';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';

vi.mock('@xyflow/react', () => ({
  Position: { Left: 'left', Right: 'right' }, MarkerType: { ArrowClosed: 'arrowclosed' },
  Handle: () => null, Controls: () => null, Background: () => null,
  useReactFlow: () => ({ fitView: () => {}, viewportInitialized: true }), useStore: () => 1000, useNodesInitialized: () => true,
  ReactFlow: ({ nodes, edges, nodeTypes, children }: { nodes: Node[]; edges: Edge[]; nodeTypes: NodeTypes; children: ReactNode }) => <>
    {nodes.map(node => { const Card = nodeTypes[node.type!]; return <div data-testid="map-node" data-id={node.id} key={node.id}>
      <Card {...{ ...node, dragging: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, zIndex: 0 } as NodeProps} />
    </div>; })}<output data-testid="map-edges">{JSON.stringify(edges)}</output>{children}</>,
}));
beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const tree = fixture as unknown as TemplateTree;

it('summarizes independent follow-ups and expands to the exact original nodes and routes', async () => {
  const user = userEvent.setup(), select = vi.fn(), connect = vi.fn();
  render(<JourneyMap tree={tree} selected={null} onSelect={select} onSelectPath={() => {}} onConnect={connect} />);
  expect(screen.getAllByTestId('map-node')).toHaveLength(4);
  expect(screen.getByText('Show every matching screen, in this order.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Indoor details / }));
  expect(select).toHaveBeenCalledWith(tree.steps.findIndex(step => step.id === 'indoors'));
  const edges = JSON.parse(screen.getByTestId('map-edges').textContent!) as Edge[];
  expect(edges.map(edge => [edge.source, edge.target])).toContainEqual(['interests', 'followups:garden']);
  expect(edges.find(edge => edge.target === 'followups:garden')?.reconnectable).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Expand screens' }));
  expect(screen.getAllByTestId('map-node')).toHaveLength(6);
  expect(screen.queryByText('Show every matching screen, in this order.')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: /2 · Question Garden details/ })).toHaveFocus());
  expect(connect).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Group follow-ups' }));
  expect(screen.getAllByTestId('map-node')).toHaveLength(4);
});

it('explains shown and skipped group members when trying sample answers', () => {
  render(<JourneyMap tree={tree} selected={null} samplePath={[2, 5, 0, 3]} onSelect={() => {}} onSelectPath={() => {}} onConnect={() => {}} />);
  expect(screen.getAllByText('Shown for these answers')).toHaveLength(1);
  expect(screen.getAllByText('Skipped for these answers')).toHaveLength(2);
});
