import { Router } from 'express';

import { createLibrarySummaryController } from '../controllers/librarySummaryController.js';
import type { LibrarySummaryService } from '../services/librarySummaryService.js';

export function createLibraryRouter(service: LibrarySummaryService): Router {
  const router = Router();

  router.get('/summary', createLibrarySummaryController(service));

  return router;
}
