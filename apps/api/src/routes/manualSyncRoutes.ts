import { Router } from 'express';

import {
  createGetManualSyncController,
  createStartManualSyncController,
} from '../controllers/manualSyncController.js';
import { requireSyncTriggerToken } from '../middleware/requireSyncTriggerToken.js';
import type {
  ManualSyncTriggerService,
} from '../services/manualSyncTriggerService.js';

export function createManualSyncRouter(
  service: ManualSyncTriggerService,
  triggerToken: string,
): Router {
  const router = Router();

  router.use(requireSyncTriggerToken(triggerToken));
  router.post('/runs', createStartManualSyncController(service));
  router.get('/runs/:runId', createGetManualSyncController(service));

  return router;
}