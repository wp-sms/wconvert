import assert from 'node:assert/strict';
import { hash } from './storage.mjs';

/** Read-only acceptance against local emulation or the configured HTTPS service. */
export async function verifyService(base, { expected, metadataOrigin, premiumMode = 'unconfigured', fetcher = fetch } = {}) {
  assert(['unconfigured', 'configured'].includes(premiumMode), 'Unknown premium verification mode');
  base = new URL(base);
  const local = ['localhost','127.0.0.1'].includes(base.hostname);
  assert(local || base.protocol === 'https:', 'HTTPS required');
  assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Use a plain service origin');
  async function request(path, limit, options = {}) {
    const response = await fetcher(new URL(path, base), { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
    const chunks = []; let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const {done,value} = await reader.read(); if(done) break;
          size += value.length; assert(size <= limit, 'Response exceeds verification budget'); chunks.push(Buffer.from(value));
        }
      } catch(error) { await reader.cancel(); throw error; }
      finally { reader.releaseLock(); }
    }
    return { response, bytes: Buffer.concat(chunks) };
  }
  const initial = await request('/manifest.json',262144); assert.equal(initial.response.status,200);
  assert.match(initial.response.headers.get('cache-control'), /must-revalidate/);
  const manifest=JSON.parse(initial.bytes);assert.equal(manifest.schema,2);assert.match(manifest.release,/^[a-f0-9]{64}$/);
  if(expected) assert.equal(manifest.release,expected,'The served release differs from the requested release');
  assert(Array.isArray(manifest.pages)&&manifest.pages.length>0&&manifest.pages.length<=16);
  const mirror=value=>{const u=new URL(value);assert.equal(u.protocol,'https:');assert(!u.username&&!u.password&&!u.search&&!u.hash);metadataOrigin??=u.origin;assert.equal(u.origin,metadataOrigin);if(!local)assert.equal(u.origin,base.origin);return u.pathname;};
  const report={release:manifest.release,freePacks:0,premiumRefusals:0,publicPreviews:0,images:0,downloadedSetups:0,metadataOrigin:'',localOnly:local};
  const immutable=async(path,sha,limit)=>{
    const {response,bytes}=await request(path,limit);assert.equal(response.status,200);assert.equal(hash(bytes),sha);assert.match(response.headers.get('cache-control'),/immutable/);
    // Cloudflare may omit Content-Length for compressed responses. Request the
    // identity representation for the byte-count check; GET above still checks
    // the hash of the normally negotiated (decompressed) response.
    const head=await request(path,0,{method:'HEAD',headers:{'Accept-Encoding':'identity'}});assert.equal(head.response.status,200);assert.equal(Number(head.response.headers.get('content-length')),bytes.length);
    const cached=await request(path,0,{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(cached.response.status,304);
    return {response,bytes};
  };
  for(const page of manifest.pages){
    const pagePath=mirror(page.url);assert.match(pagePath,new RegExp(`^/releases/${manifest.release}/page-[1-9][0-9]?\\.json$`));
    const data=JSON.parse((await immutable(pagePath,page.sha256,262144)).bytes);assert.equal(data.release,manifest.release);assert(Array.isArray(data.packs)&&data.packs.length<=50);
    for(const pack of data.packs){
      const previewPath=mirror(pack.preview_url);assert.match(previewPath,/^\/previews\/[a-f0-9]{64}\.html$/);
      const preview=await immutable(previewPath,previewPath.split('/').pop().split('.')[0],2097152);
      assert.match(preview.response.headers.get('content-security-policy'),/sandbox allow-scripts/);report.publicPreviews++;
      const path=mirror(pack.url);assert.match(pack.sha256,/^[a-f0-9]{64}$/);
      if(pack.access==='premium'){
        assert.equal(path,`/downloads/${pack.sha256}.json`);const result=await request(path,16384);
        assert.equal(result.response.status,premiumMode === 'configured' ? 401 : 503,'Anonymous premium downloads must be refused in the expected configuration');assert.equal(result.response.headers.get('cache-control'),'private, no-store');report.premiumRefusals++;continue;
      }
      assert.equal(pack.access,'free');assert.equal(path,`/packs/${pack.sha256}.json`);
      const content=JSON.parse((await immutable(path,pack.sha256,262144)).bytes);assert(content.templates.every(t=>t.tier==='free'));
      report.freePacks++;report.downloadedSetups+=content.playbooks.length;assert((content.assets??[]).length<=16);
      for(const asset of content.assets??[]){
        assert.equal(asset.access,'free');assert.match(asset.sha256,/^[a-f0-9]{64}$/);
        const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[asset.mime];assert(ext);
        const image=await immutable(`/assets/free/${asset.sha256}.${ext}`,asset.sha256,5242880);assert.equal(image.bytes.length,asset.bytes);assert.equal(image.response.headers.get('content-type'),asset.mime);report.images++;
      }
    }
  }
  for(const path of ['/private/packs/x.json','/grants/x.json','/manifest.json?key=not-a-credential']){
    const denied=await request(path,16384);assert([400,404].includes(denied.response.status));assert.match(denied.response.headers.get('cache-control'),/no-store/);
  }
  report.metadataOrigin=metadataOrigin;return report;
}
