import { providerMarks } from '@/destinations/ProviderMark';

/** The destination types this module registers, shown with their own marks. */
export function registerProviderMarks(): void {
  providerMarks.mailchimp = new URL('./mailchimp.svg', import.meta.url).href;
  providerMarks.brevo = new URL('./brevo.svg', import.meta.url).href;
  providerMarks.mailtrap = new URL('./mailtrap.svg', import.meta.url).href;
}
