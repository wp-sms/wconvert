import { beforeEach,expect,it,vi } from 'vitest';
import { render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PickerSettings } from '../../resources/admin/src/discovery/PickerSettings';
import type { usePicker } from '../../resources/admin/src/discovery/usePicker';
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
  await userEvent.type(screen.getByLabelText('Start date'),'2026-10-01');
  await userEvent.type(screen.getByLabelText('End date (included)'),'2026-10-07');
  await userEvent.click(screen.getByRole('button',{name:'Add occasion'}));
  expect(picker.occasions).toHaveBeenCalledWith([expect.objectContaining({name:'Autumn launch',start:'2026-10-01',end:'2026-10-07'})]);
  expect(screen.getByLabelText('Occasion name')).toHaveValue('Autumn launch');
  expect(screen.getByText(/never schedules a campaign/)).toBeVisible();
});
it('shows save failures in both picker contexts and restores the library without retrying a write',async()=>{
  const picker=state();const onBack=vi.fn();
  render(<PickerSettings picker={{...picker,error:'A newer preference version exists.'} as ReturnType<typeof usePicker>} onBack={onBack} />);
  expect(screen.getByRole('alert')).toHaveTextContent('A newer preference version exists.');
  await userEvent.click(screen.getByRole('button',{name:'Reload preferences'}));
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
  expect(screen.getByRole('heading', { name: 'Your preferences' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Personal recommendations' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Site occasions' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Occasion name')).not.toBeInTheDocument();
  expect(screen.queryByText(/Occasion dates are shared/)).not.toBeInTheDocument();
  await waitFor(() => expect(countryApi).toHaveBeenCalledOnce());
});
