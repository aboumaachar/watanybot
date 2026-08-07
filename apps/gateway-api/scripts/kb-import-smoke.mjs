const base = process.env.KB_IMPORT_BASE_URL || "http://localhost:4000";
const payload = {
  sourceName: "APEX smoke raw KB import",
  categoryHint: "recruitment",
  rawText: "Recruitment announcement sample. Deadline, documents, application method, and contact details must be reviewed before publish.",
};

const response = await fetch(`${base}/api/admin/kb-import/raw`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));
if (!response.ok || !data.ok) process.exit(1);