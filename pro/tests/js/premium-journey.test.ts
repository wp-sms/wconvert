import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { bindJourney } from '../../modules/journeys/loader/journey';
import { registerPremiumJourneyRenderer } from '../../modules/journeys/loader/render';
import finder from '../../modules/journeys/templates/journey-product-finder.json';
import service from '../../modules/journeys/templates/journey-service-enquiry.json';
import guide from '../../modules/journeys/templates/journey-content-guide.json';
import { showProducts } from '@loader/products';
import { resultAccess } from '../../../resources/admin/src/builder/structure/journey';
import { convertingActOf } from '../../../resources/admin/src/builder/structure/guards';

registerPremiumJourneyRenderer();
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

function setup(template: Template) {
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', '/capture'); document.body.append(tag);
  const anchor = document.createElement('div'); document.body.append(anchor);
  const mounted = mount({ template, displayType: 'inline', anchor }); mounted.show();
  const captured = vi.fn(); const completed = vi.fn();
  bindJourney(mounted, { id: 'campaign', template, capture_contract: 'contract' }, { onCaptured: captured, onCompleted: completed });
  const root = () => mounted.root!;
  const choose = (value: string) => { root().querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click(); };
  const act = (name: string) => { root().querySelector<HTMLButtonElement>(`button[data-action="${name}"]`)!.click(); };
  return { mounted, captured, completed, root, choose, act };
}

it('finishes an anonymous product quiz and prunes a hidden answer after Back', () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const journey = setup(finder as Template);
  journey.choose('garden'); journey.act('next');
  expect(journey.root().textContent).toContain('Tell us about your garden');
  journey.choose('sun'); journey.act('next');
  expect(journey.root().textContent).toContain('Sunny garden picks');
  expect(journey.completed).toHaveBeenCalledOnce();
  expect(journey.captured).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
  journey.act('back'); journey.act('back');
  journey.choose('balcony'); journey.act('next');
  expect(journey.root().textContent).toContain('Balcony picks');
  expect(journey.root().textContent).not.toContain('Tell us about your garden');
  expect(journey.completed).toHaveBeenCalledOnce();
});

it('sends active question answers with a contact submission, once', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead' }) });
  vi.stubGlobal('fetch', fetcher);
  const journey = setup(service as Template);
  journey.choose('repair'); journey.act('next'); journey.act('next');
  journey.root().querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  journey.act('submit');
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toMatchObject({
    submission: 'enquiry', fields: { email: 'visitor@example.com' }, question_answers: { n2: 'repair' },
  });
  expect(journey.captured).toHaveBeenCalledOnce();
  expect(journey.completed).not.toHaveBeenCalled();
});

it('shows results before an optional email signup without counting another conversion', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead' }) });
  vi.stubGlobal('fetch', fetcher);
  const journey = setup(guide as Template);
  journey.choose('grow'); journey.act('next');
  expect(journey.root().textContent).toContain('Start with growing');
  expect(journey.completed).toHaveBeenCalledOnce();
  journey.act('next');
  journey.root().querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  const consent = journey.root().querySelector<HTMLInputElement>('[name="consent"]');
  if (consent) consent.checked = true;
  journey.act('submit');
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetcher.mock.calls[1][1].body)).question_answers).toEqual({ n3: ['grow'] });
  expect(journey.completed).toHaveBeenCalledOnce();
  expect(journey.captured).not.toHaveBeenCalled();
});

it('can require contact before a result while counting the result as the quiz conversion', async () => {
  const tree = resultAccess((guide as Template).tree, true);
  expect(tree.steps.map(screen => screen.kind)).toEqual(['input', 'input', 'result']);
  expect(tree.submissions[0].required).toBe(true);
  expect(convertingActOf(tree)).toEqual(['match']);
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead' }) });
  vi.stubGlobal('fetch', fetcher);
  const journey = setup({ ...(guide as Template), tree });
  expect(journey.root().textContent).toContain('Contact details are required before you see your result.');
  journey.choose('grow'); journey.act('next');
  expect(journey.completed).not.toHaveBeenCalled();
  journey.root().querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  const consent = journey.root().querySelector<HTMLInputElement>('[name="consent"]');
  if (consent) consent.checked = true;
  journey.act('submit');
  await vi.waitFor(() => expect(journey.completed).toHaveBeenCalledOnce());
  expect(journey.root().textContent).toContain('Start with growing');
  expect(journey.captured).not.toHaveBeenCalled();
  expect(JSON.parse(String(fetcher.mock.calls[1][1].body)).question_answers).toEqual({ n3: ['grow'] });
  const immediate = resultAccess(tree, false);
  expect(immediate.steps.map(screen => screen.kind)).toEqual(['input', 'result', 'input', 'acknowledgement']);
  expect(immediate.submissions[0].required).toBe(false);
});

it('returns to the question named by a server refusal', async () => {
  const tree = resultAccess((guide as Template).tree, true);
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Review this answer.', data: { field: 'n3' } }) });
  vi.stubGlobal('fetch', fetcher);
  const journey = setup({ ...(guide as Template), tree });
  journey.choose('grow'); journey.act('next');
  journey.root().querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  journey.act('submit');
  await vi.waitFor(() => expect(journey.root().textContent).toContain('Which topics interest you?'));
  const question = journey.root().querySelector<HTMLInputElement>('[data-question-id="n3"]');
  expect((journey.root().getRootNode() as ShadowRoot).activeElement).toBe(question);
  expect(journey.completed).not.toHaveBeenCalled();
});

it('renders only selected, live, purchasable products and counts a product click', async () => {
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-products', `${location.origin}/wp-json/wc/store/v1/products`); document.body.append(tag);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [
    { id: 7, name: 'Garden kit', permalink: `${location.origin}/garden-kit`, is_purchasable: true, is_in_stock: true, prices: { price: '1299', currency_code: 'USD', currency_minor_unit: 2 } },
    { id: 8, name: 'Sold out', permalink: `${location.origin}/sold-out`, is_purchasable: true, is_in_stock: false },
    { id: 9, name: 'Private', permalink: `${location.origin}/private`, is_purchasable: true, is_in_stock: true, is_password_protected: true },
  ] });
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div'); document.body.append(container);
  const clicked = vi.fn();
  const stop = showProducts(container, { id: 'match', heading: 'Match', body: '', product_ids: [7, 8, 9] }, clicked);
  await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(1));
  expect(container.textContent).toContain('$12.99');
  expect(container.textContent).not.toContain('Sold out');
  expect(String(fetcher.mock.calls[0][0])).toContain('catalog_visibility=visible');
  container.querySelector('a')!.addEventListener('click', event => event.preventDefault());
  container.querySelector('a')!.click();
  expect(clicked).toHaveBeenCalledOnce();
  stop();
});
