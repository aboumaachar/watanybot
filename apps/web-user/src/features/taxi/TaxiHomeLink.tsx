import { Home24Regular } from "../../theme/watany-v4/legacyIconBridge";
import { Link } from "react-router-dom";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./taxi-home-link.css";

export function TaxiHomeLink() {
  return (
    <Link className="taxi-home-link" data-taxi-home-link to="/" aria-label="العودة إلى الرئيسية">
      <Home24Regular aria-hidden="true" />
      <span>الرئيسية</span>
    </Link>
  );
}

export default TaxiHomeLink;


