import { useState } from "react";
import { adminFetch } from "../../lib/api";
import { AdminDetailDrawer, AdminNotice } from "../admin/AdminPrimitives";
import { downloadImportTemplate, parseImportFile } from "./user-csv";
import type { ImportPreview, ImportRow } from "./user-management-types";

export function ImportUsersDrawer({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [filename, setFilename] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "update">("skip");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function chooseFile(file: File | undefined) {
    setError("");
    setSuccess("");
    setPreview(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("صيغة الاستيراد المدعومة حالياً هي CSV UTF-8.");
      return;
    }
    const parsed = parseImportFile(await file.text());
    if (!parsed.length) {
      setError("لم يتم العثور على صفوف بيانات صالحة في الملف.");
      return;
    }
    setFilename(file.name);
    setRows(parsed);
  }
  async function runImport(dryRun: boolean) {
    if (!rows.length || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await adminFetch("/api/admin/users/import", {
        method: "POST",
        body: JSON.stringify({ rows, dryRun, duplicatePolicy }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.preview) setPreview(body.preview);
        throw new Error(body.error || "تعذر تنفيذ الاستيراد");
      }
      if (dryRun) {
        setPreview(body.preview);
      } else {
        const applied = body.result?.applied ?? 0;
        const inserted = body.result?.inserted ?? 0;
        const updated = body.result?.updated ?? 0;
        const skipped = body.result?.skipped ?? 0;
        setSuccess(`اكتملت العملية: ${applied} مطبّق (${inserted} جديد، ${updated} محدّث) و${skipped} متخطّى.`);
        onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  const canApply = Boolean(preview && preview.invalid === 0 && preview.valid > 0);
  return (
    <AdminDetailDrawer title="استيراد المستخدمين" onClose={onClose}>
      <div className="user-management-card">
        <p className="muted">ارفع CSV UTF-8 ثم نفّذ المعاينة الإلزامية قبل الكتابة. لا يتم استيراد أسرار أو رموز جلسات.</p>
        <div className="user-import-actions">
          <button type="button" className="ghost" onClick={downloadImportTemplate}>تحميل نموذج CSV</button>
          <label className="ghost user-file-button">
            اختيار ملف
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>
        </div>
        {filename ? <p className="muted">الملف: <span dir="ltr">{filename}</span> · {rows.length} صف</p> : null}
        <label className="user-inline-field"><span>سياسة التكرار</span><select value={duplicatePolicy} onChange={(event) => { setDuplicatePolicy(event.target.value as "skip" | "update"); setPreview(null); }}><option value="skip">تخطي الحسابات الموجودة</option><option value="update">تحديث الحساب الموجود المطابق</option></select></label>
        {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        {success ? <AdminNotice tone="success">{success}</AdminNotice> : null}
        {preview ? <div className="user-import-preview">
          <div><strong>{preview.requested}</strong><span>إجمالي</span></div>
          <div><strong>{preview.valid}</strong><span>سيُطبّق</span></div>
          <div><strong>{preview.skipped}</strong><span>سيُتخطّى</span></div>
          <div><strong>{preview.invalid}</strong><span>مرفوض</span></div>
          <div><strong>{preview.duplicates}</strong><span>مكرر</span></div>
        </div> : null}
        {preview?.rows.some((row) => row.errors.length > 0) ? <div className="user-import-errors"><strong>الصفوف التي تحتاج مراجعة</strong>{preview.rows.filter((row) => row.errors.length > 0).slice(0, 12).map((row) => <div key={row.index}>صف {row.index + 2}: {row.errors.join("، ")}</div>)}</div> : null}
        <div className="user-management-form-actions">
          <button type="button" className="ghost" onClick={onClose}>إغلاق</button>
          <button type="button" className="ghost" disabled={!rows.length || busy} onClick={() => void runImport(true)}>{busy ? "جارٍ الفحص..." : "معاينة والتحقق"}</button>
          <button type="button" className="accent" disabled={!canApply || busy} onClick={() => void runImport(false)}>{busy ? "جارٍ الاستيراد..." : "تنفيذ الاستيراد"}</button>
        </div>
      </div>
    </AdminDetailDrawer>
  );
}
