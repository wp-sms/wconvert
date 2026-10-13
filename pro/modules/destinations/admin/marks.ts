import { providerMarks } from '@/destinations/ProviderMark';
import { connectionSetup } from '@/destinations/connectionSetup';

/** The receivers a webhook account can be recognised as, with their own marks. */
export type WebhookTool = 'zapier' | 'make' | 'n8n';

export const toolMarks: Record<WebhookTool, string> = {
  zapier: new URL('./zapier.svg', import.meta.url).href,
  make: new URL('./make.svg', import.meta.url).href,
  n8n: new URL('./n8n.svg', import.meta.url).href,
};

/**
 * Which receiver a webhook's host belongs to, or null for any other — a
 * self-hosted n8n, the merchant's own code — which keeps the webhook icon.
 * Only hosts the tool itself serves, so a lookalike name never borrows a logo.
 */
export function toolOfHost(host: string | null | undefined): WebhookTool | null {
  const name = (host ?? '').toLowerCase();
  if (name === 'hooks.zapier.com') return 'zapier';
  if (name === 'make.com' || name.endsWith('.make.com')) return 'make';
  if (name.endsWith('.n8n.cloud')) return 'n8n';
  return null;
}

/** The destination types this module registers, shown with their own marks. */
export function registerProviderMarks(): void {
  providerMarks.mailchimp = new URL('./mailchimp.svg', import.meta.url).href;
  providerMarks.brevo = new URL('./brevo.svg', import.meta.url).href;
  providerMarks.mailtrap = new URL('./mailtrap.svg', import.meta.url).href;
  connectionSetup.connectionMark = (connection) => {
    if (connection.type !== 'webhook') return undefined;
    const tool = toolOfHost(connection.account_identity);
    return tool === null ? undefined : toolMarks[tool];
  };
}
