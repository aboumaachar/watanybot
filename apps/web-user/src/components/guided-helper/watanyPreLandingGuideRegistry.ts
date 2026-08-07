export type WatanyPreLandingGuide = { key: string; route: string; aliases?: string[]; titleAr: string; bodyAr: string; profileHintAr?: string };
function base(route: string): string { return (route.split('#')[0].split('?')[0] || '/'); }
export function normalizeWatanyPreLandingRoute(route: string): string {
  let value = route && route.trim() ? route.trim() : '/';
  try { const url = new URL(value, window.location.origin); if (url.origin === window.location.origin) value = `${url.pathname}${url.search}${url.hash}`; } catch {}
  value = value.replace(/^\/worldcup(?=$|[/?#])/, '/mcp/world-cup');
  value = value.replace(/^\/world-cup(?=$|[/?#])/, '/mcp/world-cup');
  value = value.replace(/^\/mcp\/worldcup(?=$|[/?#])/, '/mcp/world-cup');
  return value;
}
export const WATANY_PRELANDING_GUIDES: WatanyPreLandingGuide[] = [
  { key:'prelanding:salary', route:'/salary', titleAr:'حاسبة المعاش', bodyAr:'هذه الصفحة تساعدك على حساب تقدير أولي للمعاش أو الراتب بحسب الرتبة والدرجة والوضع العائلي.', profileHintAr:'إكمال الملف الشخصي يساعد موطني على تعبئة بعض المعلومات تلقائياً لاحقاً.' },
  { key:'prelanding:procedures', route:'/procedures', titleAr:'دليل المعاملات', bodyAr:'هنا تجد خطوات المعاملات، الأوراق المطلوبة، والروابط أو النماذج المرتبطة بها بطريقة مبسطة.' },
  { key:'prelanding:forms', route:'/forms', titleAr:'النماذج الرسمية', bodyAr:'هذه الصفحة تجمع النماذج والملفات التي يمكن فتحها أو تنزيلها أو مشاركتها عند الحاجة.' },
  { key:'prelanding:legal', route:'/legal', aliases:['/laws','/documents?tab=laws'], titleAr:'القوانين والحقوق', bodyAr:'هنا يمكنك تصفح القوانين والتوجيهات والمواد المرتبطة بحقوق العسكريين المتقاعدين وعائلاتهم.' },
  { key:'prelanding:jobs', route:'/jobs', aliases:['/recruitment','/services/recruitment','/opportunities','/freelance-services'], titleAr:'الوظائف والفرص', bodyAr:'هذه الصفحة مخصصة للفرص، طلبات العمل، إعلانات التطويع، والخدمات المهنية المرتبطة بمجتمع موطني.' },
  { key:'prelanding:marketplace', route:'/marketplace', aliases:['/market'], titleAr:'السوق', bodyAr:'هنا يمكنك تصفح الإعلانات المعتمدة أو متابعة إعلاناتك. انتبه دائماً للتفاصيل وتواصل فقط عبر القنوات الموثوقة.' },
  { key:'prelanding:community', route:'/community', aliases:['/groups'], titleAr:'المجتمع والمجموعات', bodyAr:'هذه المساحة للتواصل المجتمعي والمجموعات ضمن قواعد الاحترام والوضوح.' },
  { key:'prelanding:voting', route:'/voting', aliases:['/survey'], titleAr:'الاستطلاع والتصويت', bodyAr:'هنا يمكنك المشاركة في استطلاعات موطني ورؤية النتائج عندما تكون متاحة.' },
  { key:'prelanding:school-grants', route:'/school-grants', titleAr:'المساعدات المدرسية', bodyAr:'هذه الصفحة تشرح المستندات والشروط والنماذج المرتبطة بالمساعدات المدرسية والجامعية.' },
  { key:'prelanding:services-official', route:'/services/official', titleAr:'الروابط والخدمات الرسمية', bodyAr:'هنا تجد روابط وإرشادات لخدمات رسمية أو شبه رسمية. تأكد دائماً من المصدر قبل إرسال أي طلب.' },
  { key:'prelanding:taxi', route:'/taxi', titleAr:'التاكسي الموثوق', bodyAr:'هذه الخدمة تساعدك على الوصول إلى خيارات تنقل موثوقة داخل تجربة موطني.' },
  { key:'prelanding:al-wafiyat', route:'/al-wafiyat', aliases:['/deaths','/death-notices'], titleAr:'الوفيات الرسمية', bodyAr:'هذه الصفحة تعرض إعلانات الوفيات الرسمية أو المعتمدة بعد مراجعة الإدارة.' },
  { key:'prelanding:notifications', route:'/notifications', titleAr:'الإشعارات', bodyAr:'هنا ستجد التحديثات والتنبيهات المرتبطة بحسابك أو بخدمات موطني.' },
  { key:'prelanding:profile', route:'/profile', titleAr:'ملفي الشخصي', bodyAr:'إكمال الملف الشخصي يساعد موطني على تخصيص الإجابات والخدمات.', profileHintAr:'أضف فقط المعلومات التي تريد استخدامها لتحسين تجربتك داخل التطبيق.' },
  { key:'prelanding:settings', route:'/settings', titleAr:'الإعدادات', bodyAr:'من هنا يمكنك تعديل تفضيلاتك وطريقة عرض موطني بما يناسبك.' },
  { key:'prelanding:chat', route:'/chat', aliases:['/hybrid-kb-chat','/assistant','/mobile-os/chat'], titleAr:'محادثة موطني', bodyAr:'اكتب سؤالك بوضوح، موطني سيحاول مساعدتك بالإرشاد المناسب وربطك بالمعلومات المتاحة.' },
  { key:'prelanding:world-cup', route:'/mcp/world-cup', aliases:['/world-cup','/worldcup','/mcp/worldcup'], titleAr:'كأس العالم', bodyAr:'هذه صفحة ترفيهية لمتابعة كأس العالم، مثل المباريات والنتائج والأخبار والتصويتات.' }
];
export function resolveWatanyPreLandingGuide(route: string): WatanyPreLandingGuide | null {
  const path = base(normalizeWatanyPreLandingRoute(route));
  for (const guide of WATANY_PRELANDING_GUIDES) {
    const routes = [guide.route, ...(guide.aliases || [])].map(normalizeWatanyPreLandingRoute).map(base);
    if (routes.some((candidate) => path === candidate || path.startsWith(`${candidate}/`))) return guide;
  }
  return null;
}