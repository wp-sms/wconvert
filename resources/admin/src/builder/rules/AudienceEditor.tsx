import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { Audience } from '@loader/display-rules';
import type { RuleType } from '../api';
import { Button } from '../../components/ui/button';
import { InfoTip } from '../../shell/InfoTip';
import { GroupEditor } from './GroupEditor';
import { emptyGroup } from './plan';

/** The most groups an audience holds; `DisplayPlan` refuses a sixth. */
const MAX_GROUPS = 5;

/**
 * Who sees it, under Custom…: one or more groups of visitors, any one of which
 * is enough. The quick picks above cover "everyone"; this only edits groups.
 *
 * Groups are numbered and divided by a bold OR (ADR 0139). "+ Add another
 * group" adds an empty one and opens its picker; closing it unused leaves the
 * group asking for a rule, and publishing stays blocked as for any empty group.
 */
export function AudienceEditor({ value, types, onChange }: { value: Audience; types: readonly RuleType[]; onChange: (next: Audience) => void }) {
  const groups = value.mode === 'groups' ? value.groups : [];
  // The group whose picker opens as it appears, until that picker closes.
  const [opening, setOpening] = useState<string | null>(null);
  const match = { before: __('Match', 'wconvert'), after: __('of these', 'wconvert'), order: ['all', 'any'] as const };

  return <div className="wconvert-display-groups">
    {groups.map((group, index) => {
      const title = sprintf(/* translators: %d: a group's number, from 1. */ __('Group %d', 'wconvert'), index + 1);

      return <div key={group.id ?? index}>
        {index > 0 && <div className="wconvert-display-or" role="separator" aria-label={__('or', 'wconvert')}><b aria-hidden="true">{__('OR', 'wconvert')}</b></div>}
        <GroupEditor group={group} types={types} offset={index * 10} title={title}
          match={{ ...match, label: sprintf(/* translators: %s: a group's name, e.g. “Group 1”. */ __('%s: match all or any', 'wconvert'), title) }}
          autoOpenAdd={group.id !== undefined && group.id === opening} onAddClosed={() => setOpening(null)}
          onChange={next => onChange({ mode: 'groups', groups: groups.map((old, at) => at === index ? next : old) })}
          actions={groups.length > 1 && <Button variant="ghost" size="sm" className="wconvert-display-group__remove"
            onClick={() => onChange({ mode: 'groups', groups: groups.filter((_group, at) => at !== index) })}>{__('Remove group', 'wconvert')}</Button>} />
      </div>;
    })}
    {groups.length < MAX_GROUPS
      ? <button type="button" className="wconvert-display-link" onClick={() => {
        const added = emptyGroup();
        setOpening(added.id ?? null);
        onChange({ mode: 'groups', groups: [...groups, added] });
      }}>{__('+ Add another group', 'wconvert')}</button>
      : <p className="wconvert-display-limit">{__('Up to 5 groups', 'wconvert')}
        <InfoTip label={__('About the group limit', 'wconvert')}>{__('A campaign can have up to five groups of visitors. Remove one to add another.', 'wconvert')}</InfoTip></p>}
  </div>;
}
