import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
export type Config = Record<string, unknown>;

export type TransferDesign = Template & { name: string; display_type: string };
export interface TransferPreview {
  digest: string;
  patch: Config & { template: Template; display_type: string };
  notes: string[];
  links: { url: string; uses: number }[];
  assets: { id: string }[];
}
export interface TransferUpload { id: string; name: string; images: number; notes: string[] }
export interface TransferStatus { zip: boolean; max_bytes: number; upload_images: boolean }
const base = '/wconvert/v1/template-transfer';
export const transferStatus = () => apiFetch<TransferStatus>({ path: base });
export const uploadDesign = (file: File) => {
  const body = new FormData(); body.append('file', file);
  return apiFetch<TransferUpload>({ path: `${base}/imports`, method: 'POST', body });
};
export const prepareImport = (id: string, optin: string, config: Config, mode: 'file' | 'keep', links: Record<string, string>) =>
  apiFetch<TransferPreview>({ path: `${base}/imports/${id}/prepare`, method: 'POST', data: { optin, config, mode, links } });
export const applyImport = (id: string, digest: string) =>
  apiFetch<{ patch: Config }>({ path: `${base}/imports/${id}/apply`, method: 'POST', data: { digest, reviewed: true } });
export const cancelImport = (id: string) => apiFetch({ path: `${base}/imports/${id}`, method: 'DELETE' });
export const importImage = async (id: string, asset: string) => {
  const response = await apiFetch({ path: `${base}/imports/${id}/images/${asset}`, parse: false });
  if (!response.ok) throw await response.json();
  return URL.createObjectURL(await response.blob());
};
export const downloadDesign = async (design: TransferDesign, omit: string[]) => {
  const response = await apiFetch({ path: `${base}/export`, method: 'POST', data: { design, omit }, parse: false });
  if (!response.ok) throw await response.json();
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'design.wconvert.zip';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Only server-generated asset markers are substituted; unmatched markers never fetch remotely. */
export function withPreviewImages(template: Template, urls: Record<string, string>): Template {
  return JSON.parse(JSON.stringify(template, (_key, value: unknown) => typeof value === 'string'
    ? value.replace(/https:\/\/wconvert\.invalid\/transfer\/([a-f0-9]{32})/g, (_match, id: string) => urls[id] ?? '') : value)) as Template;
}
