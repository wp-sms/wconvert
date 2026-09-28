import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GraphScreenInsert } from '../../resources/admin/src/builder/GraphScreenInsert';
import { Dialog, DialogContent } from '../../resources/admin/src/components/ui/dialog';
import { addGraphScreen } from '../../resources/admin/src/builder/structure/graphInsertion';
import type { TemplateTree } from '../../resources/renderer/src/types';
import fixture from '../fixtures/journey-graph-branch-groups.json';
const tree = fixture as unknown as TemplateTree;
afterEach(cleanup);

it.each(['default','answer'] as const)('previews and inserts on exactly the selected %s path', kind => {
  const edge = tree.graph!.edges.find(edge => edge.from === 'scope' && edge.kind === kind)!;
  let changed: TemplateTree | undefined;
  const insert = vi.fn((location, type, _name, when, hidden) => { changed = addGraphScreen(tree, location, type, when, hidden); });
  render(<Dialog open><DialogContent><GraphScreenInsert tree={tree} source="scope" kind="input" initialLocation={`edge:${edge.id}`} onInsert={insert} onCancel={() => {}} /></DialogContent></Dialog>);
  const context = screen.getByLabelText('Resulting journey');
  if (kind === 'default') expect(context).toHaveTextContent('Everyone else path');
  expect(context).toHaveTextContent('Only visitors taking this path will see the new screen.');
  expect(context).toHaveTextContent(tree.steps.find(step => step.id === edge.to)!.name);
  expect(context.compareDocumentPosition(screen.getByRole('textbox',{name:'Question'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox',{name:'Question'}),{target:{value:'When should we contact you?'}});
  expect(context).toHaveTextContent('When should we contact you?');
  fireEvent.click(screen.getByRole('button',{name:'Add screen here'}));
  expect(insert).toHaveBeenCalledWith(`edge:${edge.id}`,'input','When should we contact you?',undefined,false,false);
  const added = changed!.steps.at(-1)!;
  expect(changed!.graph!.edges.find(item=>item.id===edge.id)).toEqual({...edge,to:added.id});
  expect(changed!.graph!.edges.find(item=>item.from===added.id)).toMatchObject({to:edge.to,kind:'default'});
  for (const other of tree.graph!.edges.filter(item=>item.id!==edge.id)) expect(changed!.graph!.edges.find(item=>item.id===other.id)).toEqual(other);
});

it('does not promise continuation when the merchant chooses to finish the path', () => {
  const edge = tree.graph!.edges.find(edge => edge.from === 'scope' && edge.kind === 'default')!;
  render(<Dialog open><DialogContent><GraphScreenInsert tree={tree} source="scope" kind="input" initialLocation={`edge:${edge.id}`} onInsert={()=>{}} onCancel={()=>{}} /></DialogContent></Dialog>);
  fireEvent.click(screen.getByRole('button',{name:/Finish this path/}));
  const context=screen.getByLabelText('Resulting journey');
  expect(within(context).getByText('Ending')).toBeInTheDocument();
  expect(context).not.toHaveTextContent(tree.steps.find(step=>step.id===edge.to)!.name);
  expect(screen.queryByText(/continues to the following screen automatically/)).toBeNull();
});
