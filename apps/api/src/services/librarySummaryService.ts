import type { Pool } from 'mysql2/promise';

import { getLibrarySummary } from '../repositories/librarySummaryRepository.js';
import type { LibrarySummary } from '../types/librarySummary.js';

export interface LibrarySummaryService {
  getSummary(): Promise<LibrarySummary>;
}

export function createLibrarySummaryService(
  pool: Pool,
): LibrarySummaryService {
  return {
    getSummary: () => getLibrarySummary(pool),
  };
}
