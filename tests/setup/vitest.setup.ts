import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing-only');
vi.stubEnv('ADMIN_PASSWORD', 'test-admin-password');
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('SONGBOOK_READONLY', '0');
vi.stubEnv('LANGUAGES', 'en-US,es-ES,fr-FR');