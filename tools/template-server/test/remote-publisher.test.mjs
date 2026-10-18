import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { R2Storage, r2Client } from '../scripts/r2-storage.mjs';
import { publishRemote, currentRelease } from '../scripts/publish-remote.mjs';
import { cloudTarget } from '../scripts/cloud-config.mjs';
import { hash } from '../scripts/storage.mjs';

const first='a'.repeat(64), second='b'.repeat(64), third='c'.repeat(64);
const free=Buffer.from('{"templates":[]}'), premium=Buffer.from('{"templates":[{"tier":"pro"}]}');
const release=id=>{const manifest=Buffer.from(JSON.stringify({schema:2,release:id,pages:[]}));return {id,manifest,objects:new Map([[`packs/${hash(free)}.json`,free],[`releases/${id}/manifest.json`,manifest]])};};
const privateObjects=new Map([[`packs/${hash(premium)}.json`,premium]]);

/** Exercise the real AWS SDK's signed requests/conditional headers over HTTP. */
async function fixture(t) {
 const objects=new Map(), requests=[];let failKey, corruptKey, dropKey;
 const server=createServer(async(req,res)=>{
  const key=new URL(req.url,'http://localhost').pathname.slice(1);requests.push({method:req.method,key});
  const failure=(status,code)=>{res.writeHead(status,{'Content-Type':'application/xml'});res.end(`<Error><Code>${code}</Code><Message>provider-secret-must-not-leak</Message></Error>`);};
  if(!req.headers.authorization?.startsWith('AWS4-HMAC-SHA256 '))return failure(403,'AccessDenied');
  if(key===failKey)return failure(503,'ServiceUnavailable');
  const old=objects.get(key);
  if(req.method==='GET') {
   if(!old)return failure(404,'NoSuchKey');
   const data=key===corruptKey?Buffer.from('corrupt'):old.bytes;
   res.writeHead(200,{'Content-Length':data.length,ETag:`"${old.etag}"`});res.end(data);return;
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
  if(req.headers['x-amz-checksum-sha256']!==Buffer.from(hash(bytes),'hex').toString('base64'))return failure(400,'BadDigest');
  if(!req.headers['if-match']&&!req.headers['if-none-match'])return failure(400,'MissingCondition');
  if((req.headers['if-none-match']==='*'&&old)||(req.headers['if-match']&&req.headers['if-match']!==`"${old?.etag}"`))return failure(412,'PreconditionFailed');
  const etag=createHash('md5').update(bytes).digest('hex');objects.set(key,{bytes,etag});
  if(key===dropKey){req.socket.destroy();return;}
  res.writeHead(200,{ETag:`"${etag}"`});res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=new S3Client({region:'auto',endpoint:`http://127.0.0.1:${server.address().port}`,forcePathStyle:true,credentials:{accessKeyId:'fixture',secretAccessKey:'fixture-secret'},maxAttempts:1,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 t.after(async()=>{client.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return {objects,requests,publicBucket:new R2Storage(client,'templates-public','public'),privateBucket:new R2Storage(client,'templates-private','private'),fail:key=>failKey=key,corrupt:key=>corruptKey=key,drop:key=>dropKey=key};
}

test('S3 wire contract: initial publication, unchanged retry, update and retained rollback',async t=>{
 const f=await fixture(t);
 const one=await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);assert.equal(one.created,2);
 const writes=f.requests.filter(r=>r.method==='PUT');assert.match(writes[0].key,/templates-private\/packs/);assert.equal(writes.at(-1).key,'templates-public/manifest.json');
 assert.equal((await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,first)).created,0);
 assert.equal((await publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first)).created,1);
 await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,second);assert.equal(await currentRelease(f.publicBucket),first);
 assert(f.objects.has(`templates-public/releases/${second}/manifest.json`));
 assert(!f.objects.has(`templates-public/packs/${hash(premium)}.json`));
});

test('S3 concurrent publishers cannot both change the same manifest',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 const outcomes=await Promise.allSettled([publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first),publishRemote(f.publicBucket,f.privateBucket,release(third),privateObjects,first)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert([second,third].includes(await currentRelease(f.publicBucket)));
});

test('stale expected release refuses before any private or public upload',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 const before=f.requests.length;await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,null),/Current release changed/);
 assert(f.requests.slice(before).every(r=>r.method==='GET'));
});

