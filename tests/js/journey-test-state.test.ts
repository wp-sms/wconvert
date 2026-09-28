import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { testCaptureSnapshot } from '../../resources/admin/src/builder/structure/journeyTestState';
import fixture from '../fixtures/journey-graph-enquiry.json';

const tree = fixture as unknown as TemplateTree;

it('freezes every visited question through a graph save, including unanswered optional questions', () => {
  const at = tree.steps.findIndex(screen => screen.id === 'contact');
  const snapshot = testCaptureSnapshot(tree, at, 'enquiry', {
    n1: ['balcony'], n2: 'large', n3: 'bright',
  }, { n5: 'visitor@example.com', unrelated: 'not submitted' });
  expect(snapshot).toEqual({
    screens: ['interests', 'balcony', 'contact'],
    questionIds: ['n1', 'n4'],
    answers: { n1: ['balcony'] },
    values: { n5: 'visitor@example.com' },
  });
});

it('excludes later answers from an earlier accepted capture', () => {
  const later = { id: 'later', name: 'Later question', kind: 'input' as const, content: { type: 'stack' as const, children: [
    { type: 'question' as const, id: 'late_answer', label: 'Later?', answer_type: 'single' as const,
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { type: 'button' as const, action: 'next' as const, label: 'Continue' },
  ] } };
  const extended: TemplateTree = { ...tree, steps: [...tree.steps, later], graph: { ...tree.graph!, edges: [
    ...tree.graph!.edges.map(edge => edge.id === 'submitted' ? { ...edge, to: 'later' } : edge),
    { id: 'later_done', from: 'later', to: 'received', kind: 'default' },
  ] } };
  const at = extended.steps.findIndex(screen => screen.id === 'contact');
  const snapshot = testCaptureSnapshot(extended, at, 'enquiry', { n1: ['balcony'], n4: 'small', late_answer: 'yes' }, { n5: 'visitor@example.com' });
  expect(snapshot?.screens).toEqual(['interests', 'balcony', 'contact']);
  expect(snapshot?.questionIds).toEqual(['n1', 'n4']);
  expect(snapshot?.answers).toEqual({ n1: ['balcony'], n4: 'small' });
});

it('refuses unresolved, wrong-type, duplicate or unvisited capture references', () => {
  const at = tree.steps.findIndex(screen => screen.id === 'contact');
  const check = (fields: string[]) => testCaptureSnapshot({ ...tree, submissions: tree.submissions.map(submission => ({ ...submission, fields })) },
    at, 'enquiry', { n1: ['balcony'] }, { n5: 'visitor@example.test', removed: 'visitor@example.test' });
  expect(check(['removed'])).toBeNull();
  expect(check(['n4'])).toBeNull();
  expect(check(['n5', 'n5'])).toBeNull();
  const later = { ...tree, steps: tree.steps.map(screen => screen.id === 'contact' ? { ...screen, content: { type: 'button' as const, action: 'submit' as const, submission: 'enquiry' } }
    : screen.id === 'received' ? { ...screen, content: tree.steps[at].content } : screen) };
  expect(testCaptureSnapshot(later, at, 'enquiry', { n1: ['balcony'] }, { n5: 'visitor@example.test' })).toBeNull();
});

it('refuses missing required contact details, consent, answers, or the wrong save screen', () => {
  const at = tree.steps.findIndex(screen => screen.id === 'contact');
  expect(testCaptureSnapshot(tree, at, 'enquiry', { n1: ['balcony'] }, {})).toBeNull();
  expect(testCaptureSnapshot(tree, at, 'enquiry', { n1: ['balcony'] }, { n5: '  ' })).toBeNull();
  expect(testCaptureSnapshot(tree, at, 'enquiry', {}, { n5: 'visitor@example.test' })).toBeNull();
  expect(testCaptureSnapshot(tree, tree.steps.findIndex(screen => screen.id === 'received'), 'enquiry', { n1: ['balcony'] }, { n5: 'visitor@example.test' })).toBeNull();
  const consent = { ...tree, submissions: tree.submissions.map(submission => ({ ...submission, consents: ['n100'] })),
    steps: tree.steps.map((screen, index) => index === at ? { ...screen, content: { type: 'stack' as const, children: [screen.content, { type: 'consent' as const, id: 'n100', text: 'I agree' }] } } : screen) };
  expect(testCaptureSnapshot(consent, at, 'enquiry', { n1: ['balcony'] }, { n5: 'visitor@example.test', n100: false })).toBeNull();
  expect(testCaptureSnapshot(consent, at, 'enquiry', { n1: ['balcony'] }, { n5: 'visitor@example.test', n100: true })).not.toBeNull();
});
