import { z } from 'zod';

import { decodePublicId } from './publicId.js';

export const tvShowIdSchema = z
  .string()
  .transform((value, context) => {
    const id = decodePublicId('tvshow', value);
    if (id === null) {
      context.addIssue({ code: 'custom', message: 'Invalid TV show ID.' });
      return z.NEVER;
    }
    return id;
  });
