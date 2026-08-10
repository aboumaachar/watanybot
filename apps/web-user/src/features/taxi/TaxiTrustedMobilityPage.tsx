import React, { FormEvent, useMemo, useState } from 'react';
import './taxiRoyalGold.css';
import {
  TAXI_ACCREDITED_DRIVER_DEMO_LISTINGS_ONLY,
  taxiAccreditedDriverDemoListings,
} from './taxiDemoData';

type RideMode = 'now' | 'scheduled';
type QuickFilter = 'accredited' | 'gps' | 'scheduled' | 'ready';

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="taxi-rg-icon" aria-hidden="true">{children}</span>;
}

export function TaxiTrustedMobilityPage() {
  const [rideMode, setRideMode] = useState<RideMode>('now');
  const [area, setArea] = useState('كل المناطق');
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [readyOnly, setReadyOnly] = useState(true);
  const [pickup, setPickup] = useState('موقعي الحالي');
  const [destination, setDestination] = useState('');
  const [rideDate, setRideDate] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  const areas = ['كل المناطق', 'بيروت', 'المتن', 'كسروان', 'الشوف', 'الشمال', 'الجنوب'];

  const visibleDrivers = useMemo(() => {
    if (!TAXI_ACCREDITED_DRIVER_DEMO_LISTINGS_ONLY) return [];

    return taxiAccreditedDriverDemoListings.filter((driver) => {
      if (area !== 'كل المناطق' && driver.area !== area) return false;
      return true;
    });
  }, [area]);

  function locateCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice('خدمة تحديد الموقع غير متاحة في هذا المتصفح.');
      return;
    }

    setNotice('جارٍ تحديد موقعك…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(5);
        const longitude = position.coords.longitude.toFixed(5);
        setPickup(`GPS: ${latitude}, ${longitude}`);
        setGpsEnabled(true);
        setNotice('تم تحديد موقع الانطلاق بنجاح.');
      },
      () => setNotice('تعذّر تحديد الموقع. يمكنك إدخال موقع الانطلاق يدوياً.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function activateQuickFilter(filter: QuickFilter) {
    if (filter === 'accredited') {
      setNotice('القائمة الحالية مخصصة فقط لنماذج السائقين المعتمدين.');
    }
    if (filter === 'gps') {
      setGpsEnabled(true);
      locateCurrentLocation();
    }
    if (filter === 'scheduled') {
      setRideMode('scheduled');
      setNotice('تم فتح وضع الحجز المسبق.');
    }
    if (filter === 'ready') {
      setReadyOnly(true);
      setNotice('سيُستخدم فلتر الجاهزية عند ربط الخدمة بمصدر البيانات الحقيقي.');
    }
  }

  function submitRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pickup.trim() || !destination.trim()) {
      setNotice('يرجى إدخال موقع الانطلاق والوجهة.');
      return;
    }

    if (rideMode === 'scheduled' && (!rideDate || !rideTime)) {
      setNotice('يرجى تحديد تاريخ ووقت الرحلة المجدولة.');
      return;
    }

    setNotice('تم التحقق من البيانات. إرسال طلب الرحلة ينتظر ربط API الحقيقي؛ لم تُنشأ أي رحلة تجريبية.');
  }

  function selectDriver(driverName: string) {
    setNotice(`السائق ${driverName} معروض كنموذج معتمد فقط. الحجز الفعلي ينتظر ربط API.`);
  }

  function registerDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') || '').trim();
    const phone = String(form.get('phone') || '').trim();

    if (!fullName || !phone) {
      setNotice('يرجى إدخال اسم السائق ورقم الهاتف قبل المتابعة.');
      return;
    }

    setDriverModalOpen(false);
    event.currentTarget.reset();
    setNotice('تم التحقق من نموذج الطلب. الإرسال النهائي ينتظر ربط خدمة الاعتماد الحقيقية؛ لم تُحفظ بيانات Demo.');
  }

  return (
    <main className="taxi-rg-page" dir="rtl">
      <section className="taxi-rg-shell">
        <header className="taxi-rg-header">
          <div className="taxi-rg-brand">
            <div>
              <p className="taxi-rg-eyebrow">خدمة نقل مخصصة للمجتمع</p>
              <h1>التاكسي الموثوق</h1>
              <p>اطلب رحلة فورية، جدولة مسبقة، أو قدّم طلب اعتماد كسائق.</p>
            </div>
          </div>
          <div className="taxi-rg-header-actions">
            <button type="button" className="taxi-rg-btn taxi-rg-btn-secondary" onClick={() => setRideMode('scheduled')}>
              <Icon>◷</Icon>جدولة رحلة
            </button>
            <button type="button" className="taxi-rg-btn taxi-rg-btn-primary" onClick={() => setRideMode('now')}>
              <Icon>⌁</Icon>اطلب رحلة الآن
            </button>
            <button type="button" className="taxi-rg-btn taxi-rg-btn-accent" onClick={() => setDriverModalOpen(true)}>
              <Icon>✓</Icon>تقدّم كسائق معتمد
            </button>
          </div>
        </header>

        <section className="taxi-rg-action-grid" aria-label="اختصارات البحث والتصفية">
          <button type="button" className="active" onClick={() => activateQuickFilter('accredited')}>
            <Icon>✓</Icon>
            <div><strong>سائقون معتمدون</strong><span>عرض نماذج السائقين المعتمدين فقط</span></div>
            <em>قائمة Demo</em>
          </button>
          <button type="button" className={gpsEnabled ? 'active' : ''} onClick={() => activateQuickFilter('gps')}>
            <Icon>⌖</Icon>
            <div><strong>تحديد عبر GPS</strong><span>اكتشف موقع الانطلاق تلقائياً</span></div>
            <em>استخدم GPS</em>
          </button>
          <button type="button" className={rideMode === 'scheduled' ? 'active' : ''} onClick={() => activateQuickFilter('scheduled')}>
            <Icon>◷</Icon>
            <div><strong>حجز مسبق</strong><span>حدد التاريخ والوقت المناسبين</span></div>
            <em>جدولة</em>
          </button>
          <button type="button" className={readyOnly ? 'active' : ''} onClick={() => activateQuickFilter('ready')}>
            <Icon>♢</Icon>
            <div><strong>الأولوية للجاهزين</strong><span>يعمل عند ربط بيانات السائقين الحقيقية</span></div>
            <em>فلتر جاهزية</em>
          </button>
        </section>

        <section className="taxi-rg-layout taxi-rg-layout-single">
          <div className="taxi-rg-main-column">
            <form className="taxi-rg-card taxi-rg-request-card" onSubmit={submitRide}>
              <div className="taxi-rg-section-heading">
                <div><p className="taxi-rg-eyebrow">طلب الرحلة</p><h2>{rideMode === 'now' ? 'ابحث عن سائق متاح الآن' : 'جدول رحلة لوقت لاحق'}</h2></div>
                <div className="taxi-rg-segmented" role="group" aria-label="نوع الرحلة">
                  <button type="button" className={rideMode === 'now' ? 'active' : ''} onClick={() => setRideMode('now')}>الآن</button>
                  <button type="button" className={rideMode === 'scheduled' ? 'active' : ''} onClick={() => setRideMode('scheduled')}>لاحقاً</button>
                </div>
              </div>

              <div className="taxi-rg-filter-row">
                <label><span>المنطقة</span><select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
                <button type="button" className={`taxi-rg-toggle ${gpsEnabled ? 'active' : ''}`} onClick={() => setGpsEnabled((value) => !value)}><span>GPS</span><i /></button>
                <button type="button" className={`taxi-rg-toggle ${readyOnly ? 'active' : ''}`} onClick={() => setReadyOnly((value) => !value)}><span>جاهز الآن</span><i /></button>
              </div>

              <div className="taxi-rg-request-grid">
                <div className="taxi-rg-form-stack">
                  <label className="taxi-rg-field"><span>موقع الانطلاق</span><div className="taxi-rg-input-action"><input value={pickup} onChange={(event) => setPickup(event.target.value)} /><button type="button" onClick={locateCurrentLocation}>تحديد GPS</button></div></label>
                  <label className="taxi-rg-field"><span>الوجهة</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="اكتب الوجهة" /></label>
                  {rideMode === 'scheduled' && <div className="taxi-rg-double-field"><label className="taxi-rg-field"><span>التاريخ</span><input type="date" value={rideDate} onChange={(event) => setRideDate(event.target.value)} /></label><label className="taxi-rg-field"><span>الوقت</span><input type="time" value={rideTime} onChange={(event) => setRideTime(event.target.value)} /></label></div>}
                  <label className="taxi-rg-field"><span>ملاحظات الرحلة</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="حقائب، كرسي متحرك، رحلة عائلية، أو نقطة التقاء" /></label>
                  <button className="taxi-rg-btn taxi-rg-btn-primary taxi-rg-wide" type="submit">متابعة طلب الرحلة</button>
                </div>
                <div className="taxi-rg-map" aria-label="معاينة المسار">
                  <div className="taxi-rg-map-copy"><span>موقع الانطلاق</span><strong>{pickup || 'غير محدد'}</strong><span>الوجهة</span><strong>{destination || 'أدخل الوجهة'}</strong></div>
                  <div className="taxi-rg-route-line" /><div className="taxi-rg-map-pin taxi-rg-map-pin-start">●</div><div className="taxi-rg-map-pin taxi-rg-map-pin-end">◆</div>
                </div>
              </div>
            </form>

            <section className="taxi-rg-card">
              <div className="taxi-rg-section-heading">
                <div>
                  <p className="taxi-rg-eyebrow">قائمة العرض الوحيدة</p>
                  <h2>نماذج سائقين معتمدين</h2>
                  <p className="taxi-rg-section-note">هذه الملفات تجريبية لعرض شكل القائمة فقط، وليست سائقين متاحين للحجز الحقيقي.</p>
                </div>
                <span className="taxi-rg-result-count">{visibleDrivers.length} نموذج</span>
              </div>

              <div className="taxi-rg-driver-list">
                {visibleDrivers.length === 0 && <div className="taxi-rg-empty">لا توجد نماذج معتمدة في المنطقة المحددة.</div>}
                {visibleDrivers.map((driver) => (
                  <article className="taxi-rg-driver-card" key={driver.id}>
                    <div className="taxi-rg-avatar">{driver.name.charAt(0)}</div>
                    <div className="taxi-rg-driver-copy">
                      <div className="taxi-rg-driver-title">
                        <h3>{driver.name}</h3>
                        <span className="taxi-rg-status ready">نموذج معتمد</span>
                      </div>
                      <p>{driver.vehicle} • {driver.plate}</p>
                      <div className="taxi-rg-driver-meta">
                        <span>★ {driver.rating}</span>
                        <span>{driver.trips} رحلة نموذجية</span>
                        <span>{driver.area}</span>
                        <span>{driver.etaMinutes} دقائق تقديرية</span>
                        {driver.supportsAirport && <span>مطار</span>}
                        {driver.supportsFamilyRide && <span>عائلي</span>}
                      </div>
                    </div>
                    <div className="taxi-rg-driver-actions">
                      <a className="taxi-rg-driver-contact taxi-rg-driver-contact-call" href={`tel:${driver.phone}`}>اتصال بالسائق</a>
                      <a className="taxi-rg-driver-contact taxi-rg-driver-contact-chat" href={`https://wa.me/961${driver.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer">محادثة</a>
                      <button className="taxi-rg-driver-preview" type="button" onClick={() => selectDriver(driver.name)}>عرض النموذج</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </div>
        </section>

        {driverModalOpen && (
          <div className="taxi-rg-modal-backdrop" role="presentation" onMouseDown={() => setDriverModalOpen(false)}>
            <section className="taxi-rg-modal" role="dialog" aria-modal="true" aria-labelledby="taxi-driver-modal-title" onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <div>
                  <p className="taxi-rg-eyebrow">فرصة للسائقين</p>
                  <h2 id="taxi-driver-modal-title">التقدّم كسائق تاكسي معتمد</h2>
                  <p>أدخل بياناتك الأساسية. الإرسال النهائي يصبح فعالاً عند ربط خدمة الاعتماد الحقيقية.</p>
                </div>
                <button type="button" className="taxi-rg-modal-close" onClick={() => setDriverModalOpen(false)} aria-label="إغلاق">×</button>
              </header>

              <div className="taxi-rg-modal-benefits">
                <span>✓ اعتماد واضح أمام المستخدمين</span>
                <span>✓ تحديد منطقة الخدمة</span>
                <span>✓ استقبال رحلات فورية ومجدولة بعد التفعيل</span>
                <span>✓ إدارة حالة الجاهزية بعد الاعتماد</span>
              </div>

              <form className="taxi-rg-registration" onSubmit={registerDriver}>
                <label className="taxi-rg-field"><span>الاسم الكامل</span><input name="fullName" required /></label>
                <label className="taxi-rg-field"><span>رقم الهاتف</span><input name="phone" inputMode="tel" required /></label>
                <label className="taxi-rg-field"><span>منطقة الخدمة</span><select name="serviceArea">{areas.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="taxi-rg-field"><span>السيارة ورقم اللوحة</span><input name="vehicle" placeholder="Toyota Corolla — 123456" /></label>
                <label className="taxi-rg-field"><span>رقم رخصة السوق</span><input name="licenseNumber" /></label>
                <div className="taxi-rg-modal-actions">
                  <button className="taxi-rg-btn taxi-rg-btn-secondary" type="button" onClick={() => setDriverModalOpen(false)}>إلغاء</button>
                  <button className="taxi-rg-btn taxi-rg-btn-primary" type="submit">متابعة طلب الاعتماد</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {notice && <div className="taxi-rg-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')}>×</button></div>}
      </section>
    </main>
  );
}

export default TaxiTrustedMobilityPage;
