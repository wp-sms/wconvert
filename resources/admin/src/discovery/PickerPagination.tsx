import { __ } from '@wordpress/i18n';
import { ListPages } from '../shell/ListFoot';

/** A visible page position, outside the gallery's scrolling body. */
export function PickerPagination({ page, pages, disabled = false, onChange, label }: {
  page: number; pages: number; disabled?: boolean; onChange: (page: number) => void;
  /** What is being paged, e.g. "Design pages"; the default says only "Pages". */
  label?: string;
}) {
  return <ListPages className="wconvert-picker__pagination" label={label ?? __('Pages', 'wconvert')} page={page} pages={pages} disabled={disabled} onChange={onChange} />;
}
