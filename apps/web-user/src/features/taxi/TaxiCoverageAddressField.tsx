import type { ComponentProps } from 'react';
import { AddressWidgetFieldAdapter } from '@watany/address-network';

export type TaxiCoverageAddressFieldContext =
  | 'driver-profile'
  | 'driver-availability'
  | 'vehicle-profile'
  | 'admin-review'
  | 'public-search';

export type TaxiCoverageAddressFieldProps = ComponentProps<typeof AddressWidgetFieldAdapter> & {
  taxiContext?: TaxiCoverageAddressFieldContext;
};

export function TaxiCoverageAddressField(props: TaxiCoverageAddressFieldProps) {
  const adapterProps = { ...props } as Record<string, unknown>;
  // Remove taxiContext before passing to adapter
  if (Object.prototype.hasOwnProperty.call(adapterProps, "taxiContext")) {
    delete adapterProps.taxiContext;
  }
  return <AddressWidgetFieldAdapter {...(adapterProps as ComponentProps<typeof AddressWidgetFieldAdapter>)} />;
}

export default TaxiCoverageAddressField;