# Knowledge Base Authoring Guide

Guide for creating effective bilingual KB cards for WatanBot.

## Overview

Knowledge Base cards are the core content that powers WatanBot's responses. Each card must be bilingual (Arabic + English) and follow best practices for clarity and searchability.

## KB Card Structure

### Required Fields

1. **Slug** (Unique ID)
   - URL-friendly identifier
   - Lowercase, hyphen-separated
   - Example: `water-bill-payment-methods`

2. **Title** (Both languages)
   - Clear, descriptive heading
   - 5-10 words
   - Example (EN): "Water Bill Payment Methods"
   - Example (AR): "طرق دفع فاتورة المياه"

3. **Summary** (Both languages)
   - Brief answer (2-3 sentences)
   - Used in chat responses
   - Should be complete on its own
   - Example (EN): "You can pay your water bill online through the municipality portal, at any bank branch, or at our customer service centers. Payment is accepted via credit card, debit card, or cash."

4. **Body** (Both languages)
   - Detailed information
   - Step-by-step instructions if applicable
   - Include relevant links, phone numbers
   - Markdown formatting supported

5. **Tags** (Both languages)
   - Keywords for searchability
   - 3-8 tags per language
   - Include synonyms and common misspellings
   - Example (EN): ["water", "bill", "payment", "invoice", "utilities"]
   - Example (AR): ["ماء", "فاتورة", "دفع", "خدمات", "كهرباء"]

### Optional Fields

6. **Sources**
   - Citations or references
   - JSON format: `{"url": "https://...", "title": "..."}`
   - Use for official regulations, forms

## Writing Best Practices

### 1. Clarity and Simplicity

**Good ✓**
```
Q: How do I pay my water bill?
A: You can pay online at portal.municipality.gov, at any bank, or at our offices.
```

**Bad ✗**
```
Q: What are the methodologies for remittance of aquatic utility invoices?
A: Multiple modalities exist for the settlement of outstanding balances...
```

### 2. Bilingual Consistency

- Ensure both languages convey the same information
- Use culturally appropriate examples
- Translate names/terms correctly
- Don't just use Google Translate - review and edit

**English:**
```
Office hours: Monday to Thursday, 8 AM to 3 PM
```

**Arabic (Consistent):**
```
ساعات العمل: الاثنين إلى الخميس، 8 صباحاً إلى 3 مساءً
```

### 3. Actionable Information

Include:
- ✅ Specific steps
- ✅ Links to forms/portals
- ✅ Phone numbers/addresses
- ✅ Required documents
- ✅ Deadlines/timeframes

**Good Example:**
```markdown
## How to Apply for a Building Permit

1. Visit https://portal.municipality.gov/permits
2. Click "New Building Permit"
3. Upload required documents:
   - Plot plan (approved by surveyor)
   - Architectural drawings
   - Owner's ID copy
4. Pay fee: 500 SAR
5. Processing time: 15 business days

For assistance: Call 800-123-4567
```

### 4. Search Optimization

**Use natural language:**
- How people actually ask questions
- Include common variations
- Add FAQ-style phrasing

**Example Tags:**
```json
{
  "en": [
    "building permit",
    "construction permit",
    "building license",
    "how to get permit",
    "permit application",
    "construction approval"
  ],
  "ar": [
    "تصريح بناء",
    "رخصة بناء",
    "طلب تصريح",
    "كيفية الحصول على تصريح",
    "موافقة البناء"
  ]
}
```

## Card Organization

### Topic Categories

Organize cards by service area:

1. **Utilities**
   - Water, electricity, sewage
   - Bills, connections, repairs

2. **Permits & Licenses**
   - Building permits
   - Business licenses
   - Event permits

3. **Civil Services**
   - Birth/marriage certificates
   - ID renewals
   - Residence permits

4. **Infrastructure**
   - Roads, street lights
   - Maintenance requests
   - Parks and recreation

5. **Complaints & Feedback**
   - How to file complaints
   - Response times
   - Follow-up procedures

### Slug Naming Convention

Pattern: `category-topic-action`

Examples:
- `utilities-water-bill-payment`
- `permits-building-application-process`
- `civil-birth-certificate-request`
- `complaints-road-damage-report`

## Lifecycle Management

### Draft → Published → Archived

1. **Draft**
   - Initial creation
   - Under review
   - Testing responses

2. **Published**
   - Live and searchable
   - Used in chat responses
   - Version incremented on publish

3. **Archived**
   - Outdated information
   - No longer searchable
   - Kept for audit/history

### Versioning

- Each publish increments version
- Track changes in audit logs
- Keep archives for reference

### Review Cycle

**Quarterly Review:**
1. Check for outdated information
2. Update links and phone numbers
3. Improve based on feedback queue
4. Republish if changes made

## Examples

### Example 1: Payment Services

**Slug:** `utilities-electricity-bill-payment`

**Title (EN):** How to Pay Your Electricity Bill

**Title (AR):** كيفية دفع فاتورة الكهرباء

**Summary (EN):**
```
Pay your electricity bill online at portal.municipality.gov, through the mobile app, at any bank branch, or at our customer service centers. Payments are processed immediately.
```

