import { z } from 'zod';

import { paginationQuerySchema } from './pagination.js';

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchResultItem {
  id: string;
  title: string;
  entityType: 'movie' | 'tvshow';
}

export interface SearchResponse {
  items: SearchResultItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
