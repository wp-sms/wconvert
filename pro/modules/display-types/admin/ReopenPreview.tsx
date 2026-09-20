import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { ReopenPreviewProps } from '@/reopenControls';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/hooks/useDirection';
import { reminder, type Teaser } from '../loader/reminder';

/** The visitor's visual button, contained by the editor canvas; no visitor state. */
export default function ReopenPreview({ value, template, mobile, onReopen }: ReopenPreviewProps) {
  const config = value as Teaser;
  const container = useRef<HTMLDivElement>(null);
  const direction = useDirection();
  const [dismissed, setDismissed] = useState(false);
  const hidden = mobile && config.mobile?.visible === false;
  useEffect(() => {
    const parent = container.current;
    if (!parent || dismissed) return;
    const view = reminder(config, template.tokens, [__('Dismiss reminder', 'wconvert'), __('Submission received — View details', 'wconvert')]);
    view.host.removeAttribute('popover');
    const visible = view.layout(mobile);
    view.host.style.setProperty('position', 'absolute', 'important');
    view.button.addEventListener('click', onReopen);
    view.close.addEventListener('click', () => setDismissed(true));
    if (visible) parent.appendChild(view.host);
    return () => view.host.remove();
  }, [config, template, mobile, direction, dismissed, onReopen]);
  return <div ref={container} className="absolute inset-0 grid place-items-center">
    {hidden ? <p className="rounded bg-card p-4">{__('Hidden on mobile', 'wconvert')}</p> : dismissed ? <div className="rounded bg-card p-4 text-center">
      <p>{__('Reminder dismissed for this preview.', 'wconvert')}</p>
      <Button variant="outline" onClick={() => setDismissed(false)}>{__('Show again', 'wconvert')}</Button>
    </div> : null}
  </div>;
}
