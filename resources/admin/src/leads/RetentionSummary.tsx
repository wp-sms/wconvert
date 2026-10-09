import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { TryAgain } from '../shell/Region';
import { readRetention, type Retention } from './api';
import { formatCount } from '../lib/format';
import { settingsHref } from '../nav';
import { messageOf } from '../shell/loadable';

/** A saved-policy summary, never a destructive control beside the submission log. */
export function RetentionSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [period, setPeriod] = useState<Retention | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    readRetention()
      .then((next) => {
        if (active) { setPeriod(next); setError(null); }
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [refreshKey, retry]);

  if (error !== null) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-note">
        <p role="alert" className="m-0 text-destructive">
          {sprintf(__('How long submissions are kept couldn’t be loaded: %s', 'wconvert'), error)}
        </p>
        <TryAgain onClick={() => setRetry((value) => value + 1)} />
      </div>
    );
  }
  if (period === null) {
    return (
      <div className="text-note">
        <span role="status" className="sr-only">{__('Loading how long submissions are kept…', 'wconvert')}</span>
        <Skeleton aria-hidden="true" className="h-[1lh] w-72 max-w-full" />
      </div>
    );
  }
  return (
    <p className="m-0 text-note text-muted-foreground">
      {period.days === null
        ? __('Submissions are kept until you delete them.', 'wconvert')
        : sprintf(
            _n(
              'Submissions are deleted automatically after %s day.',
              'Submissions are deleted automatically after %s days.',
              period.days,
              'wconvert',
            ),
            formatCount(period.days),
          )}{' '}
      <a className="underline underline-offset-2" href={settingsHref('data')}>
        {__('Change retention', 'wconvert')}
      </a>
    </p>
  );
}
