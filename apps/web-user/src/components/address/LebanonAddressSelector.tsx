
import { useEffect, useMemo, useState } from "react";
import type { LebanonAddressRow, LebanonAddressValue } from "./addressTypes";
import { normalizeLebanonAddressValue, validateLebanonAddressValue } from "./addressValidation";
import { loadCanonicalRuntime } from "../../../../../packages/watany-core/src/shared-engines/address/canonical.loader";


function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
}

export type LebanonAddressSelectorProps = Readonly<{
  value?: Partial<LebanonAddressValue> | string | null;
  onChange?: (value: LebanonAddressValue) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  exactAddressLabel?: string;
  exactAddressPlaceholder?: string;
}>;

export function LebanonAddressSelector({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  exactAddressLabel = "العنوان التفصيلي",
  exactAddressPlaceholder = "اكتب الشارع، المبنى، المركز أو أي تفصيل إضافي",
}: LebanonAddressSelectorProps) {
  const normalizedValue = useMemo(() => normalizeLebanonAddressValue(value), [value]);
  const [rows, setRows] = useState<LebanonAddressRow[]>([]);
  const [mohafaza, setMohafaza] = useState(normalizedValue.mohafaza);
  const [qaza, setQaza] = useState(normalizedValue.qaza);
  const [village, setVillage] = useState(normalizedValue.village);
  const [exactAddress, setExactAddress] = useState(normalizedValue.exactAddress ?? "");
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "unavailable">("loading"); // Removed fallback state

  useEffect(() => {
    if (typeof value === "string") return;
    setMohafaza(normalizedValue.mohafaza);
    setQaza(normalizedValue.qaza);
    setVillage(normalizedValue.village);
    setExactAddress(normalizedValue.exactAddress ?? "");
  }, [normalizedValue.exactAddress, normalizedValue.mohafaza, normalizedValue.qaza, normalizedValue.village, value]);

  useEffect(() => {
    let active = true;
    loadCanonicalRuntime()
        .then((payload) => {
          const governorates = new Map(payload.governorates.map((item) => [item.id, item.nameAr]));
          const parents = new Map([
            ...payload.districts.map((item) => [item.id, { governorateId: item.governorateId, nameAr: item.nameAr }] as const),
            ...payload.districtEquivalents.map((item) => [item.id, { governorateId: item.governorateId, nameAr: item.nameAr }] as const),
          ]);
          const canonicalRows = payload.localities.flatMap<LebanonAddressRow>((item) => {
            const parent = parents.get(item.districtId);
            const mohafaza = governorates.get(item.governorateId) ?? "";
            return parent && item.nameAr ? [{ mohafaza, qaza: parent.nameAr, village: item.nameAr, displayName: `${mohafaza} / ${parent.nameAr} / ${item.nameAr}`, source: "universal-locator", status: "approvedCanonical", governorateId: item.governorateId, districtOrEquivalentId: item.districtId, localityId: item.id, localityPcode: item.pcode }] : [];
          });
          if (!canonicalRows.length) throw new Error("LOCATOR_DATASET_EMPTY");
          if (active) { setRows(canonicalRows); setDataStatus("ready"); }
        })
        .catch(() => active && setDataStatus("unavailable"));
    return () => {
      active = false;
    };
  }, []);

  const mohafazaOptions = useMemo(() => uniq(rows.map((row) => row.mohafaza)), [rows]);
  const qazaOptions = useMemo(() => uniq(rows.filter((row) => row.mohafaza === mohafaza).map((row) => row.qaza)), [rows, mohafaza]);
  const villageOptions = useMemo(
    () => uniq(rows.filter((row) => row.mohafaza === mohafaza && row.qaza === qaza).map((row) => row.village)),
    [rows, mohafaza, qaza],
  );

  function emit(next: Partial<LebanonAddressValue>) {
    const selectedRow = rows.find((row) => row.mohafaza === (next.mohafaza ?? mohafaza) && row.qaza === (next.qaza ?? qaza) && row.village === (next.village ?? village));
    const checked = validateLebanonAddressValue({
      mohafaza,
      qaza,
      village,
      exactAddress,
      source: "universal-locator",
      status: dataStatus,
      governorateId: selectedRow?.governorateId,
      districtOrEquivalentId: selectedRow?.districtOrEquivalentId,
      localityId: selectedRow?.localityId,
      localityPcode: selectedRow?.localityPcode,
      locationDatasetVersion: "1.1.1",
      locationApprovalStatus: "approvedCanonical",
      ...next,
    });
    onChange?.(checked.value);
  }

  return (
    <fieldset className={`lebanon-address-selector ${className}`.trim()} data-lebanon-address-selector="true" disabled={disabled}>
      <legend>العنوان الإداري في لبنان</legend>
      <label>
        <span>المحافظة</span>
        <select
          value={mohafaza}
          required={required}
          disabled={disabled || dataStatus !== "ready"}
          onChange={(event) => {
            const nextMohafaza = event.target.value;
            setMohafaza(nextMohafaza);
            setQaza("");
            setVillage("");
            emit({ mohafaza: nextMohafaza, qaza: "", village: "" });
          }}
        >
          <option value="">اختر المحافظة</option>
          {mohafazaOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>القضاء</span>
        <select
          value={qaza}
          disabled={disabled || !mohafaza}
          onChange={(event) => {
            const nextQaza = event.target.value;
            setQaza(nextQaza);
            setVillage("");
            emit({ qaza: nextQaza, village: "" });
          }}
        >
          <option value="">اختر القضاء</option>
          {qazaOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>البلدة / القرية</span>
        <select
          value={village}
          disabled={disabled || !qaza}
          onChange={(event) => {
            const nextVillage = event.target.value;
            setVillage(nextVillage);
            emit({ village: nextVillage });
          }}
        >
          <option value="">اختر البلدة أو القرية</option>
          {villageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>{exactAddressLabel}</span>
        <input
          type="text"
          value={exactAddress}
          placeholder={exactAddressPlaceholder}
          onChange={(event) => {
            const nextExactAddress = event.target.value;
            setExactAddress(nextExactAddress);
            emit({ exactAddress: nextExactAddress });
          }}
        />
      </label>

      <p className="lebanon-address-selector__hint">
        {dataStatus === "unavailable" ? "تعذر تحميل محدد المواقع الموحد. لا توجد قائمة احتياطية." : dataStatus === "ready" ? "القائمة مرتبطة بمحدد المواقع الموحد المعتمد." : "جارٍ تحميل قائمة المواقع..."}
      </p>
    </fieldset>
  );
}

export default LebanonAddressSelector;