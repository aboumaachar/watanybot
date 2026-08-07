/**
 * Predictive Dashboard - Elite Feature
 * Proactive support showing upcoming needs and life events
 * Based on WATANYBOT_ELITE_VISION.md specification
 */
import { useEffect, useState } from 'react';
import { Building24Regular, Clipboard24Regular, LightbulbFilament24Regular, Person24Regular, Sparkle24Regular, Star24Regular } from '../theme/watany-v4/legacyIconBridge';
import { userProfiling } from '../lib/elite';
import type { LifeEvent } from '../lib/elite';
// APEX_CSS_FREEZE_DISABLED_IMPORT import './PredictiveDashboard.css';

interface PredictiveDashboardProps {
  onActionClick?: (action: string) => void;
}

export function PredictiveDashboard({ onActionClick }: PredictiveDashboardProps) {
  const [needs, setNeeds] = useState<LifeEvent[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const predictedNeeds = userProfiling.predictNeeds();
    setNeeds(predictedNeeds);

    try {
      const saved = localStorage.getItem('watany_dismissed_needs');
      if (saved) {
        setDismissed(JSON.parse(saved));
      }
    } catch {
      // Ignore malformed localStorage payloads.
    }
  }, []);

  const handleDismiss = (eventType: string) => {
    const updated = [...dismissed, eventType];
    setDismissed(updated);
    localStorage.setItem('watany_dismissed_needs', JSON.stringify(updated));
  };

  const handleAction = (action: string) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  const visibleNeeds = needs.filter((n) => !dismissed.includes(n.type));

  if (visibleNeeds.length === 0) return null;

  return (
    <div className="pred-dashboard">
      <div className="pred-header">
        <span className="pred-icon"><Sparkle24Regular aria-hidden /></span>
        <h3 className="pred-title">تنبيهات استباقية</h3>
      </div>

      <div className="pred-cards">
        {visibleNeeds.map((need) => (
          <div key={need.type} className={`pred-card pred-card--${need.priority}`}>
            <button className="pred-dismiss" onClick={() => handleDismiss(need.type)} aria-label="إخفاء">
              ×
            </button>

            <div className="pred-card-icon">
              {need.type === 'retirement' && <Star24Regular aria-hidden />}
              {need.type === 'education' && <Person24Regular aria-hidden />}
              {need.type === 'health' && <Building24Regular aria-hidden />}
              {!['retirement', 'education', 'health'].includes(need.type) && <Clipboard24Regular aria-hidden />}
            </div>

            <p className="pred-card-message">{need.message}</p>

            <div className="pred-card-actions">
              {need.actions.map((action) => (
                <button key={action} className="pred-action-btn" onClick={() => handleAction(action)}>
                  {formatActionLabel(action)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    retirement_guide: 'دليل التقاعد',
    pension_calc: 'حاسبة المعاش',
    scholarships: 'المساعدات المدرسية',
    school_list: 'قائمة المدارس',
    hospital_appointment: 'حجز موعد',
    health_services: 'الخدمات الصحية',
  };
  return labels[action] || action;
}

/**
 * Proactive Card - Single notification
 */
interface ProactiveCardProps {
  event: LifeEvent;
  onAction: (action: string) => void;
  onDismiss: () => void;
}

export function ProactiveCard({ event, onAction, onDismiss }: ProactiveCardProps) {
  return (
    <div className={`proactive-card proactive-card--${event.priority}`}>
      <div className="proactive-content">
        <span className="proactive-icon"><LightbulbFilament24Regular aria-hidden /></span>
        <p className="proactive-message">{event.message}</p>
      </div>
      <div className="proactive-actions">
        {event.actions.slice(0, 2).map((action) => (
          <button key={action} className="proactive-btn" onClick={() => onAction(action)}>
            {formatActionLabel(action)}
          </button>
        ))}
        <button className="proactive-dismiss" onClick={onDismiss}>
          لاحقا
        </button>
      </div>
    </div>
  );
}