test('interrupted dependency uploads preserve catalogue and can be resumed',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 f.fail(`templates-public/releases/${second}/manifest.json`);
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first),e=>!e.message.includes('provider-secret'));
 assert.equal(await currentRelease(f.publicBucket),first);
 f.fail(undefined);await publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first);assert.equal(await currentRelease(f.publicBucket),second);
});

test('private upload failure never exposes a catalogue needing missing premium files',async t=>{
 const f=await fixture(t);f.fail(`templates-private/packs/${hash(premium)}.json`);
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null),/R2 read failed/);
 assert.equal(await currentRelease(f.publicBucket),null);
});

test('changed existing immutable bytes block promotion',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 f.corrupt(`templates-public/packs/${hash(free)}.json`);
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first),/Immutable object changed/);
 assert.equal(await currentRelease(f.publicBucket),first);
});

test('corrupt first read-back after a successful public PUT preserves the old manifest',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 const key=`templates-public/releases/${second}/manifest.json`;
 f.corrupt(key);
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(second),privateObjects,first),/Read-back failed/);
 assert(f.objects.has(key),'The PUT must have completed before the corrupt read-back');
 assert.equal(f.requests.filter(r=>r.method==='PUT'&&r.key===key).length,1);
 assert.equal(await currentRelease(f.publicBucket),first);
});

test('corrupt first read-back after a successful private PUT preserves the old manifest',async t=>{
 const f=await fixture(t);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null);
 const updated=Buffer.from('{"templates":[{"tier":"pro","name":"Updated"}]}');
 const path=`packs/${hash(updated)}.json`, key=`templates-private/${path}`;
 f.corrupt(key);
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(second),new Map([[path,updated]]),first),/Private read-back failed/);
 assert(f.objects.has(key),'The private PUT must have completed before the corrupt read-back');
 assert(!f.objects.has(`templates-public/releases/${second}/manifest.json`));
 assert.equal(await currentRelease(f.publicBucket),first);
});

test('lost promotion response is reported as uncertain, never blindly retried',async t=>{
 const f=await fixture(t);f.drop('templates-public/manifest.json');
 await assert.rejects(publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,null),/write may have completed/);
 assert.equal(f.requests.filter(r=>r.method==='PUT'&&r.key==='templates-public/manifest.json').length,1);
 assert.equal(await currentRelease(f.publicBucket),first);
 f.drop(undefined);await publishRemote(f.publicBucket,f.privateBucket,release(first),privateObjects,first);
});

test('bounded reads, missing bucket/access errors and scope restrictions fail closed',async()=>{
 for(const name of ['NoSuchBucket','AccessDenied']){
  const bucket=new R2Storage({send:async()=>{throw Object.assign(Error('SECRET'),{name,$metadata:{httpStatusCode:name==='NoSuchBucket'?404:403}});}},'templates-public','public');
  await assert.rejects(bucket.get('manifest.json'),e=>e.message.includes('R2 read failed')&&!e.message.includes('SECRET'));
 }
 for(const result of [{ContentLength:99999999,Body:Readable.from(['x'])},{ContentLength:1,Body:Readable.from([Buffer.alloc(262145)])}]){
  const bucket=new R2Storage({send:async()=>({...result,ETag:'"abc"'})},'templates-public','public');await assert.rejects(bucket.get('manifest.json'),/R2 read failed/);
 }
 const bucket=new R2Storage({send:()=>{throw Error('must not send');}},'templates-private','private');
 await assert.rejects(bucket.get('grants/'+first+'.json'),/outside/);
 await assert.rejects(bucket.put(`packs/${first}.json`,free,{}),/Invalid upload/);
 assert.throws(()=>r2Client('a'.repeat(32),{}),/Missing R2/);
 const config={account_id:'a'.repeat(32),routes:[{pattern:'templates.example',custom_domain:true}],r2_buckets:[{binding:'PUBLIC_TEMPLATES',bucket_name:'templates-public'},{binding:'PRIVATE_TEMPLATES',bucket_name:'templates-private'}],workers_dev:false,preview_urls:false};
 assert.equal(cloudTarget(config).origin,'https://templates.example');
 assert.throws(()=>cloudTarget({...config,workers_dev:true}),/Configure/);
 assert.throws(()=>cloudTarget({...config,r2_buckets:config.r2_buckets.map(b=>({...b,bucket_name:'same-bucket'}))}),/Configure/);
});
