INSERT INTO kb_topics(topic_code, title_ar, priority) VALUES
('PENSIONS','المعاشات والاحتساب',10),
('RIGHTS','الحقوق والمساعدات',20),
('HEALTH','الطبابة',30),
('EDU','المنح التعليمية',40),
('PROCEDURES','المعاملات والإجراءات',50),
('LAWS','القوانين والمواد',60)
ON CONFLICT DO NOTHING;

-- مثال معاملات
INSERT INTO kb_procedures(
  procedure_code, topic_code, title_ar, who_eligible_ar, estimated_time_ar,
  requirements_checklist_json, steps_json, common_mistakes_json, legal_refs_json
) VALUES
(
  'PROC_PENSION_STATEMENT',
  'PROCEDURES',
  'طلب إفادة معاش',
  'العسكري المتقاعد أو من ينوب عنه بتوكيل أصولي.',
  'عادةً بين يومين إلى أسبوع حسب الجهة.',
  '["هوية/إخراج قيد","صورة عن بطاقة التقاعد (إن وجدت)","طلب خطي"]',
  '["تحضير الأوراق","تقديم الطلب لدى الجهة المختصة","استلام الإفادة أو متابعة النقص إن وجد"]',
  '["نقص مستند أساسي","معلومات غير مطابقة للهوية","عدم وجود رقم هاتف للتواصل"]',
  '["قانون/نظام: راجع المواد الخاصة بالإفادة (يُحدّد لاحقاً)"]'
)
ON CONFLICT DO NOTHING;

-- مثال حق
INSERT INTO kb_rights(
  right_code, topic_code, title_ar, summary_simple_ar,
  conditions_json, documents_json, how_to_apply_json, legal_refs_json
) VALUES
(
  'RIGHT_SOCIAL_AID',
  'RIGHTS',
  'المساعدة الاجتماعية',
  'مساعدة تُمنح وفق شروط محددة وبحسب الحالة الاجتماعية والوضع المعيشي.',
  '["وجود طلب رسمي","توفر شروط الاستفادة بحسب الأنظمة"]',
  '["هوية","مستند يثبت الحالة (عائلية/اجتماعية)","أي مستندات داعمة"]',
  '["تجهيز الملف","تقديم الطلب","متابعة النقص إن وجد","استلام القرار"]',
  '["مواد/قرارات: تُملأ لاحقاً من القانون"]'
)
ON CONFLICT DO NOTHING;

-- مثال مادة قانون (نص قصير كمكان)
INSERT INTO kb_laws(law_code, article_no, title_ar, text_ar, tags_json) VALUES
('SALARY_LAW', '1', 'تعريف عام', 'نص المادة يوضع هنا كما هو من المصدر الرسمي.', '["pensions","salary"]')
ON CONFLICT DO NOTHING;