import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibrarySettings } from '../../resources/admin/src/templates/LibrarySettings';
import { SwitchSetting } from '../../resources/admin/src/shell/SwitchSetting';

const catalog = vi.hoisted(() => ({
  catalogStatus: vi.fn(async () => ({ consent: 'yes' })),
  setCatalogConsent: vi.fn(async (allowed: boolean) => ({ consent: allowed ? 'yes' : 'no' })),
  refreshCatalog: vi.fn(),
}));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);

/** Settings re-renders on every editing report, which is what reset the switch (#359). */
function Page({ children }: { children: (report: (state: { dirty: boolean }) => void) => React.ReactNode }) {
  const [, setDirty] = useState(false);
  return <>{children(state => setDirty(state.dirty))}</>;
}

it('keeps the library switch off until Save, then saves it (#359)', async () => {
  const user = userEvent.setup();
  render(<Page>{report => <LibrarySettings onEditingStateChange={report} />}</Page>);
  const toggle = await screen.findByRole('checkbox', { name: /Show designs from the WConvert library/ });
  expect(toggle).toBeChecked();

  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  const save = screen.getByRole('button', { name: 'Save template library' });
  expect(save).toBeEnabled();
  expect(catalog.catalogStatus).toHaveBeenCalledTimes(1);

  await user.click(save);
  await waitFor(() => expect(catalog.setCatalogConsent).toHaveBeenCalledWith(false));
  expect(toggle).not.toBeChecked();
});

it('reads once even when a caller passes a new reader every render', async () => {
  const user = userEvent.setup();
  const read = vi.fn(async () => ({ enabled: true }));
  render(<Page>{report => (
    <SwitchSetting title="Switch" label="Turn it on" hint="A hint." setting="switch" saveLabel="Save switch"
      read={() => read()} save={async enabled => ({ enabled })} onEditingStateChange={report} />
  )}</Page>);
  const toggle = await screen.findByRole('checkbox', { name: /Turn it on/ });
  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(read).toHaveBeenCalledTimes(1);
});
