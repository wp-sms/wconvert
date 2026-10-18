import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { hash } from './storage.mjs';

const HASH = '[a-f0-9]{64}';
const keys = {
  public: new RegExp(`^(manifest\\.json|packs/${HASH}\\.json|releases/${HASH}/(manifest|page-[1-9][0-9]?)\\.json|previews/${HASH}\\.html|assets/free/${HASH}\\.(png|jpg|webp))$`),
  private: new RegExp(`^(packs/${HASH}\\.json|assets/premium/${HASH}\\.(png|jpg|webp))$`),
};
const budget = key => key.startsWith('assets/') ? 5242880 : key.startsWith('previews/') ? 2097152 : 262144;
const etag = value => {
  if (typeof value !== 'string' || !/^"[a-f0-9-]+"$/i.test(value)) throw Error('R2 returned an invalid object validator');
  return value.slice(1, -1);
};

export function r2Client(account, env = process.env) {
  if (!/^[a-f0-9]{32}$/.test(account)) throw Error('Invalid Cloudflare account ID');
  const accessKeyId = env.WCONVERT_R2_ACCESS_KEY_ID, secretAccessKey = env.WCONVERT_R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw Error('Missing R2 publisher credentials; use the private credentials file');
  return new S3Client({
    region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey }, maxAttempts: 1,
    followRegionRedirects: false, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 10000, requestTimeout: 60000 },
  });
}

/** Operator-only S3 adapter. No SDK or publishing credential enters the Worker. */
export class R2Storage {
  constructor(client, bucket, scope) {
    if (!keys[scope] || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw Error('Invalid publishing bucket');
    this.client = client; this.bucket = bucket; this.scope = scope;
  }
  checkKey(key) { if (!keys[this.scope].test(key)) throw Error('Object path is outside this publishing scope'); }
  async get(key) {
    this.checkKey(key);
    let result;
    try {
      result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: AbortSignal.timeout(60000) });
      const tag = etag(result.ETag), limit = budget(key);
      if (!Number.isSafeInteger(result.ContentLength) || result.ContentLength <= 0 || result.ContentLength > limit || !result.Body) throw Error();
      let size = 0; const chunks = [];
      for await (const chunk of result.Body) {
        size += chunk.length;
        if (size > limit) throw Error();
        chunks.push(Buffer.from(chunk));
      }
      if (size !== result.ContentLength) throw Error();
      const bytes = Buffer.concat(chunks);
      return { etag: tag, text: async () => bytes.toString('utf8'), arrayBuffer: async () => bytes };
    } catch (error) {
      result?.Body?.destroy?.();
      // A missing bucket or an access denial is not an empty catalogue.
      if (error?.name === 'NoSuchKey' && error?.$metadata?.httpStatusCode === 404) return null;
      throw Error('R2 read failed (access, network or invalid object); no credentials or provider response were logged');
    }
  }
  async put(key, bytes, options) {
    this.checkKey(key);
    const condition = options?.onlyIf;
    if (!Buffer.isBuffer(bytes) || bytes.length <= 0 || bytes.length > budget(key) || hash(bytes) !== options?.sha256) throw Error('Invalid upload bytes/checksum');
    if (!(condition?.etagDoesNotMatch === '*' && !condition.etagMatches)
      && !(typeof condition?.etagMatches === 'string' && /^[a-f0-9-]+$/i.test(condition.etagMatches) && !condition.etagDoesNotMatch)) throw Error('Every R2 write requires an exact precondition');
    try {
      const result = await this.client.send(new PutObjectCommand({
        Bucket: this.bucket, Key: key, Body: bytes, ContentLength: bytes.length,
        ChecksumSHA256: Buffer.from(options.sha256, 'hex').toString('base64'),
        ...(condition.etagMatches ? { IfMatch: `"${condition.etagMatches}"` } : { IfNoneMatch: '*' }),
      }), { abortSignal: AbortSignal.timeout(60000) });
      return { etag: etag(result.ETag) };
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 412) return null;
      // Never blindly retry an uncertain write: it may already have committed.
      throw Error('R2 write was not confirmed. Inspect remote status before retrying; the write may have completed');
    }
  }
}
