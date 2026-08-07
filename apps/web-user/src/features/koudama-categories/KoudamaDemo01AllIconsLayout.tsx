// APEX_CSS_FREEZE_DISABLED_IMPORT import './KoudamaDemo01AllIconsLayout.css';
import { koudamaDemo01CategoryGroups } from './koudamaCategoryLayoutData';

export function KoudamaDemo01AllIconsLayout() {
  return (
    <main
      dir="rtl"
      data-koudama-demo="demo-01-all-icons-layout"
      aria-labelledby="koudama-demo01-title"
      className="koudama-demo01-layout"
    >
      <header className="koudama-demo01-layout__header">
        <p className="koudama-demo01-layout__eyebrow">Koudama / WatanyBot</p>
        <h1 id="koudama-demo01-title">كل الميزات ضمن مجموعات واضحة</h1>
        <p>
          هذا تخطيط فقط للتصنيف الرئيسي: كل الأيقونات ظاهرة، ومقسّمة داخل صناديق حسب الفئة،
          مع عنوان الفئة في وسط الحافة العلوية. لا يغيّر هذا الملف الثيم، الألوان، الخطوط،
          ملفات CSS العامة، أو نظام الأيقونات الحالي.
        </p>
      </header>

      <section className="koudama-demo01-layout__grid" aria-label="الفئات الرئيسية">
        {koudamaDemo01CategoryGroups.map((group) => (
          <article
            key={group.key}
            className="koudama-demo01-layout__category"
            data-koudama-category={group.key}
          >
            <header className="koudama-demo01-layout__category-header">
              <h2 className="koudama-demo01-layout__category-title">
                <span>{group.title}</span>
                <span aria-hidden="true">{group.icon}</span>
              </h2>
              <p className="koudama-demo01-layout__category-subtitle">{group.subtitle}</p>
            </header>

            <div className="koudama-demo01-layout__items" role="list">
              {group.items.map((item) => (
                <button
                  key={`${group.key}-${item.label}`}
                  type="button"
                  role="listitem"
                  className="koudama-demo01-layout__item"
                  data-koudama-locked={item.locked ? 'true' : 'false'}
                  aria-label={item.label}
                >
                  <span aria-hidden="true" className="koudama-demo01-layout__item-icon">
                    {item.icon}
                  </span>
                  <span className="koudama-demo01-layout__item-label">{item.label}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default KoudamaDemo01AllIconsLayout;
