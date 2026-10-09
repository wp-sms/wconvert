import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { formatCount } from '../lib/format';

/** A visible page position, outside the gallery's scrolling body. */
export function PickerPagination({ page, pages, disabled = false, onChange, label }: {
  page: number; pages: number; disabled?: boolean; onChange: (page: number) => void;
  /** What is being paged, e.g. "Design pages"; the default says only "Pages". */
  label?: string;
}) {
  return <nav className="wconvert-picker__pagination wconvert-toolbar" aria-label={label ?? __('Pages', 'wconvert')}>
    {pages > 1 && <Button variant="outline" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Previous', 'wconvert')}</Button>}
    <span aria-live="polite" aria-atomic="true">{sprintf(__('Page %1$s of %2$s', 'wconvert'), formatCount(page + 1), formatCount(pages))}</span>
    {pages > 1 && <Button variant="outline" disabled={disabled || page === pages - 1} onClick={() => onChange(page + 1)}>{__('Next', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>}
  </nav>;
}
