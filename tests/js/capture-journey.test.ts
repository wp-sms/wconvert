import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import { bindJourney } from '@loader/journey';
import type { Template } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-then-sms.json';
import enquiry from '../../resources/templates/library/journey-enquiry.json';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
function setup(template: Template) {
  const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', '/capture'); document.body.append(tag);
  const anchor = document.createElement('div'); document.body.append(anchor);
  const mounted = mount({ template, displayType: 'inline', anchor }); mounted.show();
  const captured = vi.fn(); bindJourney(mounted, { id: 'campaign', template, capture_contract: 'contract' }, { onCaptured: captured });
  return { mounted, captured };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
it('keeps the accepted email fixed, skips SMS, and does not send the first signup twice', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead', submission: 'email-signup' }) });
  vi.stubGlobal('fetch', fetcher);
  const { mounted, captured } = setup(source as Template);
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
  await settle();
  expect(captured).toHaveBeenCalledOnce();
  expect(mounted.root!.textContent).toContain('optional');
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="back"]')!.click();
  expect(mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.readOnly).toBe(true);
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="skip"]')!.click();
  expect(mounted.root!.textContent).toContain('Details received');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).fields).toEqual({ email: 'visitor@example.com' });
});
it('keeps enquiry answers on the page and sends nothing when Next or Back is clicked', () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const { mounted } = setup(enquiry as Template);
  const select = mounted.root!.querySelector<HTMLSelectElement>('[name="interest"]')!; select.value = 'quote';
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="back"]')!.click();
  expect(mounted.root!.querySelector<HTMLSelectElement>('[name="interest"]')!.value).toBe('quote');
  expect(fetcher).not.toHaveBeenCalled();
});
it('advances an offer screen without sending visitor data', async () => {
  const { default: offer } = await import('../../resources/templates/library/journey-offer-first.json');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const { mounted } = setup(offer as Template);
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  expect(mounted.root!.querySelector('[name="email"]')).not.toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
it('retries an unconfirmed SMS response with the same grant and never repeats email', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ grant: 'secret' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead' }) })
    .mockRejectedValueOnce(new TypeError('Connection lost'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'lead', replay: true }) });
  vi.stubGlobal('fetch', fetcher);
  const { mounted, captured } = setup(source as Template);
  mounted.root!.querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
  mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click(); await settle();
  mounted.root!.querySelector<HTMLInputElement>('[name="phone"]')!.value = '+12025551234';
  mounted.root!.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click(); await settle();
  expect(mounted.root!.textContent).toContain('Submission not confirmed');
  expect(mounted.root!.querySelector<HTMLInputElement>('[name="phone"]')!.value).toBe('+12025551234');
  mounted.root!.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click(); await settle();
  expect(captured).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls[2][1].body).toBe(fetcher.mock.calls[3][1].body);
  expect(JSON.parse(fetcher.mock.calls[3][1].body)).toMatchObject({grant: 'secret', submission: 'sms-signup', fields: {phone: '+12025551234'}});
  expect(mounted.root!.textContent).toContain('Details received');
});
