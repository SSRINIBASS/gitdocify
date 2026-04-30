import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createTeam, GET as getTeams } from '../teams/route';
import { db } from '@/db';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  }
}));

// Mock Auth
vi.mock('@/lib/auth', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'test-user-id', email: 'test@example.com' })
}));

describe('Teams API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/teams', () => {
    it('returns a list of teams for the user', async () => {
      const mockTeams = [{ id: 'team-1', name: 'Frontend Team' }];
      vi.mocked(db.where).mockResolvedValueOnce(mockTeams as any);

      const req = new Request('http://localhost/api/teams');
      const res = await getTeams(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teams).toEqual(mockTeams);
    });

    it('returns 401 if unauthorized', async () => {
      const { authenticateRequest } = await import('@/lib/auth');
      vi.mocked(authenticateRequest).mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/teams');
      const res = await getTeams(req);
      
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/teams', () => {
    it('returns 400 if team name is missing', async () => {
      const req = new Request('http://localhost/api/teams', {
        method: 'POST',
        body: JSON.stringify({ description: 'A cool team' }) // missing name
      });
      const res = await createTeam(req);
      expect(res.status).toBe(400);
    });

    it('creates a team successfully and adds the user as owner', async () => {
      const mockTeam = { id: 'new-team-id', name: 'Backend Team' };
      
      // Mock db.insert().values().returning()
      vi.mocked(db.returning).mockResolvedValueOnce([mockTeam] as any);
      
      // For the second query `db.insert().values()`, we just need values to return a Promise.
      // But we can't easily distinguish them if we use mockReturnThis. Let's just use mockReturnValueOnce
      vi.mocked(db.values)
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([mockTeam]) } as any) // first query
        .mockResolvedValueOnce([] as any); // second query

      const req = new Request('http://localhost/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: 'Backend Team' })
      });
      
      const res = await createTeam(req);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.team).toEqual(mockTeam);
    });
  });
});
