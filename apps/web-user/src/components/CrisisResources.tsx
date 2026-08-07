/**
 * Crisis Resources Modal - Elite Feature
 * Mental health crisis intervention UI
 * Based on WATANYBOT_ELITE_VISION.md specification
 */
import { useEffect, useState } from 'react';
import {
  Building24Regular,
  Chat24Regular,
  Clock24Regular,
  Desktop24Regular,
  Heart24Regular,
  Link24Regular,
  People24Regular,
  Phone24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import type { CrisisResource, CrisisAssessment } from '../lib/elite/emotional-ai';
import { emotionalAI } from '../lib/elite/emotional-ai';
// APEX_CSS_FREEZE_DISABLED_IMPORT import './CrisisResources.css';

interface CrisisResourcesModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly assessment?: CrisisAssessment;
}

export function CrisisResourcesModal({ isOpen, onClose, assessment }: CrisisResourcesModalProps) {
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [primaryHotline, setPrimaryHotline] = useState<CrisisResource | undefined>();

  useEffect(() => {
    if (isOpen) {
      setResources(assessment?.resources || emotionalAI.getCrisisResources());
      setPrimaryHotline(emotionalAI.getPrimaryCrisisHotline());
    }
  }, [isOpen, assessment]);

  if (!isOpen) return null;

  const severity = assessment?.severity || 'medium';
  const isCritical = severity === 'critical' || severity === 'high';

  return (
    <div className="crisis-overlay">
      <button
        type="button"
        className="crisis-backdrop"
        aria-label="إغلاق موارد الأزمات"
        onClick={onClose}
      />
      <dialog
        open
        className="crisis-modal"
        aria-label="موارد الأزمات"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        {/* Header */}
        <div className={`crisis-header ${isCritical ? 'crisis-header--critical' : ''}`}>
          <span className="crisis-icon"><Warning24Regular aria-hidden /></span>
          <h2 className="crisis-title">نحن هنا لمساعدتك</h2>
          <button type="button" className="crisis-close" onClick={onClose} aria-label="إغلاق">×</button>
        </div>

        {/* Main Content */}
        <div className="crisis-body">
          {isCritical && (
            <div className="crisis-urgent-message">
              <p>إذا كنت تمر بأزمة، سلامتك أهم شي.</p>
              <p>أنت مش لحالك — في ناس بتحبّك وبتهتم فيك.</p>
            </div>
          )}

          {/* Primary hotline - prominent */}
          {primaryHotline && (
            <div className="crisis-primary-action">
              <p className="crisis-primary-label">اتصل فوراً للدعم:</p>
              <a
                href={`tel:${primaryHotline.phone}`}
                className="crisis-primary-button"
              >
                <span className="crisis-phone-icon"><Phone24Regular aria-hidden /></span>
                <span className="crisis-phone-number">{primaryHotline.phone}</span>
                <span className="crisis-phone-name">{primaryHotline.name_ar}</span>
              </a>
              <p className="crisis-primary-note">متاح {primaryHotline.available} — سري تماماً</p>
            </div>
          )}

          {/* Resources list */}
          <div className="crisis-resources-section">
            <h3 className="crisis-resources-title">موارد  المتاحة</h3>
            <div className="crisis-resources-grid">
              {resources.map(resource => (
                <div key={resource.id} className="crisis-resource-card">
                  <div className="crisis-resource-type">
                    {resource.type === 'hotline' && <Phone24Regular aria-hidden />}
                    {resource.type === 'hospital' && <Building24Regular aria-hidden />}
                    {resource.type === 'support_group' && <People24Regular aria-hidden />}
                    {resource.type === 'online' && <Desktop24Regular aria-hidden />}
                  </div>
                  <div className="crisis-resource-info">
                    <h4 className="crisis-resource-name">{resource.name_ar}</h4>
                    <p className="crisis-resource-desc">{resource.description_ar}</p>
                    <p className="crisis-resource-available"><Clock24Regular aria-hidden /> {resource.available}</p>
                    {resource.phone && (
                      <a href={`tel:${resource.phone}`} className="crisis-resource-contact">
                        <Phone24Regular aria-hidden /> {resource.phone}
                      </a>
                    )}
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="crisis-resource-contact"
                      >
                        <Link24Regular aria-hidden /> زيارة الموقع
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reassurance message */}
          <div className="crisis-reassurance">
            <p><Heart24Regular aria-hidden style={{ color: 'var(--cedar-600)' }} /> تذكّر: طلب المساعدة علامة قوة وليس ضعف.</p>
            <p>المحاربون القدامى يستحقون أفضل رعاية.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="crisis-footer">
          <button type="button" className="crisis-btn-close" onClick={onClose}>
            أفهم، شكراً
          </button>
        </div>
      </dialog>
    </div>
  );
}

/**
 * Crisis Banner - Less intrusive notification
 */
interface CrisisBannerProps {
  readonly onShowResources: () => void;
  readonly onDismiss: () => void;
}

export function CrisisBanner({ onShowResources, onDismiss }: CrisisBannerProps) {
  return (
    <div className="crisis-banner">
      <div className="crisis-banner-content">
        <span className="crisis-banner-icon"><Heart24Regular aria-hidden style={{ color: 'var(--cedar-600)' }} /></span>
        <span className="crisis-banner-text">
          لاحظنا إنّك قد تكون بحاجة للدعم. نحن هون إذا بدّك تحكي.
        </span>
      </div>
      <div className="crisis-banner-actions">
        <button type="button" className="crisis-banner-btn" onClick={onShowResources}>
          موارد 
        </button>
        <button type="button" className="crisis-banner-dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * Support Info Inline - For medium severity
 */
interface SupportInfoProps {
  readonly onClose?: () => void;
}

export function SupportInfo({ onClose }: SupportInfoProps) {
  const primaryHotline = emotionalAI.getPrimaryCrisisHotline();

  return (
    <div className="support-info-card">
      <div className="support-info-header">
        <span className="support-info-icon"><Chat24Regular aria-hidden /></span>
        <span className="support-info-title">هل تحتاج للتحدث مع أحد؟</span>
        {onClose && (
          <button type="button" className="support-info-close" onClick={onClose}>×</button>
        )}
      </div>
      <p className="support-info-text">
        خط  النفسي متاح على مدار الساعة. الاتصال سري ومجاني.
      </p>
      {primaryHotline && (
        <a href={`tel:${primaryHotline.phone}`} className="support-info-contact">
          <Phone24Regular aria-hidden /> {primaryHotline.phone} - {primaryHotline.name_ar}
        </a>
      )}
    </div>
  );
}


