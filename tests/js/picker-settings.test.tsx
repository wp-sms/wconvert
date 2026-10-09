import { beforeEach,expect,it,vi } from 'vitest';
import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { PickerSettings as Settings } from '../../resources/admin/src/discovery/PickerSettings';
import { AdminDialog, AdminDialogContent } from '../../resources/admin/src/components/ui/admin-dialog';
import type { usePicker } from '../../resources/admin/src/discovery/usePicker';

/** Creation opens preferences as its own Medium dialog (ADR 0131). */
function PickerSettings(props: ComponentProps<typeof Settings>) {
  return <AdminDialog open><AdminDialogContent size="md"><Settings {...props} /></AdminDialogContent></AdminDialog>;
}
const countryApi = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: countryApi }));
beforeEach(() => { countryApi.mockReset(); countryApi.mockResolvedValue({ countries: [{ code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' }] }); });
const state=()=>({data:{schema:1 as const,today:'2026-09-30',timezone:'Asia/Muscat',collections:[],preferences:{schema:1 as const,revision:3,saved:[],hidden:[],events:[],businesses:[],markets:[]},occasions:{schema:1 as const,revision:2,items:[]}},saving:false,error:null,reload:vi.fn(),preferences:vi.fn(),occasions:vi.fn(),toggleSaved:vi.fn()});
it('keeps failed occasion input and exposes recovery without confusing private and shared choices',async()=>{
  const picker=state();picker.occasions.mockResolvedValue(false);
  render(<PickerSettings picker={picker as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.getByRole('heading',{name:'Personal recommendations'})).toBeVisible();
  expect(screen.getByRole('heading',{name:'Site occasions'})).toBeVisible();
  await userEvent.type(screen.getByLabelText('Occasion name'),'Autumn launch');
  await userEvent.type(screen.getByLabelText('First day'),'2026-10-01');
  await userEvent.type(screen.getByLabelText('Last day'),'2026-10-07');
  await userEvent.click(screen.getByRole('button',{name:'Add occasion'}));
  expect(picker.occasions).toHaveBeenCalledWith([expect.objectContaining({name:'Autumn launch',start:'2026-10-01',end:'2026-10-07'})]);
  expect(screen.getByLabelText('Occasion name')).toHaveValue('Autumn launch');
  expect(screen.getByText(/never schedules a campaign/)).toBeVisible();
});
it('shows save failures in both picker contexts and restores the library without retrying a write',async()=>{
  const picker=state();const onBack=vi.fn();
  render(<PickerSettings picker={{...picker,error:'A newer preference version exists.'} as ReturnType<typeof usePicker>} onBack={onBack} />);
  expect(screen.getByRole('alert')).toHaveTextContent('A newer preference version exists.');
  await userEvent.click(screen.getByRole('button',{name:'Try again'}));
  expect(picker.reload).toHaveBeenCalledOnce();
  expect(picker.preferences).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Back to library'}));expect(onBack).toHaveBeenCalledOnce();
});


it('selects countries by name and preserves the saved values when a write fails', async () => {
  const picker = state(); picker.preferences.mockResolvedValue(false);
  const view = { ...picker, data: { ...picker.data, preferences: { ...picker.data.preferences, markets: ['GB'] } } };
  render(<PickerSettings picker={view as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  const choose = screen.getByRole('button', { name: 'Countries you serve Choose a country' });
  await waitFor(() => expect(choose).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Remove United Kingdom' })).toBeVisible();
  await userEvent.click(choose);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'United');
  expect(screen.queryByRole('button', { name: 'United Kingdom' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'United States' }));
  expect(picker.preferences).toHaveBeenCalledWith(expect.objectContaining({ markets: ['GB', 'US'] }));
  expect(screen.getByRole('button', { name: 'Remove United Kingdom' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Remove United States' })).not.toBeInTheDocument();
  expect(countryApi).toHaveBeenCalledExactlyOnceWith({ path: '/wconvert/v1/optins/phone-country' });
});

it('keeps layout replacement preferences personal without occasion management', async () => {
  const picker = state();
  render(<PickerSettings context="replacement" picker={picker as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Personal recommendations' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Site occasions' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Occasion name')).not.toBeInTheDocument();
  expect(screen.queryByText(/Occasions are shared/)).not.toBeInTheDocument();
  await waitFor(() => expect(countryApi).toHaveBeenCalledOnce());
});

it('offers a timezone hint without saving and requires explicit confirmation or dismissal', async () => {
  const picker = state();
  const data = { ...picker.data, country_suggestion: { code: 'GB', timezone: 'Europe/London' } };
  const view = render(<PickerSettings picker={{ ...picker, data } as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  const add = await screen.findByRole('button', { name: 'Add United Kingdom' });
  expect(picker.preferences).not.toHaveBeenCalled();
  await userEvent.click(add);
  expect(picker.preferences).toHaveBeenCalledWith(expect.objectContaining({ markets: ['GB'] }));
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss country suggestion' }));
  expect(picker.preferences).toHaveBeenLastCalledWith(expect.objectContaining({ country_suggestion_dismissed: 'Europe/London', markets: [] }));
  view.rerender(<PickerSettings picker={{ ...picker, data: { ...data, preferences: { ...data.preferences, country_suggestion_dismissed: 'Europe/London' } } } as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Add United Kingdom' })).not.toBeInTheDocument();
  view.rerender(<PickerSettings picker={{ ...picker, data: { ...data, preferences: { ...data.preferences, markets: ['US'] } } } as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Add United Kingdom' })).not.toBeInTheDocument();
});

it('shows occasion days in words and asks before deleting one, saying what stays', async () => {
  const picker = state();
  picker.occasions.mockResolvedValue(true);
  const items = [{ id: 'sale', name: 'Anniversary sale', start: '2026-11-27', end: '2026-12-01' }, { id: 'launch', name: 'Spring launch', start: '2027-03-02', end: '2027-03-02' }];
  render(<PickerSettings picker={{ ...picker, data: { ...picker.data, occasions: { ...picker.data.occasions, items } } } as ReturnType<typeof usePicker>} onBack={vi.fn()} onPlan={vi.fn()} />);
  expect(screen.getByText('Nov 27 – Dec 1, 2026')).toBeVisible();
  expect(screen.queryByText(/2026-11-27/)).toBeNull();
  expect(screen.queryByText(/Asia\/Muscat/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Actions for Anniversary sale' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete “Anniversary sale”?' });
  expect(confirm).toHaveTextContent('Campaigns and collections stay as they are.');
  expect(picker.occasions).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete occasion' }));
  expect(picker.occasions).toHaveBeenCalledExactlyOnceWith([items[1]]);
});

it('marks the occasion limit before the click, with its reason', async () => {
  const picker = state();
  const items = Array.from({ length: 50 }, (_, at) => ({ id: `o${at}`, name: `Occasion ${at}`, start: '2026-10-01', end: '2026-10-02' }));
  render(<PickerSettings picker={{ ...picker, data: { ...picker.data, occasions: { ...picker.data.occasions, items } } } as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  const add = screen.getByRole('button', { name: 'Add occasion' });
  expect(add).toHaveAttribute('aria-disabled', 'true');
  expect(add).toHaveAccessibleDescription('You can keep up to 50 occasions. Delete one to add another.');
});

it('says a first read failed and offers the one retry, rather than an empty form', async () => {
  const picker = state();
  render(<PickerSettings picker={{ ...picker, data: null, error: 'Preferences could not be loaded.' } as unknown as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.getByText('Preferences could not be loaded.')).toBeVisible();
  expect(screen.queryByLabelText('Occasion name')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(picker.reload).toHaveBeenCalledOnce();
});
