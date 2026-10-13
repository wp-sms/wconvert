import { lazy } from 'react';
import { __ } from '@wordpress/i18n';
import { HELP_PAGE_ID } from '../shell/HeaderTools';
import type { ExtraPage } from '../extraPages';

/**
 * WConvert → Help (ADR 0144): free's own registered page, reached from the
 * WordPress submenu and the header's Help popover, never from a tab.
 */
export const HELP_PAGE: ExtraPage = {
  id: HELP_PAGE_ID,
  get title() { return __('Help', 'wconvert'); },
  get description() { return __('Find a little guidance, fix a common problem, or ask our team.', 'wconvert'); },
  Component: lazy(() => import('./HelpPage').then((module) => ({ default: module.HelpPage }))),
};
