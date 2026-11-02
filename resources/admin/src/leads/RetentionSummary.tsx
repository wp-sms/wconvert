import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { PageError } from '../shell/Region';
import { readRetention, type Retention } from './api';
import { formatCount } from '../lib/format';
import { settingsHref } from '../nav';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';

/**
 * A saved-policy summary, never a destructive control beside the submission log.
 *
 * `PageError`, because this line stands below the log's region rather than in
 * one, and a `RegionError` band would draw a rule above a sentence.
 */
export function RetentionSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [period, setPeriod] = useState<Loadable<Retention>>(LOADING);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRefreshError(null);
    setPeriod((current) => (current.status === 'ready' ? current : LOADING));
    readRetention()
      .then((next) => {
        if (active) setPeriod(ready(next));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setRefreshError(messageOf(cause));
        setPeriod((current) => (current.status === 'ready' ? current : failed(cause)));
      });
    return () => {
      active = false;
    };
  }, [refreshKey, retry]);

  const tryAgain = () => setRetry((value) => value + 1);

  if (period.status === 'failed') {
    return <PageError message={sprintf(/* translators: %s: the error message explaining why it failed to load. */ __('How long submissions are kept could not be loaded: %s', 'wconvert'), period.message)} onRetry={tryAgain} />;
  }
  if (period.status === 'loading') {
    return (
      <div className="text-note">
        <span role="status" className="sr-only">{__('Loading how long submissions are kept…', 'wconvert')}</span>
        <Skeleton aria-hidden="true" className="h-[1lh] w-72 max-w-full" />
      </div>
    );
  }
  const { days } = period.data;
  return (
    <>
      {refreshError !== null && <PageError message={sprintf(/* translators: %s: the error message explaining why it failed to refresh. */ __('How long submissions are kept could not be refreshed. This is the last policy read: %s', 'wconvert'), refreshError)} onRetry={tryAgain} />}
      <p className="m-0 text-note text-muted-foreground">
        {days === null
          ? __('Submissions are kept until you delete them.', 'wconvert')
          : sprintf(
              /* translators: %s: how many days submissions are kept, e.g. “90”. */ _n(
                'Submissions are deleted automatically after %s day.',
                'Submissions are deleted automatically after %s days.',
                days,
                'wconvert',
              ),
              formatCount(days),
            )}{' '}
        <a className="underline underline-offset-2" href={settingsHref('data')}>
          {__('Change retention', 'wconvert')}
        </a>
      </p>
    </>
  );
}
