import { __ } from '@wordpress/i18n';
import { ChevronDown, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { exportLeads, type LeadPage } from './api';

/**
 * **One Export, wherever submissions are listed** (GUIDELINES §9): the log's
 * toolbar and a lead's history footer both draw this.
 *
 * Two formats are a menu; one is a plain button, because a menu holding a
 * single item is a second click that decides nothing. The question-answer CSV
 * exists only where answers can (ADR 0127), so most installs see the button.
 * The caller decides whether to draw it at all: an export of nothing is not
 * offered.
 */
export function ExportMenu({ filter, answers }: { filter: LeadPage; answers: boolean }) {
  if (!answers) {
    return (
      <Button variant="outline" onClick={() => exportLeads(filter)}>
        <Download aria-hidden="true" />{__('Export CSV', 'wconvert')}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden="true" />{__('Export', 'wconvert')}<ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => exportLeads(filter)}>{__('Submissions (CSV)', 'wconvert')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportLeads(filter, 'questions')}>{__('Question answers (CSV)', 'wconvert')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
