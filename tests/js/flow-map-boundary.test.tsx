import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FlowMapBoundary } from '../../resources/admin/src/builder/FlowMapBoundary';

function Broken(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

it('says the map failed where it would be, and how to get it back', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<><FlowMapBoundary><Broken /></FlowMapBoundary><p>The rest of the editor</p></>);
  expect(screen.getByText('The Flow map couldn’t load. Canvas still works.')).toBeInTheDocument();
  expect(screen.getByText('Save your draft, then reload the page to try again.')).toBeInTheDocument();
  // A browser keeps a failed module failed, so a button that cannot work is not offered.
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  expect(screen.getByText('The rest of the editor')).toBeInTheDocument();
  vi.restoreAllMocks();
});
