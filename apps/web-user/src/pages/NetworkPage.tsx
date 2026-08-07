import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LebanonAddressSelector } from "../components/address/LebanonAddressSelector";
import { WatanyFeatureTemplate } from "../components/template";
import { api, type NetworkFamilyTier, type NetworkMembershipProfile, type NetworkVisibilityLevel } from "../lib/api";
import { useApp } from "../store/app";

export default function NetworkPage() {
  const { apiBaseUrl, profile } = useApp();
  const navigate = useNavigate();
  const userId = profile.id || profile.email || profile.phone || "";
  const [membership, setMembership] = useState<NetworkMembershipProfile | null>(null);
  const [displayName, setDisplayName] = useState(profile.name || "");
  const [visibilityLevel, setVisibilityLevel] = useState<NetworkVisibilityLevel>("VISIBLE_CAZA_ONLY");
  const [familyTier, setFamilyTier] = useState<NetworkFamilyTier>("BASIC_FAMILY_MEMBER");
  const [address, setAddress] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    if (!profile.isAuthed || !userId) {
      setMembership(null);
      return () => {
        active = false;
      };
    }

    api.getNetworkMembership(userId, apiBaseUrl)
      .then((nextMembership) => {
        if (!active || !nextMembership) return;
        setMembership(nextMembership);
        setDisplayName(nextMembership.displayName || profile.name || "");
        setVisibilityLevel(nextMembership.visibilityLevel);
        if (nextMembership.familyTier) setFamilyTier(nextMembership.familyTier);
        setAddress(nextMembership.address || null);
      })
      .catch(() => {
        if (active) setMembership(null);
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, profile.isAuthed, profile.name, userId]);

  function requireAuthenticatedWrite() {
    if (profile.isAuthed && userId) {
      return true;
    }

    navigate("/login", {
      state: { from: "/network" },
    });
    return false;
  }

  async function saveDraft() {
    if (!requireAuthenticatedWrite()) {
      return;
    }

    const nextMembership = await api.saveNetworkMembershipDraft({
      userId,
      displayName: displayName.trim() || profile.name || "عضو موطني",
      visibilityLevel,
      familyTier,
      points: membership?.points || 0,
      address,
      isVerifiedUser: Boolean(profile.phoneVerified),
    }, apiBaseUrl);
    setMembership(nextMembership);
    setNotice("تم حفظ مسودة عضوية الشبكة.");
  }

  async function submitMembership() {
    if (!requireAuthenticatedWrite()) {
      return;
    }

    const nextMembership = await api.submitNetworkMembership(userId, apiBaseUrl);
    setMembership(nextMembership);
    setNotice("تم إرسال طلب الانضمام إلى الشبكة.");
  }

  return (
    <WatanyFeatureTemplate category="community" title="الشبكة">
      <main data-watany-feature-route="network" className="hybrid-screen" dir="rtl">
        <section className="hybrid-section">
          <div className="hybrid-section__header">
            <div>
              <span className="hybrid-section__eyebrow">شبكة موطني</span>
              <h1 className="hybrid-section__title">عضوية العائلات والمساندين</h1>
            </div>
          </div>
          <p>أنشئ ملف عضوية مضبوط الظهور بحسب المحافظة أو القضاء، ثم أرسله للمراجعة عند اكتمال البيانات.</p>
        </section>

        <section className="hybrid-section">
          <label>
            <span>الاسم الظاهر</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            <span>مستوى الظهور</span>
            <select value={visibilityLevel} onChange={(event) => setVisibilityLevel(event.target.value as NetworkVisibilityLevel)}>
              <option value="VISIBLE_CAZA_ONLY">ضمن القضاء</option>
              <option value="VISIBLE_VILLAGE_ONLY">ضمن البلدة</option>
              <option value="VISIBLE_NETWORK_ONLY">داخل الشبكة فقط</option>
              <option value="VISIBLE_PUBLIC">عام</option>
              <option value="HIDDEN">مخفي</option>
            </select>
          </label>
          <label>
            <span>نوع العضوية</span>
            <select value={familyTier} onChange={(event) => setFamilyTier(event.target.value as NetworkFamilyTier)}>
              <option value="BASIC_FAMILY_MEMBER">فرد عائلة</option>
              <option value="VERIFIED_FAMILY_MEMBER">فرد موثق</option>
              <option value="CONTRIBUTOR">مساهم</option>
              <option value="COMMUNITY_STEWARD">منسق مجتمع</option>
            </select>
          </label>
          <LebanonAddressSelector value={address as string | null} onChange={setAddress} />
          <div className="community-shortcuts community-shortcuts--dense">
            <button type="button" className="community-shortcut" onClick={() => void saveDraft()}>حفظ المسودة</button>
            <button type="button" className="community-shortcut" onClick={() => void submitMembership()}>إرسال للمراجعة</button>
          </div>
          {notice ? <div className="hybrid-empty-state" role="status">{notice}</div> : null}
          {membership ? <p>حالة العضوية الحالية: {membership.approvalStatus}</p> : null}
        </section>
      </main>
    </WatanyFeatureTemplate>
  );
}