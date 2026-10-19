import { useMemo } from "react";

export type FormCreatorFieldType =
  | "text" | "textarea" | "number" | "integer" | "email" | "tel" | "phone"
  | "date" | "select" | "radio" | "checkbox" | "yes_no" | "multi_select"
  | "universal_locator" | "file" | "section";

export type FormConditionAction = "show" | "hide" | "require" | "disable";
export type FormConditionOperator = "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_empty" | "not_empty";
export type FormCreatorCondition = {
  sourceKey: string;
  operator: FormConditionOperator;
  action: FormConditionAction;
  value?: unknown;
};

export type FormCreatorField = {
  key: string;
  label: string;
  type: FormCreatorFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  condition?: FormCreatorCondition;
  pageBreakBefore?: boolean;
  allowedMimeTypes?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
};

type Props = {
  fields: FormCreatorField[];
  onChange: (fields: FormCreatorField[]) => void;
  title?: string;
  description?: string;
  compact?: boolean;
  allowedTypes?: FormCreatorFieldType[];
};

const FIELD_TYPES: Array<{ value: FormCreatorFieldType; label: string }> = [
  { value: "text", label: "نص" }, { value: "textarea", label: "نص طويل" },
  { value: "number", label: "رقم" }, { value: "integer", label: "رقم صحيح" },
  { value: "email", label: "بريد إلكتروني" }, { value: "tel", label: "هاتف" },
  { value: "phone", label: "هاتف" }, { value: "date", label: "تاريخ" },
  { value: "select", label: "قائمة" }, { value: "radio", label: "اختيار واحد" },
  { value: "checkbox", label: "مربع اختيار" }, { value: "yes_no", label: "نعم / لا" },
  { value: "multi_select", label: "اختيار متعدد" },
  { value: "universal_locator", label: "المحدد الجغرافي الشامل" },
  { value: "file", label: "رفع ملف" }, { value: "section", label: "قسم / صفحة" },
];

const DEFAULT_FILE_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ACTIONS: Array<{ value: FormConditionAction; label: string }> = [
  { value: "show", label: "إظهار عندما" }, { value: "hide", label: "إخفاء عندما" },
  { value: "require", label: "اجعله مطلوباً عندما" }, { value: "disable", label: "تعطيل عندما" },
];

const OPERATORS: Array<{ value: FormConditionOperator; label: string }> = [
  { value: "equals", label: "يساوي" }, { value: "not_equals", label: "لا يساوي" },
  { value: "contains", label: "يحتوي" }, { value: "gt", label: "أكبر من" },
  { value: "lt", label: "أصغر من" }, { value: "is_empty", label: "فارغ" },
  { value: "not_empty", label: "غير فارغ" },
];

function freshField(type: FormCreatorFieldType = "text"): FormCreatorField {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  if (type === "section") return { key: `section_${suffix}`, label: "قسم جديد", type, pageBreakBefore: true };
  if (type === "file") return {
    key: `file_${suffix}`, label: "مرفق", type, required: false,
    allowedMimeTypes: [...DEFAULT_FILE_MIMES], maxFiles: 1, maxFileSizeMb: 5,
  };
  return {
    key: `field_${suffix}`,
    label: type === "universal_locator" ? "العنوان" : "حقل جديد",
    type, required: false, options: [],
  };
}

function conditionValueText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : String(value);
}

