import { Link } from "react-router-dom";
import { watanyV4HomepageItems, type WatanyV4DrawerItem } from "../data/watanyFeatureRegistryV4";
import { RoyalGoldFrame } from "../theme/watany-v4/RoyalGoldFrame";
import { WatanyV4Icon } from "../theme/watany-v4/WatanyV4Icon";
import { getWatanyV4IconName } from "../theme/watany-v4/featureIconMap";

function homepageRoute(item: WatanyV4DrawerItem): string {
  return item.route || "/";
}

export default function WatanyV4Homepage() {
  return (
    <main className="watany-v4-homepage" data-v4-homepage="true" dir="rtl">
      <section className="watany-v4-homepage__grid" aria-label="الميزات النشطة">
        {watanyV4HomepageItems.map((item) => {
          const iconName = getWatanyV4IconName(item.id);
          return (
            <Link
              key={item.id}
              to={homepageRoute(item)}
              className="watany-v4-launcher-card"
              data-v4-home-icon={item.id}
              data-v4-icon-name={iconName}
              aria-label={item.labelAr}
            >
              <RoyalGoldFrame className="watany-v4-launcher-card__frame">
                <WatanyV4Icon name={iconName} alt="" aria-hidden="true" />
              </RoyalGoldFrame>
              <span className="watany-v4-launcher-card__label">{item.labelAr}</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}