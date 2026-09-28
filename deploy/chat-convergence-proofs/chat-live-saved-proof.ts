import { signAccessToken } from '../../apps/gateway-api/src/auth/auth-middleware.ts';
const base = 'http://127.0.0.1:8015';
async function req(method: string, path: string, token: string, body?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
async function main() {
  const stamp = Date.now();
  const subA = `saved-final-${stamp}-a`;
  const subB = `saved-final-${stamp}-b`;
  const tokenA = signAccessToken({ sub: subA, role: 'accredited', email: `${subA}@watany.test` });
  const tokenB = signAccessToken({ sub: subB, role: 'accredited', email: `${subB}@watany.test` });
  const failures: string[] = [];
  const a = await req('POST', '/api/saved', tokenA, { text: `private-a-${stamp}` });
  const b = await req('POST', '/api/saved', tokenB, { text: `private-b-${stamp}` });
  if (a.status !== 200 || b.status !== 200) failures.push(`create=${a.status}/${b.status}`);
  const idA = a.json?.id;
  const idB = b.json?.id;
  const listA = await req('GET', '/api/saved', tokenA);
  const listB = await req('GET', '/api/saved', tokenB);
  const idsA = (listA.json?.items ?? []).map((x: any) => x.id);
  const idsB = (listB.json?.items ?? []).map((x: any) => x.id);
  const listAOwn = idsA.includes(idA);
  const listAOther = idsA.includes(idB);
  const listBOwn = idsB.includes(idB);
  const listBOther = idsB.includes(idA);
  if (!listAOwn || listAOther || !listBOwn || listBOther) failures.push('listIsolation');
  const crossPatch = await req('PATCH', `/api/saved/${idA}`, tokenB, { status: 'closed' });
  const crossDelete = await req('DELETE', `/api/saved/${idA}`, tokenB);
  if (crossPatch.status !== 404) failures.push(`crossPatch=${crossPatch.status}`);
  if (crossDelete.status !== 404) failures.push(`crossDelete=${crossDelete.status}`);
  const cleanupA = idA ? await req('DELETE', `/api/saved/${idA}`, tokenA) : { status: 0 };
  const cleanupB = idB ? await req('DELETE', `/api/saved/${idB}`, tokenB) : { status: 0 };
  if (cleanupA.status !== 200 || cleanupB.status !== 200) failures.push(`cleanup=${cleanupA.status}/${cleanupB.status}`);
  console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', listAOwn, listAOther, listBOwn, listBOther,
    crossPatchStatus: crossPatch.status, crossDeleteStatus: crossDelete.status,
    cleanupAStatus: cleanupA.status, cleanupBStatus: cleanupB.status, failures }, null, 2));
  process.exitCode = failures.length ? 81 : 0;
}
main().catch((error) => {
  console.error('SAVED_LIVE_PROOF_FATAL', error);
  process.exitCode = 82;
});
