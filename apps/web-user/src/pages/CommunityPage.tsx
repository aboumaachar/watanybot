import { CommunityScreen } from "../components/CommunityScreen";
import { WatanyFeatureTemplate } from "../components/template";
import { useApp, type Mode } from "../store/app";

export default function CommunityPage() {
  const { setMode } = useApp();

  function handleNavigate(mode: Mode) {
    setMode(mode);
  }

  return (
    <WatanyFeatureTemplate category="community" title="المجتمع">
      <div data-watany-feature-route="community">
        <CommunityScreen onNavigate={handleNavigate} />
      </div>
    </WatanyFeatureTemplate>
  );
}