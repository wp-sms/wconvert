import { beforeEach,expect,it,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { PickerSettings as Settings } from '../../resources/admin/src/discovery/PickerSettings';
import { AdminDialog, AdminDialogContent } from '../../resources/admin/src/components/ui/admin-dialog';
import type { usePicker } from '../../resources/admin/src/discovery/usePicker';

/** Drawn in a dialog, as the design library draws it. */
function PickerSettings(props: ComponentProps<typeof Settings>) {
  return <AdminDialog open><AdminDialogContent size="md"><Settings {...props} /></AdminDialogContent></AdminDialog>;
}
const countryApi = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: countryApi }));
beforeEach(() => { countryApi.mockReset(); countryApi.mockResolvedValue({ countries: [{ code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' }] }); });
const state=()=>({data:{schema:1 as const,today:'2026-09-30',timezone:'Asia/Muscat',collections:[{id:'uk-events',name:'UK events',description:'',version:'1',business_types:[],priority:1,items:[]} as never],preferences:{schema:1 as const,revision:3,saved:[],hidden:[]},occasions:{schema:1 as const,revision:2,items:[]}},saving:false,error:null,reload:vi.fn(),preferences:vi.fn(),occasions:vi.fn(),toggleSaved:vi.fn()});
it('shows a save failure and restores the library without retrying a write',async()=>{
  const picker=state();const onBack=vi.fn();
  render(<PickerSettings picker={{...picker,error:'A newer preference version exists.'} as ReturnType<typeof usePicker>} onBack={onBack} />);
  expect(screen.getByRole('alert')).toHaveTextContent('A newer preference version exists.');
  await userEvent.click(screen.getByRole('button',{name:'Try again'}));
  expect(picker.reload).toHaveBeenCalledOnce();
  expect(picker.preferences).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Back to library'}));expect(onBack).toHaveBeenCalledOnce();
});


it('keeps the library’s preferences personal, with occasions on the Campaigns screen instead', async () => {
  const picker = state();
  render(<PickerSettings picker={picker as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Personal recommendations' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Site occasions' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Occasion name')).not.toBeInTheDocument();
  expect(screen.queryByText(/Occasions are shared/)).not.toBeInTheDocument();
});

it('says a first read failed and offers the one retry, rather than an empty form', async () => {
  const picker = state();
  render(<PickerSettings picker={{ ...picker, data: null, error: 'Preferences could not be loaded.' } as unknown as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.getByText('Preferences could not be loaded.')).toBeVisible();
  expect(screen.queryByLabelText('Occasion name')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(picker.reload).toHaveBeenCalledOnce();
});

it('asks for no countries, businesses or events: the gallery no longer sorts by them', () => {
  render(<PickerSettings picker={state() as ReturnType<typeof usePicker>} onBack={vi.fn()} />);
  expect(screen.queryByText('Countries you serve')).toBeNull();
  expect(screen.queryByText('Businesses to recommend first')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Restore seasonal recommendations' })).toBeNull();
  expect(countryApi).not.toHaveBeenCalled();
});
