import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Template } from '@renderer/types';
import { ScreenControls } from '../../resources/admin/src/builder/EditorCanvas';
import fixture from '../fixtures/journey-graph-enquiry.json';

it('numbers design screens in the same route order as the journey map', () => {
  render(<ScreenControls template={{ tree: fixture } as unknown as Template} step={2} onChange={() => {}} />);
  const labels = Array.from(screen.getByRole('combobox', { name: 'Campaign screen' }).querySelectorAll('option'))
    .map(option => option.textContent);
  expect(labels).toEqual([
    '1. Interests', '2. Garden details', '3. Indoor details', '4. Balcony details', '5. One enquiry', '6. Received',
  ]);
});