export default function FormCreatorPlugin({
  fields, onChange, title = "منشئ النماذج",
  description = "أنشئ حقولاً وأقساماً وقواعد شرطية ومرفقات قابلة لإعادة الاستخدام.",
  compact = false, allowedTypes,
}: Readonly<Props>) {
  const typeOptions = allowedTypes ? FIELD_TYPES.filter((option) => allowedTypes.includes(option.value)) : FIELD_TYPES;
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.key)) duplicates.add(field.key);
      seen.add(field.key);
    }
    return duplicates;
  }, [fields]);

  const patch = (index: number, value: Partial<FormCreatorField>) =>
    onChange(fields.map((field, i) => i === index ? { ...field, ...value } : field));
  const remove = (index: number) => onChange(fields.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };
  const duplicate = (index: number) => {
    const source = fields[index];
    const copy: FormCreatorField = {
      ...source,
      key: `${source.key || "field"}_${Date.now().toString().slice(-5)}`,
      label: `${source.label} - نسخة`,
      options: [...(source.options || [])],
      allowedMimeTypes: source.allowedMimeTypes ? [...source.allowedMimeTypes] : undefined,
      condition: source.condition ? { ...source.condition } : undefined,
    };
    onChange([...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)]);
  };

  const conditionSources = (index: number) => fields
    .map((field, i) => ({ field, i }))
    .filter(({ field, i }) => i !== index && field.type !== "section");

  const setConditionAction = (index: number, action: "" | FormConditionAction) => {
    if (!action) return patch(index, { condition: undefined });
    const source = conditionSources(index)[0]?.field;
    if (!source) return;
    patch(index, { condition: {
      sourceKey: fields[index].condition?.sourceKey || source.key,
      operator: fields[index].condition?.operator || "equals",
      action,
      value: fields[index].condition?.value ?? "",
    } });
  };

  return <section className="form-creator-plugin" data-form-creator-plugin="watany-v1" data-form-creator-version="v3a">
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
      <div><h4 style={{ marginBottom: 3 }}>{title}</h4><p className="muted" style={{ marginTop: 0 }}>{description}</p></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="ghost sm" type="button" onClick={() => onChange([...fields, freshField()])}>+ حقل</button>
        <button className="ghost sm" type="button" onClick={() => onChange([...fields, freshField("universal_locator")])}>+ محدد عنوان</button>
        <button className="ghost sm" type="button" onClick={() => onChange([...fields, freshField("file")])}>+ ملف</button>
        <button className="ghost sm" type="button" onClick={() => onChange([...fields, freshField("section")])}>+ قسم / صفحة</button>
      </div>
    </div>
    <div style={{ display: "grid", gap: 10 }}>
      {fields.length === 0 ? <div className="muted">لا توجد حقول بعد. أضف حقلاً أو قسماً أو ملفاً.</div> : null}
      {fields.map((field, index) => {
        const optionField = ["select", "radio", "multi_select"].includes(field.type);
        const sources = conditionSources(index);
        const condition = field.condition;
        const conditionNeedsValue = condition && !["is_empty", "not_empty"].includes(condition.operator);
        return <article key={`${field.key}-${index}`} style={{ border: "1px solid var(--border, #d8e0eb)", borderRadius: 12, padding: compact ? 9 : 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
            <label><span>{field.type === "section" ? "عنوان القسم *" : "عنوان الحقل *"}</span><input value={field.label} onChange={(event) => patch(index, { label: event.target.value })} /></label>
            <label><span>المفتاح *</span><input dir="ltr" value={field.key} aria-invalid={duplicateKeys.has(field.key)} onChange={(event) => patch(index, { key: event.target.value.replace(/[^A-Za-z0-9_]/g, "_") })} /></label>
            <label><span>النوع</span><select value={field.type} onChange={(event) => patch(index, { type: event.target.value as FormCreatorFieldType })}>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          {field.type === "section" ? <div style={{ marginTop: 8 }}>
            <label><input type="checkbox" checked={Boolean(field.pageBreakBefore)} onChange={(event) => patch(index, { pageBreakBefore: event.target.checked })} /> بدء صفحة / خطوة جديدة قبل هذا القسم</label>
          </div> : null}
          {field.type !== "section" && field.type !== "universal_locator" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginTop: 8 }}>
            <label><span>مثال داخل الحقل</span><input value={field.placeholder || ""} onChange={(event) => patch(index, { placeholder: event.target.value })} /></label>
            <label><span>مساعدة قصيرة</span><input value={field.helpText || ""} onChange={(event) => patch(index, { helpText: event.target.value })} /></label>
          </div> : null}
          {field.type === "universal_locator" ? <p className="muted">يستخدم هذا الحقل المحدد الجغرافي الشامل ويحفظ البيانات الإدارية والإحداثيات عند توفرها.</p> : null}
          {optionField ? <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
            <span>الخيارات (افصل بينها بفاصلة)</span>
            <input value={(field.options || []).join(", ")} onChange={(event) => patch(index, { options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
          </label> : null}
          {field.type === "file" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginTop: 8 }}>
            <label><span>أنواع الملفات المسموحة (MIME)</span><input dir="ltr" value={(field.allowedMimeTypes || DEFAULT_FILE_MIMES).join(", ")} onChange={(event) => patch(index, { allowedMimeTypes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            <label><span>الحد الأقصى لعدد الملفات</span><input type="number" min={1} max={10} value={field.maxFiles || 1} onChange={(event) => patch(index, { maxFiles: Math.max(1, Math.min(10, Number(event.target.value) || 1)) })} /></label>
            <label><span>الحد الأقصى لكل ملف (MB)</span><input type="number" min={1} max={10} value={field.maxFileSizeMb || 5} onChange={(event) => patch(index, { maxFileSizeMb: Math.max(1, Math.min(10, Number(event.target.value) || 5)) })} /></label>
          </div> : null}
          {field.type !== "section" && sources.length ? <div style={{ borderTop: "1px dashed var(--border, #d8e0eb)", marginTop: 10, paddingTop: 10 }}>
            <strong style={{ display: "block", marginBottom: 6 }}>منطق شرطي</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
              <label><span>الإجراء</span><select value={condition?.action || ""} onChange={(event) => setConditionAction(index, event.target.value as "" | FormConditionAction)}><option value="">بدون شرط</option>{ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              {condition ? <label><span>الحقل المصدر</span><select value={condition.sourceKey} onChange={(event) => patch(index, { condition: { ...condition, sourceKey: event.target.value } })}>{sources.map(({ field: source }) => <option key={source.key} value={source.key}>{source.label || source.key}</option>)}</select></label> : null}
              {condition ? <label><span>المقارنة</span><select value={condition.operator} onChange={(event) => patch(index, { condition: { ...condition, operator: event.target.value as FormConditionOperator } })}>{OPERATORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label> : null}
              {conditionNeedsValue ? <label><span>القيمة</span><input value={conditionValueText(condition?.value)} onChange={(event) => patch(index, { condition: condition ? { ...condition, value: event.target.value } : undefined })} /></label> : null}
            </div>
          </div> : null}
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            {field.type !== "section" ? <label><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => patch(index, { required: event.target.checked })} /> مطلوب</label> : null}
            <button className="ghost sm" type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button className="ghost sm" type="button" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button className="ghost sm" type="button" onClick={() => duplicate(index)}>استنساخ</button>
            <button className="ghost sm danger" type="button" onClick={() => remove(index)}>حذف</button>
            {duplicateKeys.has(field.key) ? <span className="muted" role="alert">المفتاح مكرر</span> : null}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
