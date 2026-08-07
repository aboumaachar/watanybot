import React, { useMemo, useState } from "react";
import {
  useProcedureCatalog,
  ProcedureCatalogSource,
  ProcedureCatalogSection,
} from "../../lib/procedures-api";
import ProceduresCardAdapter from "../universal/ProceduresCardAdapter";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./procedures-catalog-display.css";

function isUniversalProceduresPreviewEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  const params = new URLSearchParams(globalThis.location?.search ?? "");
  return params.get("universalCards") === "1";
}

export function ProceduresCatalogDisplay() {
  const { sources, sections, loading } = useProcedureCatalog(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    sections[0]?.id || null
  );
  const universalPreviewEnabled = useMemo(() => isUniversalProceduresPreviewEnabled(), []);

  if (loading) {
    return (
      <div className="procedures-catalog-display procedures-catalog-display--loading">
        <p>جاري تحميل المعاملات...</p>
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="procedures-catalog-display procedures-catalog-display--empty">
        <p>لا توجد معاملات متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="procedures-catalog-display">
      <div className="procedures-catalog-display__sources" aria-label="مصادر المعاملات">
        {sources.map((source: ProcedureCatalogSource) => (
          <div key={source.id} className="procedures-catalog-display__source">
            <span className="procedures-catalog-display__source-title">
              {source.title}
            </span>
            <span className="procedures-catalog-display__source-count">
              {source.count} إجراء
            </span>
          </div>
        ))}
      </div>

      <div className="procedures-catalog-display__sections">
        {sections.map((section: ProcedureCatalogSection) => {
          const isExpanded = expandedSectionId === section.id;
          const allItems = [
            ...(section.items || []),
            ...(section.notice_items || []),
            ...(section.procedure_items || []),
            ...(section.reference_items || []),
          ];
          const itemCount = allItems.length;

          return (
            <section key={section.id} className="procedures-catalog-display__section">
              <button
                className="procedures-catalog-display__section-header"
                onClick={() =>
                  setExpandedSectionId(
                    isExpanded ? null : section.id
                  )
                }
                aria-expanded={isExpanded}
              >
                <span className="procedures-catalog-display__section-title">
                  {section.title}
                </span>
                <span className="procedures-catalog-display__section-count">
                  {itemCount} إجراء
                </span>
                <span
                  className="procedures-catalog-display__section-toggle"
                  aria-hidden="true"
                >
                  {isExpanded ? "▼" : "▶"}
                </span>
              </button>

              {isExpanded && (
                <div className="procedures-catalog-display__section-items">
                  {allItems.length > 0 ? (
                    allItems.map((item, idx) => {
                      if (universalPreviewEnabled) {
                        return (
                          <ProceduresCardAdapter
                            key={`${section.id}--${item.id || idx}`}
                            procedure={{
                              id: item.id,
                              title: item.title_ar || item.title_clean || item.id,
                              summary: item.summary_lb || item.summary_clean || "لا يوجد وصف",
                              tags: item.tags || [],
                            }}
                          />
                        );
                      }

                      return (
                        <article
                          key={`${section.id}--${item.id || idx}`}
                          className="procedures-catalog-display__item"
                        >
                          <h3 className="procedures-catalog-display__item-title">
                            {item.title_ar || item.title_clean || item.id}
                          </h3>
                          <p className="procedures-catalog-display__item-summary">
                            {item.summary_lb || item.summary_clean || "لا يوجد وصف"}
                          </p>
                          {item.tags && item.tags.length > 0 && (
                            <div className="procedures-catalog-display__item-tags">
                              {item.tags.slice(0, 3).map((tag: string) => (
                                <span
                                  key={`${item.id}-${tag}`}
                                  className="procedures-catalog-display__tag"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <p className="procedures-catalog-display__section-empty">
                      لا توجد عناصر في هذا القسم
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
