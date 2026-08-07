import React from "react";
import { AddressWidgetHiddenRouteSmoke } from "../hidden-route-smoke";
import { AddressWidgetPluginProofPage } from "../browser-proof";

export function AddressWidgetDevRoutePage(): JSX.Element {
  return (
    <main data-apex-proof="address-widget-dev-route" style={{ padding: 16 }}>
      <h1>Address Widget Plugin Dev Proof</h1>
      <p>This page is a non-production proof boundary for the exportable, replaceable, admin-configurable Address Widget plugin.</p>
      <AddressWidgetHiddenRouteSmoke />
      <AddressWidgetPluginProofPage />
    </main>
  );
}

export default AddressWidgetDevRoutePage;