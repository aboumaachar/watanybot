#!/usr/bin/env node
/*
  WatanyBot safe jobs source ingestion scaffold.
  Default behavior is probe-only. It does not scrape commercial pages aggressively.
*/
import fs from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const registryPath = path.join(root, 'apps', 'gateway-api', 'data', 'jobs', 'job-source-registry.json');
const outputDir = path.join(root, 'apps', 'gateway-api', 'data', 'jobs', 'imports');
const outputPath = path.join(outputDir, 'jobs-ingest-snapshot.json');

function normalizeReliefWebJob(item) {
  const fields = item && item.fields ? item.fields : {};
  const title = fields.title || item.title || '';
  const url = fields.url || item.href || '';
  const organization = Array.isArray(fields.source) && fields.source[0] ? fields.source[0].name : '';
  const deadline = fields.date && fields.date.closing ? fields.date.closing : '';
  return {
    source_name: 'ReliefWeb Lebanon Jobs',
    source_url: 'https://reliefweb.int/jobs?advanced-search=%28C137%29&list=Lebanon+Jobs',
    original_job_url: url,
    title,
    organization,
    sector: 'humanitarian',
    job_type: '',
    work_mode: '',
    mohafaza: '',
    caza: '',
    village: '',
    exact_address_optional: '',
    deadline,
    date_posted: '',
    date_seen: new Date().toISOString(),
    salary_range_optional: '',
    eligibility: '',
    veteran_friendly_flag: false,
    family_friendly_flag: false,
    verified_source_status: 'aggregated_unverified',
    application_method: 'apply_on_original_site',
    language: 'en',
    summary: '',
    raw_hash_for_deduplication: `${url}|${title}|${organization}|${deadline}`
  };
}

async function fetchReliefWebJobs() {
  const body = {
    appname: 'watanybot-local-dev',
    profile: 'list',
    limit: 20,
    filter: { field: 'country', value: 'Lebanon' },
    sort: ['date:desc']
  };
  const response = await fetch('https://api.reliefweb.int/v1/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`ReliefWeb API failed: ${response.status}`);
  }
  const json = await response.json();
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map(normalizeReliefWebJob);
}

async function main() {
  const raw = await fs.readFile(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  const results = [];
  const jobs = [];

  for (const source of sources) {
    if (source.id === 'reliefweb_lebanon_jobs' && args.has('--fetch-reliefweb')) {
      const reliefJobs = await fetchReliefWebJobs();
      jobs.push(...reliefJobs);
      results.push({ id: source.id, status: 'FETCHED_API', count: reliefJobs.length });
    } else {
      results.push({ id: source.id, status: 'REGISTERED_NOT_FETCHED', mode: source.ingestionMode || '' });
    }
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: args.has('--fetch-reliefweb') ? 'reliefweb_api_fetch_plus_registry_probe' : 'registry_probe_only',
    results,
    jobs
  };

  if (args.has('--write')) {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`Wrote ${outputPath}`);
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});