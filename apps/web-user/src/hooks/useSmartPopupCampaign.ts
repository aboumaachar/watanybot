import { useEffect, useMemo, useState } from "react";
import { SMART_POPUP_CAMPAIGNS, SmartPopupCampaign, selectEligibleSmartPopupCampaign } from "../lib/smartPopupCampaigns";
import { rememberSmartPopupAction, shouldShowSmartPopupCampaign } from "../lib/smartPopupStorage";

export function useSmartPopupCampaign(enabled = true) {
  const [campaign, setCampaign] = useState<SmartPopupCampaign | null>(null);

  const selected = useMemo(() => {
    if (!enabled) return null;
    return selectEligibleSmartPopupCampaign(SMART_POPUP_CAMPAIGNS, (item) =>
      shouldShowSmartPopupCampaign({
        campaignId: item.id,
        stopAfterApplied: item.stopAfterApplied,
        repeatIfCanceled: item.repeatIfCanceled,
        cooldownDaysIfCanceled: item.cooldownDaysIfCanceled,
      })
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !selected) return;
    const timer = window.setTimeout(() => {
      setCampaign(selected);
      rememberSmartPopupAction(selected.id, "seen");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [enabled, selected]);

  function applyCampaign() {
    if (!campaign) return;
    rememberSmartPopupAction(campaign.id, "applied");
    const route = campaign.actionRoute;
    setCampaign(null);
    if (route && typeof window !== "undefined") window.location.assign(route);
  }

  function cancelCampaign() {
    if (!campaign) return;
    rememberSmartPopupAction(campaign.id, "canceled");
    setCampaign(null);
  }

  return { campaign, applyCampaign, cancelCampaign };
}