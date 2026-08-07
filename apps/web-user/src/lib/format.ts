/** Arabic relative-time label (e.g. "الآن", "قبل 3 ساعة"). */
export function relativeTime(timestamp?: number): string {
  if (!timestamp) return "قريباً";
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (hours < 1) return "الآن";
  if (hours < 24) return `قبل ${hours} ساعة`;
  if (days < 7) return `قبل ${days} يوم`;
  return new Date(timestamp).toLocaleDateString("ar-SA");
}

/** Format number in ar-LB locale. */
export function fmtLBP(n: number): string {
  return n.toLocaleString("ar-LB");
}
