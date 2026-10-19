import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  console.error(`OPS_BUILD_GATE=FAIL ${message}`);
  process.exit(1);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiledRouterBase = (bundle, base) => {
  if (bundle.includes(`"${base}".replace(`) || bundle.includes(`'${base}'.replace(`)) return true;
  const escapedBase = escapeRegExp(base);
  const assignment = new RegExp(`const\\s+([A-Za-z_$][\\w$]*)=[A-Za-z_$][\\w$]*\\(["']${escapedBase}["']\\);`, 'g');
  for (const match of bundle.matchAll(assignment)) {
    const variable = match[1];
    if (new RegExp(`basename:${escapeRegExp(variable)}(?:[,}])`).test(bundle)) return true;
  }
  return false;
};

const dist = path.resolve(process.argv[2] || 'dist');
const indexPath = path.join(dist, 'index.html');
const assetsDir = path.join(dist, 'assets');
if (!fs.existsSync(indexPath)) fail('INDEX_MISSING');
if (!fs.existsSync(assetsDir)) fail('ASSETS_DIR_MISSING');

const index = fs.readFileSync(indexPath, 'utf8');
if (index.includes('/superadmin/assets/')) fail('INDEX_SUPERADMIN_ASSET_BASE');
const moduleMatch = index.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i);
if (!moduleMatch) fail('MODULE_SCRIPT_MISSING');
const mainRef = moduleMatch[1];
if (!mainRef.startsWith('/ops/assets/') || !mainRef.endsWith('.js')) fail(`MAIN_SCRIPT_NOT_OPS_ROOTED:${mainRef}`);

const attributeRefs = [...index.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
const indexRefs = attributeRefs.filter((ref) => ref.startsWith('/ops/assets/') && /\.(?:js|css)$/i.test(ref));
if (indexRefs.length < 2) fail(`INDEX_ASSET_COUNT_${indexRefs.length}`);
for (const ref of indexRefs) {
  const localPath = path.join(dist, ref.slice('/ops/'.length));
  if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) fail(`INDEX_ASSET_MISSING:${ref}`);
}

const mainPath = path.join(dist, mainRef.slice('/ops/'.length));
const main = fs.readFileSync(mainPath, 'utf8');
const compact = main.replace(/\s+/g, '');
if (!compact.includes('return"/ops/"+') && !compact.includes("return'/ops/'+")) fail('MAIN_DYNAMIC_BASE_NOT_OPS');
if (compact.includes('return"/superadmin/"+') || compact.includes("return'/superadmin/'+")) fail('MAIN_DYNAMIC_BASE_SUPERADMIN');
if (!compiledRouterBase(main, '/ops/')) fail('ROUTER_BASENAME_NOT_OPS');
if (compiledRouterBase(main, '/superadmin/')) fail('ROUTER_BASENAME_SUPERADMIN');

const files = fs.readdirSync(assetsDir).filter((name) => fs.statSync(path.join(assetsDir, name)).isFile());
for (const name of files) if (fs.statSync(path.join(assetsDir, name)).size === 0) fail(`ZERO_BYTE_ASSET:${name}`);
const lazyPattern = new RegExp('assets/([A-Za-z0-9._-]+\\.(?:js|css))', 'g');
const lazyNames = new Set([...main.matchAll(lazyPattern)].map((match) => match[1]));
for (const name of lazyNames) if (!fs.existsSync(path.join(assetsDir, name))) fail(`LAZY_ASSET_MISSING:${name}`);

const jobs = files.filter((name) => /^JobsAdminPage-.*\.js$/.test(name));
const forms = files.filter((name) => /^UniversalFormsAdminPage-.*\.js$/.test(name));
const creators = files.filter((name) => /^FormCreatorPlugin-.*\.js$/.test(name));
if (jobs.length !== 1) fail(`JOBS_CHUNK_COUNT_${jobs.length}`);
if (forms.length !== 1) fail(`FORMS_CHUNK_COUNT_${forms.length}`);
if (creators.length !== 1) fail(`FORM_CREATOR_CHUNK_COUNT_${creators.length}`);
const jobsText = fs.readFileSync(path.join(assetsDir, jobs[0]), 'utf8');
const formsText = fs.readFileSync(path.join(assetsDir, forms[0]), 'utf8');
const creatorText = fs.readFileSync(path.join(assetsDir, creators[0]), 'utf8');
if (!jobsText.includes('universal_locator') || !jobsText.includes('job-location')) fail('JOB_LOCATOR_TOKENS_MISSING');
if (!formsText.includes('FORM CREATOR V2') && !formsText.includes('/api/admin/forms')) fail('UNIVERSAL_FORMS_TOKENS_MISSING');
if (!creatorText.includes('universal_locator')) fail('FORM_CREATOR_LOCATOR_TOKEN_MISSING');

console.log(`OPS_INDEX_ASSET_COUNT=${indexRefs.length}`);
console.log(`OPS_LAZY_ASSET_COUNT=${lazyNames.size}`);
console.log('OPS_MAIN_DYNAMIC_BASE=PASS');
console.log('OPS_ROUTER_BASENAME=PASS');
console.log('OPS_JOB_LOCATOR_CHUNK=PASS');
console.log('OPS_FORM_CREATOR_CHUNKS=PASS');
console.log('OPS_BUILD_GATE=PASS');
