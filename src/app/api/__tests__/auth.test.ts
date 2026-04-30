import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as register } from '../auth/register/route';
import { POST as login } from '../auth/login/route';
import { db } from '@/db';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  }
}));

// Mock rate limit
vi.mock('@/lib/rateLimit', () => ({
  authRateLimiter: {
    isAllowed: vi.fn().mockReturnValue({ allowed: true })
  }
}));

// Mock security audit
vi.mock('@/lib/securityAudit', () => ({
  logAuthenticationEvent: vi.fn().mockResolvedValue(true),
  SecurityEvents: {
    REGISTRATION_ATTEMPT: 'REGISTRATION_ATTEMPT',
    REGISTRATION_SUCCESS: 'REGISTRATION_SUCCESS',
    LOGIN_ATTEMPT: 'LOGIN_ATTEMPT',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  }
}));

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 if email or password missing', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }) // missing password
      });
      const res = await register(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 if password is weak', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'weak' })
      });
      const res = await register(req);
      expect(res.status).toBe(400);
    });

    it('returns 409 if user already exists', async () => {
      // Mock DB to return an existing user
      vi.mocked(db.where).mockResolvedValueOnce([{ id: 'existing-id' }] as any);

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'StrongPassword123!' })
      });
      
      const res = await register(req);
      expect(res.status).toBe(409);
    });

    it('registers user successfully', async () => {
      // Mock DB where (no existing user)
      vi.mocked(db.where).mockResolvedValueOnce([] as any);
      // Mock DB returning
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 'new-id', email: 'test@example.com' }] as any);

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'StrongPassword123!' })
      });
      
      const res = await register(req);
      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data.user.email).toBe('test@example.com');
      expect(data.token).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 if email or password missing', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      });
      const res = await login(req);
      expect(res.status).toBe(400);
    });

    it('returns 401 if user not found', async () => {
      vi.mocked(db.where).mockResolvedValueOnce([] as any); // user not found

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'StrongPassword123!' })
      });
      const res = await login(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 on successful login', async () => {
      // Create a real hash to compare against
      const { hashPassword } = await import('@/lib/auth');
      const hash = await hashPassword('StrongPassword123!');
      
      vi.mocked(db.where).mockResolvedValueOnce([{ 
        id: 'user-id', 
        email: 'test@example.com',
        passwordHash: hash
      }] as any);

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'StrongPassword123!' })
      });
      
      const res = await login(req);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.user.email).toBe('test@example.com');
      expect(data.token).toBeDefined();
    });
  });
});
