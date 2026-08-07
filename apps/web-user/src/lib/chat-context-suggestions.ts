/**
 * chat-context-suggestions.ts
 * Returns page-aware suggestion chips for the universal chat widget.
 */

function pageContext(label: string) {
  return `السياق: المستخدم حالياً في ${label}. افترض أن السؤال مرتبط بهذه الصفحة أولاً، لكن انتقل إلى موضوع آخر إذا حدده المستخدم صراحة.`;
}

export function getChatSuggestionsForPath(pathname: string): string[] {
  if (pathname.startsWith("/forms")) {
    return ["أبحث عن نموذج", "ما المستندات المطلوبة؟", "كيف أحمّل النموذج؟"];
  }

  if (pathname.startsWith("/salary") || pathname.startsWith("/school-grants")) {
    return ["أحتاج إفادة معاش", "ما البيانات المطلوبة؟", "كيف أطبع الإفادة؟"];
  }

  if (pathname.startsWith("/messages")) {
    return ["أرسل رسالة إلى الإدارة", "كيف أذكر مستخدماً بـ @؟", "ما الرسائل غير المقروءة؟"];
  }

  if (pathname.startsWith("/profile")) {
    return ["حدّث بياناتي", "كيف أوثّق هاتفي؟", "أين رسائلي الداخلية؟"];
  }

  if (pathname.startsWith("/world-cup")) {
    return ["ما مباريات اليوم؟", "افتح التصويتات", "ما روابط البث؟"];
  }

  if (pathname.startsWith("/services/recruitment")) {
    return ["في تطويع جديد؟", "ما شروط التطويع؟", "ما المستندات المطلوبة؟"];
  }

  if (pathname.startsWith("/services/official")) {
    return ["ما الخدمات الرسمية؟", "المساعدات المرضية", "نتائج الفحوصات"];
  }

  if (pathname.startsWith("/jobs")) {
    return ["أبحث عن وظيفة", "في فرص للمحاربين؟", "كيف أرسل طلب توظيف؟"];
  }

  if (pathname.startsWith("/directory")) {
    return ["أبحث عن مستشفى", "أرقام الطوارئ", "إدارة رسمية"];
  }

  if (pathname.startsWith("/marketplace")) {
    return ["أبحث في السوق", "كيف أضيف إعلانًا؟"];
  }

  if (pathname.startsWith("/legal")) {
    return ["أبحث عن قانون", "ما حقوقي كمتقاعد؟", "أبحث عن مرسوم"];
  }

  if (pathname.startsWith("/procedures")) {
    return ["أبحث عن إجراء", "ما خطوات المعاملة؟", "ما المستندات المطلوبة؟"];
  }

  if (pathname.startsWith("/cases")) {
    return ["ما حالة معاملتي؟", "أفتح معاملة جديدة"];
  }

  if (pathname.startsWith("/alerts") || pathname.startsWith("/notifications") || pathname.startsWith("/updates")) {
    return ["ما آخر الأخبار؟", "في إشعارات جديدة؟"];
  }

  // default / home
  return ["أبحث عن معاملة", "أبحث عن نموذج", "أحتاج إفادة معاش"];
}

/**
 * Returns a human-readable page context prefix to prepend to the user's
 * message so the gateway has routing context even without a structured
 * `context` parameter.
 */
export function getPageContextPrefix(pathname: string): string | null {
  if (pathname.startsWith("/forms")) return pageContext("صفحة النماذج");
  if (pathname.startsWith("/salary")) return pageContext("حاسبة المعاش");
  if (pathname.startsWith("/pension")) return pageContext("خدمة إفادة المعاش");
  if (pathname.startsWith("/school-grants")) return pageContext("خدمة المساعدات المدرسية");
  if (pathname.startsWith("/services/recruitment")) return pageContext("قسم التطويع");
  if (pathname.startsWith("/services/official")) return pageContext("صفحة الخدمات الرسمية");
  if (pathname.startsWith("/jobs")) return pageContext("قسم الوظائف");
  if (pathname.startsWith("/messages")) return pageContext("البريد الداخلي");
  if (pathname.startsWith("/profile")) return pageContext("الملف الشخصي");
  if (pathname.startsWith("/world-cup")) return pageContext("لوحة كأس العالم");
  if (pathname.startsWith("/directory")) return pageContext("دليل الأرقام");
  if (pathname.startsWith("/procedures")) return pageContext("صفحة المعاملات");
  if (pathname.startsWith("/marketplace")) return pageContext("السوق المجتمعي");
  if (pathname.startsWith("/cases")) return pageContext("صفحة معاملاتي");
  return null;
}
