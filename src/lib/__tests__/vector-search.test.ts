import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbModule from '@/db';
import { searchSimilar, storeEmbeddings } from '../vector-search';

// Mock the db module
vi.mock('@/db', () => ({
  rawQuery: vi.fn(),
  isPostgres: true,
}));

describe('Vector Search Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchSimilar (Postgres mode)', () => {
    it('executes postgres vector search query', async () => {
      // @ts-ignore
      dbModule.isPostgres = true;
      const mockResults = [{ id: '1', score: 0.9 }];
      // @ts-ignore
      vi.mocked(dbModule.rawQuery).mockResolvedValueOnce(mockResults);

      const results = await searchSimilar('repo-123', [0.1, 0.2, 0.3]);
      
      expect(results).toEqual(mockResults);
      expect(dbModule.rawQuery).toHaveBeenCalledTimes(1);
      
      const callArgs = vi.mocked(dbModule.rawQuery).mock.calls[0];
      expect(callArgs[0]).toContain('embedding <=> $1::vector'); // Query contains vector op
      expect(callArgs[1]).toEqual(['[0.1,0.2,0.3]', 'repo-123', 0.65, 10]); // Params
    });
  });

  describe('searchSimilar (SQLite fallback mode)', () => {
    it('returns empty array if no query is provided in SQLite mode', async () => {
      // @ts-ignore
      dbModule.isPostgres = false;
      const results = await searchSimilar('repo-123', [0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
      expect(dbModule.rawQuery).not.toHaveBeenCalled();
    });

    it('executes LIKE query if keywords are provided in SQLite mode', async () => {
      // @ts-ignore
      dbModule.isPostgres = false;
      const mockResults = [{ id: '2', score: 1.0 }];
      // @ts-ignore
      vi.mocked(dbModule.rawQuery).mockResolvedValueOnce(mockResults);

      const results = await searchSimilar('repo-123', [0.1, 0.2], 10, 0.65, 'react component');
      
      expect(results).toEqual(mockResults);
      expect(dbModule.rawQuery).toHaveBeenCalledTimes(1);
      
      const callArgs = vi.mocked(dbModule.rawQuery).mock.calls[0];
      expect(callArgs[0]).toContain('content LIKE ? OR content LIKE ?');
      expect(callArgs[1]).toEqual(['repo-123', '%react%', '%component%', 10]);
    });
  });

  describe('storeEmbeddings', () => {
    it('skips storing if in SQLite mode', async () => {
      // @ts-ignore
      dbModule.isPostgres = false;
      await storeEmbeddings(['id1'], [[0.1]]);
      expect(dbModule.rawQuery).not.toHaveBeenCalled();
    });

    it('executes UPDATE query in Postgres mode', async () => {
      // @ts-ignore
      dbModule.isPostgres = true;
      await storeEmbeddings(['id1', 'id2'], [[0.1, 0.2], [0.3, 0.4]]);
      
      expect(dbModule.rawQuery).toHaveBeenCalledTimes(1);
      const queryStr = vi.mocked(dbModule.rawQuery).mock.calls[0][0] as string;
      expect(queryStr).toContain("('id1'::uuid, '[0.1,0.2]'::vector)");
      expect(queryStr).toContain("('id2'::uuid, '[0.3,0.4]'::vector)");
    });
  });
});
