import React from 'react';
import { AddressWidgetHiddenRouteSmoke } from '../hidden-route-smoke';

export function AddressWidgetDevRouteMount(): React.ReactElement {
  return (
    <main data-apex-proof="address-widget-dev-route-mount" style={{ padding: 16 }}>
      <h1>Address Widget Dev Route Mount</h1>
      <p>This is a hidden development proof mount only. It does not replace production address UI.</p>
      <AddressWidgetHiddenRouteSmoke />
    </main>
  );
}

export default AddressWidgetDevRouteMount;