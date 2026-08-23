import type { Pool } from 'mysql2/promise';

import { searchLibrary } from '../repositories/searchRepository.js';
import type { SearchQuery, SearchResponse } from '../types/search.js';
import { encodePublicId } from '../types/publicId.js';

export interface SearchService {
  search(query: SearchQuery): Promise<SearchResponse>;
}

export function createSearchService(pool: Pool): SearchService {
  return {
    async search({ q, page, pageSize }) {
      const result = await searchLibrary(pool, {
        query: q,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: result.items.map((item) => ({
          ...item,
          id: encodePublicId(item.entityType, item.id),
        })),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / pageSize),
        },
      };
    },
  };
}
