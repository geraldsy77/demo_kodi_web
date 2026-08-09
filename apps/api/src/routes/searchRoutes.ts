import { Router } from 'express';

import { createSearchController } from '../controllers/searchController.js';
import type { SearchService } from '../services/searchService.js';

export function createSearchRouter(service: SearchService): Router {
  const router = Router();

  router.get('/', createSearchController(service));

  return router;
}