**Summary (AR):**
```
يمكنك دفع فاتورة الكهرباء عبر الإنترنت على portal.municipality.gov، أو من خلال تطبيق الهاتف المحمول، أو في أي فرع بنك، أو في مراكز خدمة العملاء لدينا. يتم معالجة المدفوعات فوراً.
```

**Body (EN):**
```markdown
## Online Payment

1. Visit https://portal.municipality.gov
2. Click "Pay Bills"
3. Enter your account number (found on bill)
4. Select electricity bill
5. Pay with credit/debit card

## Mobile App

Download "Municipality Services" app:
- iOS: [App Store Link]
- Android: [Play Store Link]

## In-Person Payment

Visit any of our locations:
- Main Office: 123 Main St (8 AM - 3 PM)
- North Branch: 456 North Ave (8 AM - 2 PM)

Accepted: Cash, card

## Bank Payment

All major banks accept municipality bill payments. Provide your account number.

## Questions?

Call: 800-123-4567
Email: billing@municipality.gov
```

**Body (AR):**
```markdown
## الدفع عبر الإنترنت

1. زيارة https://portal.municipality.gov
2. انقر على "دفع الفواتير"
3. أدخل رقم حسابك (الموجود على الفاتورة)
4. حدد فاتورة الكهرباء
5. الدفع ببطاقة الائتمان / الخصم

## تطبيق الهاتف المحمول

تحميل تطبيق "خدمات البلدية":
- iOS: [رابط App Store]
- Android: [رابط Play Store]

## الدفع الشخصي

زيارة أي من مواقعنا:
- المكتب الرئيسي: شارع الرئيسي 123 (8 صباحاً - 3 مساءً)
- الفرع الشمالي: شارع الشمالي 456 (8 صباحاً - 2 مساءً)

مقبول: نقداً، بطاقة

## الدفع عبر البنك

جميع البنوك الرئيسية تقبل مدفوعات فواتير البلدية. قدم رقم حسابك.

## أسئلة؟

الاتصال: 800-123-4567
البريد الإلكتروني: billing@municipality.gov
```

**Tags (EN):**
```json
["electricity", "bill", "payment", "utilities", "pay online", "mobile app"]
```

**Tags (AR):**
```json
["كهرباء", "فاتورة", "دفع", "خدمات", "دفع عبر الإنترنت", "تطبيق"]
```

**Sources:**
```json
{
  "url": "https://portal.municipality.gov/billing-info",
  "title": "Official Billing Information"
}
```

## Quality Checklist

Before publishing:

- [ ] Slug is unique and follows naming convention
- [ ] Both languages have all required fields
- [ ] Summary is concise (2-3 sentences)
- [ ] Body provides complete, actionable information
- [ ] All links are valid and accessible
- [ ] Phone numbers and addresses are current
- [ ] Tags include common search terms
- [ ] No spelling or grammar errors
- [ ] Formatting is clean (no HTML tags in plain text)
- [ ] Arabic text uses correct RTL formatting
- [ ] Tested search with common queries

## Self-Learning Integration

### Using Feedback Queue

The feedback queue shows unanswered questions. Use it to:

1. **Identify gaps** in KB coverage
2. **Create new cards** for common questions
3. **Improve existing cards** with better keywords
4. **Discover alternative phrasings** users employ

### Review Process

1. Navigate to **Feedback Queue** in admin console
2. Review open items regularly
3. For each item:
   - **Link to existing card** if answer exists (improves matching)
   - **Create new card** if gap identified
   - **Reject** if not actionable (spam, off-topic)

### Continuous Improvement

- Monitor which cards have high/low match rates
- Update tags based on actual user queries
- Add synonyms and alternative phrasings
- Keep content fresh and accurate

## Common Mistakes to Avoid

❌ **Too Technical**
```
Utilize the municipal online portal infrastructure to initiate a transaction...
```

✅ **Simple and Clear**
```
Visit our website at portal.municipality.gov to pay your bill.
```

---

❌ **Inconsistent Translation**
```
EN: "Call our hotline"
AR: "اتصل بالرقم" (just "call the number")
```

✅ **Accurate Translation**
```
EN: "Call our hotline"
AR: "اتصل بخطنا الساخن"
```

---

❌ **Vague Instructions**
```
Submit the required documents to the relevant department.
```

✅ **Specific Instructions**
```
Submit these documents to Building Permits Department, 2nd floor:
- Plot plan
- Architectural drawings
- ID copy
```

---

❌ **Missing Contact Information**
```
Contact us for more information.
```

✅ **Complete Contact Information**
```
Contact us:
- Phone: 800-123-4567 (8 AM - 3 PM)
- Email: info@municipality.gov
- Address: 123 Main St, City Center
```

## Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [Writing for Translation Best Practices](https://www.w3.org/International/articles/text-reuse/)
- Arabic Style Guide: [Internal Link]

## Support

Questions about KB authoring?
- Email: kb-support@municipality.gov
- Training sessions: First Monday of each month
- KB Guidelines: [Internal Wiki]
