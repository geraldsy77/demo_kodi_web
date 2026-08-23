import { z } from 'zod';

import { decodePublicId } from './publicId.js';

export const movieIdSchema = z
  .string()
  .transform((value, context) => {
    const id = decodePublicId('movie', value);
    if (id === null) {
      context.addIssue({ code: 'custom', message: 'Invalid movie ID.' });
      return z.NEVER;
    }
    return id;
  });
