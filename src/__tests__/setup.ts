import { vi } from 'vitest';

// Mock console.error and console.log to keep test output clean,
// but let them pass through if needed for debugging.
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock generic env vars
process.env.JWT_SECRET = 'test-secret';
process.env.DB_TYPE = 'sqlite';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.ENCRYPTION_SECRET = 'this-is-a-long-secret-key-32-chars-long-123';
