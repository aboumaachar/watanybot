// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import { useApp } from "../store/app";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./pension-attestation.css";

const OFFICIAL_PENSION_SOURCE_URL = "https://eservices.finance.gov.lb/RetiredInfo.aspx";

export function PensionAttestationForm() {
  const { lang } = useApp();

  return (
    <div className="pension-attestation-wrapper">
      <div className="pension-form-container">
        <div className="form-header">
          <h1>{lang === "ar" ? "إفادة الراتب الرسمية" : "Official salary attestation"}</h1>
          <p className="subtitle">
            {lang === "ar"
              ? "افتح الخدمة الرسمية من وزارة المالية عند الجاهزية، مع البقاء داخل موطني حتى تختار المتابعة."
              : "Open the official Ministry of Finance service when you are ready, while staying inside Watany until you choose to continue."}
          </p>
        </div>
        <div className="pension-form">
          <a className="btn-primary" href={OFFICIAL_PENSION_SOURCE_URL} target="_blank" rel="noreferrer noopener">
            {lang === "ar" ? "فتح خدمة وزارة المالية" : "Open Ministry of Finance service"}
          </a>
        </div>
      </div>
    </div>
  );
}
