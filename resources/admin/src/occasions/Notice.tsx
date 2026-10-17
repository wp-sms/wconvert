import { __ } from '@wordpress/i18n';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { OccasionNotice } from './api';

/**
 * What a copy or an import did, kept beside what it made (GUIDELINES §8):
 * one sentence, then each campaign that did not come across and why.
 */
export function OccasionNoticeView({ notice, action, onDismiss }: { notice: OccasionNotice; action?: React.ReactNode; onDismiss: () => void }) {
  const Icon = notice.problems.length > 0 ? TriangleAlert : CircleCheck;
  return (
    <div role="status" className="wconvert-occasion-notice">
      <Icon aria-hidden="true" className={notice.problems.length > 0 ? 'text-warning' : 'text-success'} />
      <div className="min-w-0">
        <p className="m-0 font-semibold">{notice.title}</p>
        {notice.problems.length > 0 && <ul className="wconvert-occasion-notice__problems">{notice.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      </div>
      {action}
      <Button variant="ghost" size="icon-sm" aria-label={__('Dismiss', 'wconvert')} onClick={onDismiss}><X aria-hidden="true" /></Button>
    </div>
  );
}
