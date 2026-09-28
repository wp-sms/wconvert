import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { Audience, RuleGroup } from '@loader/display-rules';
import type { RuleType } from '../api';
import { Button } from '../../components/ui/button';
import { GroupEditor } from './GroupEditor';
import { emptyGroup } from './plan';

export function AudienceEditor({ value, types, onChange }: { value: Audience; types: readonly RuleType[]; onChange: (next: Audience) => void }) {
  const [advanced, setAdvanced] = useState(value.mode === 'groups' && value.groups.length > 1);
  const [saved, setSaved] = useState<readonly RuleGroup[]>(value.mode === 'groups' ? value.groups : []);
  const groups = value.mode === 'groups' ? value.groups : [];
  return <>
    <p>{__('Page exclusions and limits apply to all visitors.', 'wconvert')}</p>
    <fieldset className="wconvert-display-choices"><legend>{__('Audience', 'wconvert')}</legend>
      <label><input type="radio" name="display-audience" checked={value.mode === 'everyone'} onChange={() => { setSaved(groups); onChange({ mode: 'everyone' }); }} />{__('Everyone on the selected pages', 'wconvert')}</label>
      <label><input type="radio" name="display-audience" checked={value.mode === 'groups'} onChange={() => onChange({ mode: 'groups', groups: saved.length ? saved : [emptyGroup()] })} />{__('Specific visitors', 'wconvert')}</label>
    </fieldset>
    {value.mode === 'groups' && <>
      {groups.map((group, index) => <div key={group.id}>
        {index > 0 && <p className="wconvert-display-or">{__('OR', 'wconvert')}</p>}
        {advanced && <div className="wconvert-display-group-title"><h4>{sprintf(__('Audience group %d', 'wconvert'), index + 1)}</h4>
          {groups.length > 1 && <Button variant="ghost" size="sm" onClick={() => onChange({ ...value, groups: groups.filter((_group, at) => at !== index) })}>{__('Remove group', 'wconvert')}</Button>}
        </div>}
        <GroupEditor group={group} types={types} offset={index * 10} onChange={next => onChange({ ...value, groups: groups.map((old, at) => at === index ? next : old) })} />
      </div>)}
      {!advanced ? <Button variant="ghost" className="mt-4" onClick={() => setAdvanced(true)}>{__('Advanced: alternative audiences', 'wconvert')}</Button>
        : <div className="mt-4"><p>{__('Match any group—for example, mobile visitors or signed-in customers.', 'wconvert')}</p>
          {groups.length < 5 && <Button variant="outline" onClick={() => onChange({ ...value, groups: [...groups, emptyGroup()] })}>{__('Add alternative audience', 'wconvert')}</Button>}
        </div>}
    </>}
  </>;
}
