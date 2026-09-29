import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@renderer/mount';
import { bindJourney as free } from '@loader/journey';
import { bindJourney as pro } from '../../pro/modules/journeys/loader/journey';
import { verify } from '@loader/protection';
import type { Template } from '@renderer/types';
import source from '../../resources/templates/library/journey-email-then-sms.json';
vi.mock('@loader/protection', async original => ({ ...await original<typeof import('@loader/protection')>(), verify: vi.fn() }));
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.mocked(verify).mockReset(); });
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
for (const [tier, bind] of [['Free', free], ['Pro', pro]] as const) {
  for (const displayType of ['inline', 'popup']) {
    it(`${tier} ${displayType} preserves cancelled details, focuses the error, and verifies only once across email and SMS`, async () => {
      const reply = (data: object) => ({ ok: true, json: async () => data });
      const fetcher = vi.fn().mockResolvedValueOnce(reply({ challenge: {} }))
        .mockResolvedValueOnce(reply({ challenge: {} })).mockResolvedValueOnce(reply({ grant: 'verified-grant' }))
        .mockResolvedValueOnce(reply({ id: 'lead' })).mockResolvedValueOnce(reply({ id: 'lead' }));
      vi.stubGlobal('fetch', fetcher);
      vi.mocked(verify).mockRejectedValueOnce({ code: 'wconvert_verification_failed', message: 'Verification cancelled. Please try again.' }).mockResolvedValueOnce('token');
      const tag = document.createElement('script'); tag.id = 'wconvert-payload'; tag.setAttribute('data-capture', '/capture'); document.body.append(tag);
      const anchor = document.createElement('div'); document.body.append(anchor);
      const template = structuredClone(source) as Template;
      const mounted = mount({ template, displayType, anchor }); mounted.show();
      const captured = vi.fn(); const refused = vi.fn(); bind(mounted, { id: 'campaign', template, capture_contract: 'contract' }, { onCaptured: captured, onRefused: refused });
      let root = mounted.root!;
      const submit = () => root.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
      root.querySelector<HTMLInputElement>('[name="email"]')!.value = 'visitor@example.com';
      root.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
      submit(); await settle();
      expect(root.textContent).toContain('Verification cancelled. Please try again.');
      expect(root.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe('visitor@example.com');
      expect((root.getRootNode() as ShadowRoot).activeElement).toBe(root.querySelector('[role="alert"]'));
      expect(captured).not.toHaveBeenCalled();
      expect(refused).toHaveBeenLastCalledWith('correctable');
      expect(fetcher).toHaveBeenCalledTimes(1);
      submit(); await settle(); root = mounted.root!;
      expect(root.querySelector('[name="phone"]')).not.toBeNull();
      root.querySelector<HTMLInputElement>('[name="phone"]')!.value = '+12025551234';
      root.querySelector<HTMLInputElement>('[name="consent"]')!.checked = true;
      submit(); await settle();
      expect(mounted.root!.textContent).toContain('Details received');
      expect(captured).toHaveBeenCalledOnce();
      expect(verify).toHaveBeenCalledTimes(2);
      expect(fetcher).toHaveBeenCalledTimes(5);
      expect(JSON.parse(fetcher.mock.calls[2][1].body).verification_token).toBe('token');
      expect(JSON.parse(fetcher.mock.calls[4][1].body).grant).toBe('verified-grant');
      mounted.close();
    });
  }
}
