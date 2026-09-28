import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
const mocks = vi.hoisted(() => ({ fitView: vi.fn(), base: vi.fn(), insert: vi.fn(), nodes: vi.fn(), flow: vi.fn() }));
vi.mock('@xyflow/react', () => ({
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Position: {}, MarkerType: {}, Background: () => null,
  ReactFlow: (props: { nodes: { id: string }[]; children: ReactNode }) => { const { nodes, children } = props; mocks.flow(props); mocks.nodes(nodes); return <div>{children}</div>; },
  useReactFlow: () => ({ fitView: mocks.fitView, getNodes: () => [], viewportInitialized: false }),
  useNodesInitialized: () => false,
  useStore: (selector: (value: unknown) => unknown) => selector({ width: 1000, height: 700, transform: [0, 0, 1] }),
  getSmoothStepPath: () => ['M 0 0 L 100 0', 50, 0],
  BaseEdge: (props: { label?: ReactNode }) => { mocks.base(props); return <span>{props.label}</span>; },
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@tisoap/react-flow-smart-edge', () => ({ useSmartEdgePath: () => ({ route: null }), SmartEdgeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
import { FocusCamera, JourneyMap } from '../../resources/admin/src/builder/JourneyMap';
import { JourneyMapEdge } from '../../resources/admin/src/builder/JourneyMapEdge';
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('centres only the selected screen when explicitly requested, without fitting its next branch', () => {
  render(<FocusCamera mapRoot={{ current: null }} selectedId="selected" nextId="next" firstId="first" initialOverview={false} revision={0}
    onTidy={() => {}} preview={false} onPreview={() => {}} onNodesReady={() => {}} selection={{ highlighted: true, toggle: () => {} }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show selected screen' }));
  expect(mocks.fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: [{ id: 'selected' }], maxZoom: 1 }));
  expect(screen.queryByText('Scroll to pan')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Focus selection' })).toBeNull();
});
it('keeps the route label out of the insert button and suppresses the duplicate SVG label', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const edit = vi.fn();
  render(<JourneyMapEdge {...({ id: 'else', label: 'Everyone else', data: { edit, insert: mocks.insert, targetName: 'Contact details' } } as unknown as ComponentProps<typeof JourneyMapEdge>)} />);
  const insert = screen.getByRole('button', { name: 'Add screen here, before Contact details' });
  expect(insert).not.toHaveTextContent('Everyone else');
  const label = screen.getByRole('button', { name: 'Edit path: Everyone else' });
  expect(label.parentElement).toBe(insert.parentElement);
  fireEvent.click(label);
  expect(edit).toHaveBeenCalledOnce();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.base.mock.calls.at(-1)?.[0].label).toBeUndefined();
  fireEvent.click(insert);
  expect(mocks.insert).toHaveBeenCalledWith('else');
});


it('keeps a selected follow-up grouped until individual connections are explicitly opened', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const { default: fixture } = await import('../fixtures/journey-graph-branch-groups.json');
  const tree = fixture as unknown as import('@renderer/types').TemplateTree;
  const props = { tree, selected: tree.steps.findIndex(item => item.id === 'home_garden'), onSelect: () => {}, onSelectPath: () => {}, onConnect: () => {} };
  const view = render(<JourneyMap {...props} />);
  expect(mocks.nodes.mock.calls.at(-1)?.[0].map((node: { id: string }) => node.id)).toContain('followups:home_garden');
  view.rerender(<JourneyMap {...props} focusedPath={0} />);
  expect(mocks.nodes.mock.calls.at(-1)?.[0].map((node: { id: string }) => node.id)).toContain('home_garden');
});

it('requires explicit connection editing and guards callbacks as well as handles', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const { default: fixture } = await import('../fixtures/journey-graph-enquiry.json');
  const tree = fixture as unknown as import('@renderer/types').TemplateTree;
  const connect = vi.fn();
  render(<JourneyMap tree={tree} selected={null} onSelect={() => {}} onSelectPath={() => {}} onConnect={connect} />);
  expect(mocks.flow.mock.calls.at(-1)?.[0].nodesConnectable).toBe(false);
  mocks.flow.mock.calls.at(-1)?.[0].onConnect({ source: 'interests', target: 'contact', sourceHandle: 'new' });
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit connections' }));
  expect(mocks.flow.mock.calls.at(-1)?.[0].nodesConnectable).toBe(true);
  mocks.flow.mock.calls.at(-1)?.[0].onConnect({ source: 'interests', target: 'contact', sourceHandle: 'new' });
  expect(connect).toHaveBeenCalledWith('interests', 'contact');
  fireEvent.click(screen.getByRole('button', { name: 'Done connecting' }));
  expect(mocks.flow.mock.calls.at(-1)?.[0].nodesConnectable).toBe(false);
});
