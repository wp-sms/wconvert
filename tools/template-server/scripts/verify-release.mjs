import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, readPrivateRelease } from './storage.mjs';
import { publishRemote } from './publish-remote.mjs';
import { verifyService } from './verify-service.mjs';
const directory=process.argv[2];
if(!directory||process.argv.length!==3)throw Error('Supply a validated release directory');
const release=readPublicRelease(directory), privateObjects=readPrivateRelease(directory,release);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(new URL('../dist/index.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',r2Buckets:['PUBLIC_TEMPLATES','PRIVATE_TEMPLATES']}));
try {
 await publishRemote(await mf.getR2Bucket('PUBLIC_TEMPLATES'),await mf.getR2Bucket('PRIVATE_TEMPLATES'),release,privateObjects,null);
 const report=await verifyService(release.origin,{expected:release.id,metadataOrigin:release.origin,fetcher:(url,options)=>mf.dispatchFetch(url.href,options)});
 console.log(JSON.stringify({...report,localOnly:true,transport:'Workerd/R2 emulation; no hosted requests'},null,2));
}finally{await mf.dispose();}
