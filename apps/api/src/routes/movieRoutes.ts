import { Router } from 'express';

import {
  createMovieController,
  createMovieDetailController,
} from '../controllers/movieController.js';
import type { MovieService } from '../services/movieService.js';

export function createMovieRouter(service: MovieService): Router {
  const router = Router();

  router.get('/', createMovieController(service));
  router.get('/:id', createMovieDetailController(service));

  return router;
}
