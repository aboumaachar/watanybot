#!/usr/bin/env node
/**
 * WatanyBot safe ReliefWeb Jobs source probe.
 * - Uses ReliefWeb official read-only V2 jobs API.
 * - Lebanon-only small sample.
 * - Metadata/link-oriented normalization.
 * - No aggressive scraping.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (key.startsWith('--')) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key.slice(2), next);
      i += 1;
    } else {
      args.set(key.slice(2), 'true');
    }
  }
}

const projectRoot = args.get('project-root') || process.cwd();
const appname = args.get('appname') || process.env.RELIEFWEB_APPNAME || 'watanybot-koudama-local-dev';
const limit = Math.max(1, Math.min(Number(args.get('limit') || 5), 50));
const write = args.get('write') === 'true';
const outputPath = args.get('output') || path.join(projectRoot, 'apps/gateway-api/data/jobs/reliefweb-normalized-sample.json');
const publicOutputPath = args.get('public-output') || path.join(projectRoot, 'apps/web-user/public/data/jobs/reliefweb-normalized-sample.public.json');
const reportPath = args.get('probe-report') || path.join(projectRoot, '.pma/reliefweb-probe-result.json');

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstName(value) {
  const arr = asArray(value);
  if (arr.length === 0) return '';
  const item = arr[0];
  if (typeof item === 'string') return item;
  if (item && typeof item.name === 'string') return item.name;
  if (item && typeof item.title === 'string') return item.title;
  return '';
}

function textOrEmpty(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function makeHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function publicJobUrl(entry, fields) {
  if (typeof fields.url === 'string' && fields.url.startsWith('http')) return fields.url;
  if (typeof fields.origin === 'string' && fields.origin.startsWith('http')) return fields.origin;
  if (typeof entry.href === 'string' && entry.href.includes('/v2/jobs/')) {
    const id = String(entry.id || '').trim();
    if (id) return `https://reliefweb.int/job/${encodeURIComponent(id)}`;
  }
  const id = String(entry.id || '').trim();
  if (id) return `https://reliefweb.int/job/${encodeURIComponent(id)}`;
  return 'https://reliefweb.int/jobs?advanced-search=%28C137%29&list=Lebanon+Jobs';
}

function normalize(entry) {
  const fields = entry.fields || {};
  const url = publicJobUrl(entry, fields);
  const title = textOrEmpty(fields.title || entry.title || '');
  const organization = firstName(fields.source || fields.sources || fields.organization);
  const deadline = textOrEmpty(fields.date?.closing || fields.closing_date || fields.deadline || '');
  const created = textOrEmpty(fields.date?.created || fields.date?.posted || fields.created || '');
  const city = firstName(fields.city || fields.location || fields.primary_country);
  const jobType = firstName(fields.type || fields.job_type);
  const careerCategory = firstName(fields.career_categories || fields.career_category || fields.category);
  const experience = firstName(fields.experience || fields.job_experience);

  return {
    source_name: 'ReliefWeb Lebanon Jobs',
    source_id: 'reliefweb_lebanon_jobs',
    source_url: 'https://reliefweb.int/jobs?advanced-search=%28C137%29&list=Lebanon+Jobs',
    original_job_url: url,
    reliefweb_api_url: entry.href || '',
    reliefweb_id: String(entry.id || ''),
    title,
    organization,
    sector: careerCategory || 'Humanitarian / NGO',
    job_type: jobType,
    work_mode: '',
    country: 'Lebanon',
    mohafaza: '',
    caza: '',
    village: city,
    exact_address_optional: city,
    deadline,
    date_posted: created,
    date_seen: new Date().toISOString(),
    salary_range_optional: '',
    eligibility: experience,
    veteran_friendly_flag: false,
    family_friendly_flag: false,
    verified_source_status: 'verified_aggregator_api',
    application_method: 'apply_on_original_source',
    language: firstName(fields.language) || '',
    full_text_policy: 'metadata_and_link_only_respect_original_source_ip',
    raw_hash_for_deduplication: makeHash(`${title}|${organization}|${deadline}|${url}`),
    raw_reliefweb_fields_preview: {
      country: fields.country || null,
      source: fields.source || null,
      type: fields.type || null,
      career_categories: fields.career_categories || null,
      experience: fields.experience || null
    }
  };
}

async function requestJobs(payload) {
  const url = `https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appname)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'WatanyBot-ReliefWeb-Probe/1.0' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { parseError: true, text };
  }
  return { ok: response.ok, status: response.status, url, payload, json };
}

const payloads = [
  {
    limit,
    profile: 'full',
    preset: 'latest',
    filter: { operator: 'AND', conditions: [{ field: 'country', value: 'Lebanon' }] },
    sort: ['date.created:desc']
  },
  {
    limit,
    profile: 'full',
    preset: 'latest',
    filter: { operator: 'AND', conditions: [{ field: 'country.name', value: 'Lebanon' }] },
    sort: ['date.created:desc']
  }
];

const attempts = [];
let successful = null;
for (const payload of payloads) {
  const result = await requestJobs(payload);
  attempts.push({
    ok: result.ok,
    status: result.status,
    dataCount: Array.isArray(result.json?.data) ? result.json.data.length : 0,
    payload: result.payload
  });
  if (result.ok && Array.isArray(result.json?.data) && result.json.data.length > 0) {
    successful = result;
    break;
  }
  if (result.ok && Array.isArray(result.json?.data) && successful === null) {
    successful = result;
  }
}

function fallbackNormalizedSample(reasonCode) {
    const now = new Date().toISOString();
    return {
        generated_at: now,
        source: {
            id: 'reliefweb_lebanon_jobs',
            name: 'ReliefWeb Lebanon Jobs',
            api_endpoint: 'https://api.reliefweb.int/v2/jobs',
            appname_used: appname,
            sample_limit: limit,
            safety_policy: 'api_only_metadata_and_link_preserve_original_source_url',
            probe_mode: 'fallback_sample_due_to_api_access_restriction',
            fallback_reason: reasonCode
        },
        location_model: 'mohafaza_caza_village_exact_address',
        count: 1,
        jobs: [
            {
                source_name: 'ReliefWeb Lebanon Jobs',
                source_id: 'reliefweb_lebanon_jobs',
                source_url: 'https://reliefweb.int/jobs?advanced-search=%28C137%29&list=Lebanon+Jobs',
                original_job_url: 'https://reliefweb.int/jobs?advanced-search=%28C137%29&list=Lebanon+Jobs',
                reliefweb_api_url: '',
                reliefweb_id: '',
                title: 'ReliefWeb API access pending appname approval',
                organization: 'ReliefWeb',
                sector: 'Humanitarian / NGO',
                job_type: '',
                work_mode: '',
                country: 'Lebanon',
                mohafaza: '',
                caza: '',
                village: '',
                exact_address_optional: '',
                deadline: '',
                date_posted: '',
                date_seen: now,
                salary_range_optional: '',
                eligibility: '',
                veteran_friendly_flag: false,
                family_friendly_flag: false,
                verified_source_status: 'manual_review_required',
                application_method: 'apply_on_original_source',
                language: 'en',
                full_text_policy: 'metadata_and_link_only_respect_original_source_ip',
                raw_hash_for_deduplication: makeHash(`fallback|${now}|${reasonCode}`),
                raw_reliefweb_fields_preview: {
                    country: null,
                    source: null,
                    type: null,
                    career_categories: null,
                    experience: null
                }
            }
        ]
    };
}

if (!successful?.ok) {
    const allAccessRestricted = attempts.length > 0 && attempts.every((attempt) => attempt.status === 401 || attempt.status === 403);
    if (allAccessRestricted) {
        const output = fallbackNormalizedSample('reliefweb_appname_or_access_restricted');
        const report = {
            ok: true,
            degraded: true,
            status: attempts.at(-1)?.status || 403,
            appname,
            message: 'ReliefWeb API access was restricted (401/403). Wrote a fallback normalized sample for local validation; request appname approval for live data.',
            attempts,
            normalizedCount: output.jobs.length,
            outputPath: write ? outputPath : '',
            publicOutputPath: write ? publicOutputPath : ''
        };

        if (write) {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

            await fs.mkdir(path.dirname(publicOutputPath), { recursive: true });
            const publicOutput = {
                generated_at: output.generated_at,
                source: output.source,
                location_model: output.location_model,
                count: output.count,
                jobs: output.jobs.map((job) => ({
                    source_name: job.source_name,
                    original_job_url: job.original_job_url,
                    title: job.title,
                    organization: job.organization,
                    sector: job.sector,
                    job_type: job.job_type,
                    country: job.country,
                    mohafaza: job.mohafaza,
                    caza: job.caza,
                    village: job.village,
                    deadline: job.deadline,
                    date_posted: job.date_posted,
                    date_seen: job.date_seen,
                    verified_source_status: job.verified_source_status,
                    application_method: job.application_method
                }))
            };
            await fs.writeFile(publicOutputPath, JSON.stringify(publicOutput, null, 2), 'utf8');
        }

        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(JSON.stringify(report, null, 2));
        process.exit(0);
    }

  const failure = {
    ok: false,
    status: successful?.status || attempts.at(-1)?.status || 0,
    appname,
    message: 'ReliefWeb API probe failed. Check network access and appname approval.',
    attempts
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(failure, null, 2), 'utf8');
  console.error(JSON.stringify(failure, null, 2));
  process.exit(2);
}

const entries = Array.isArray(successful.json.data) ? successful.json.data : [];
const normalizedJobs = entries.map(normalize);
const output = {
  generated_at: new Date().toISOString(),
  source: {
    id: 'reliefweb_lebanon_jobs',
    name: 'ReliefWeb Lebanon Jobs',
    api_endpoint: 'https://api.reliefweb.int/v2/jobs',
    appname_used: appname,
    sample_limit: limit,
    safety_policy: 'api_only_metadata_and_link_preserve_original_source_url'
  },
  location_model: 'mohafaza_caza_village_exact_address',
  count: normalizedJobs.length,
  jobs: normalizedJobs
};

const report = {
  ok: true,
  status: successful.status,
  appname,
  attempts,
  normalizedCount: normalizedJobs.length,
  outputPath: write ? outputPath : '',
  publicOutputPath: write ? publicOutputPath : ''
};

if (write) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

  await fs.mkdir(path.dirname(publicOutputPath), { recursive: true });
  const publicOutput = {
    generated_at: output.generated_at,
    source: output.source,
    location_model: output.location_model,
    count: output.count,
    jobs: normalizedJobs.map((job) => ({
      source_name: job.source_name,
      original_job_url: job.original_job_url,
      title: job.title,
      organization: job.organization,
      sector: job.sector,
      job_type: job.job_type,
      country: job.country,
      mohafaza: job.mohafaza,
      caza: job.caza,
      village: job.village,
      deadline: job.deadline,
      date_posted: job.date_posted,
      date_seen: job.date_seen,
      verified_source_status: job.verified_source_status,
      application_method: job.application_method
    }))
  };
  await fs.writeFile(publicOutputPath, JSON.stringify(publicOutput, null, 2), 'utf8');
}

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));