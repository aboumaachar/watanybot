import { createKbStudioDefaultAdapter } from '../adapter/kb-studio-default.adapter';
export const kbStudioHostRegistration = { pluginKey: 'kb-studio', adapter: createKbStudioDefaultAdapter(), slots: ['admin.settings','kb.search','kb.review','kb.import'], routes: ['/kb','/admin/kb-studio'], apiPrefixes: ['/api/kb'] } as const;
