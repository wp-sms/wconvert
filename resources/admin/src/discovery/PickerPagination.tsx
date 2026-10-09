import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

/** A visible page position, outside the editor gallery's scrolling body. */
export function PickerPagination({ page, pages, disabled = false, onChange }: {
  page: number; pages: number; disabled?: boolean; onChange: (page: number) => void;
}) {
  return <nav className="wconvert-picker__pagination wconvert-toolbar" aria-label={__('Design pages', 'wconvert')}>
    {pages > 1 && <Button variant="outline" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Previous', 'wconvert')}</Button>}
    <span aria-live="polite" aria-atomic="true">{sprintf(__('Page %1$s of %2$s', 'wconvert'), String(page + 1), String(pages))}</span>
    {pages > 1 && <Button variant="outline" disabled={disabled || page === pages - 1} onClick={() => onChange(page + 1)}>{__('Next', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Button>}
  </nav>;
}
