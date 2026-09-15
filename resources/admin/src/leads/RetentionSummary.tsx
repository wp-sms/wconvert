import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { readRetention, type Retention } from './api';
import { settingsHref } from '../nav';
import { messageOf } from '../shell/loadable';

/** A saved-policy summary, never a destructive control beside the submission log. */
export function RetentionSummary() {
  const [period, setPeriod] = useState<Retention | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    readRetention()
      .then((next) => {
        if (active) setPeriod(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <p className="m-0 text-note text-muted-foreground">
      {error ??
        (period === null
          ? __('Loading retention policy…', 'wconvert')
          : period.days === null
            ? __('Submissions are kept until you delete them.', 'wconvert')
            : sprintf(
                _n(
                  'Submissions are automatically deleted after %d day.',
                  'Submissions are automatically deleted after %d days.',
                  period.days,
                  'wconvert',
                ),
                period.days,
              ))}{' '}
      <a className="underline underline-offset-2" href={settingsHref('data')}>
        {__('Change retention', 'wconvert')}
      </a>
    </p>
  );
}
