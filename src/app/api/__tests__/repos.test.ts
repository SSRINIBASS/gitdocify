import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createRepo, GET as getRepos } from '../repos/route';
import { db } from '@/db';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
}));

// Mock Auth
vi.mock('@/lib/auth', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'test-user-id', email: 'test@example.com' })
}));

// Mock Queue
vi.mock('@/lib/queue', () => ({
  enqueueIngestJob: vi.fn().mockResolvedValue(true)
}));

describe('Repos API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/repos', () => {
    it('returns a list of repositories', async () => {
      const mockRepos = [{ id: 'repo-1', name: 'test-repo' }];
      vi.mocked(db.orderBy).mockResolvedValueOnce(mockRepos as any);

      const req = new Request('http://localhost/api/repos');
      const res = await getRepos(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.repositories).toEqual(mockRepos);
    });
  });

  describe('POST /api/repos', () => {
    it('returns 400 if repoUrl is missing', async () => {
      const req = new Request('http://localhost/api/repos', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const res = await createRepo(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 if user has no API key', async () => {
      // Mock user without api key
      vi.mocked(db.where).mockResolvedValueOnce([{ encryptedGeminiKey: null }] as any);

      const req = new Request('http://localhost/api/repos', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo' })
      });
      const res = await createRepo(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('configure your Gemini API key');
    });

    it('successfully enqueues a new repository ingest', async () => {
      // 1. Mock user with api key
      vi.mocked(db.where).mockResolvedValueOnce([{ encryptedGeminiKey: 'encrypted' }] as any);
      
      // 2. Mock checking for existing repo (returns empty)
      vi.mocked(db.where).mockResolvedValueOnce([] as any);

      // 3. Mock inserting repo
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 'repo-123' }] as any);

      // 4. Mock inserting job
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 'job-123', status: 'PENDING' }] as any);

      const req = new Request('http://localhost/api/repos', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo', teamId: 'team-456' })
      });
      
      const res = await createRepo(req);
      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data.repository.id).toBe('repo-123');
      expect(data.job.id).toBe('job-123');
    });
  });
});
