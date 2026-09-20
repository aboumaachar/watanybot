import * as migration_20260903_074633_ud2_procedures_foundation from './20260903_074633_ud2_procedures_foundation';
import * as migration_20260905_054002_ud3_documents_canonical_ids from './20260905_054002_ud3_documents_canonical_ids';

export const migrations = [
  {
    up: migration_20260903_074633_ud2_procedures_foundation.up,
    down: migration_20260903_074633_ud2_procedures_foundation.down,
    name: '20260903_074633_ud2_procedures_foundation',
  },
  {
    up: migration_20260905_054002_ud3_documents_canonical_ids.up,
    down: migration_20260905_054002_ud3_documents_canonical_ids.down,
    name: '20260905_054002_ud3_documents_canonical_ids'
  },
];
