import { __ } from '@wordpress/i18n';
import type { Audience } from '@loader/display-rules';
import type { RuleType } from '../api';
import { Button } from '../../components/ui/button';
import { GroupEditor } from './GroupEditor';
import { emptyGroup } from './plan';

/**
 * Who sees it, under Custom…: one or more groups of visitors, any one of which
 * is enough. The quick picks above cover "everyone"; this only edits groups.
 */
export function AudienceEditor({ value, types, onChange }: { value: Audience; types: readonly RuleType[]; onChange: (next: Audience) => void }) {
  const groups = value.mode === 'groups' ? value.groups : [];
  return <div className="wconvert-display-groups">
    {groups.map((group, index) => <div key={group.id ?? index}>
      {index > 0 && <p className="wconvert-display-or">{__('or', 'wconvert')}</p>}
      <div className="wconvert-display-group-title"><h4>{__('Visitors who…', 'wconvert')}</h4>
        {groups.length > 1 && <Button variant="ghost" size="sm" onClick={() => onChange({ mode: 'groups', groups: groups.filter((_group, at) => at !== index) })}>{__('Remove', 'wconvert')}</Button>}
      </div>
      <GroupEditor group={group} types={types} offset={index * 10} onChange={next => onChange({ mode: 'groups', groups: groups.map((old, at) => at === index ? next : old) })} />
    </div>)}
    {groups.length < 5 && <button type="button" className="wconvert-display-link" onClick={() => onChange({ mode: 'groups', groups: [...groups, emptyGroup()] })}>{__('+ Or a different group of visitors', 'wconvert')}</button>}
  </div>;
}
