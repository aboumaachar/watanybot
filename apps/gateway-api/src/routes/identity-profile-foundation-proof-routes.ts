import type { FastifyPluginAsync } from 'fastify';

const APEX_SOURCE = 'APEX_KOUDAMA_BROWSER_API_PROOF_GAP_CLOSEOUT_v12_4_1';

export const createIdentityProfileFoundationProofRouter: FastifyPluginAsync = async (app) => {
  app.get('/identity/profile/foundation', async () => ({
    ok: true,
    source: APEX_SOURCE,
    requirementIds: ['KR-0050'],
    module: 'identity-profile-foundation',
    profileFoundation: {
      purpose: 'Watany/Koudama veteran and family profile foundation metadata',
      supportedRelations: ['veteran', 'spouse', 'son', 'daughter', 'family_member'],
      supportedApparatus: ['LAF', 'ISF', 'GeneralSecurity', 'StateSecurity', 'Customs', 'ParliamentPolice'],
      addressFields: ['governorate', 'caza', 'municipality', 'village'],
      memoryPolicy: 'profile context only; community chat and hybrid assistant logic remain separate'
    }
  }));

  app.get('/identity/verification/statuses', async () => ({
    ok: true,
    source: APEX_SOURCE,
    requirementIds: ['KR-0051'],
    module: 'identity-verification-statuses',
    statuses: [
      { key: 'not_started', labelAr: '\u0644\u0645 \u064a\u0628\u062f\u0623', terminal: false },
      { key: 'pending_review', labelAr: '\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629', terminal: false },
      { key: 'verified', labelAr: '\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642', terminal: true },
      { key: 'needs_more_info', labelAr: '\u0628\u062d\u0627\u062c\u0629 \u0625\u0644\u0649 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629', terminal: false },
      { key: 'rejected', labelAr: '\u0645\u0631\u0641\u0648\u0636', terminal: true }
    ]
  }));
};
