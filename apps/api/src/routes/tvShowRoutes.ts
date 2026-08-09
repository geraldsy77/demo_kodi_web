import { Router } from 'express';

import {
  createTvShowController,
  createTvShowDetailController,
} from '../controllers/tvShowController.js';
import type { TvShowService } from '../services/tvShowService.js';

export function createTvShowRouter(service: TvShowService): Router {
  const router = Router();

  router.get('/', createTvShowController(service));
  router.get('/:id', createTvShowDetailController(service));

  return router;
}
