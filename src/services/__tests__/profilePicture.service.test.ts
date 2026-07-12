import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for the Supabase client (mirrors the pattern used across the suite).
const hoist = vi.hoisted(() => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const getSession = vi.fn();
  const supabase = {
    auth: { getSession },
    storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
  };
  return { supabase, upload, getPublicUrl, getSession };
});

vi.mock('../../lib/supabase', () => ({ supabase: hoist.supabase }));

// React Native reads a local file into a Blob via fetch; stub it for Node.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
);

import { uploadProfilePicture } from '../profilePicture.service';

describe('profilePicture.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads into the user folder and returns a public URL', async () => {
    hoist.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });
    hoist.upload.mockResolvedValue({ error: null });
    hoist.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn/avatars/user-123/avatar.jpg' },
    });

    const url = await uploadProfilePicture('file:///tmp/photo.jpg', 'image/jpeg');

    expect(hoist.upload).toHaveBeenCalledWith(
      'user-123/avatar.jpeg',
      expect.any(Blob),
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' })
    );
    expect(url).toContain('https://cdn/avatars/user-123/avatar.jpg');
    // cache-busted so the <Image> refreshes after an overwrite
    expect(url).toContain('?t=');
  });

  it('throws a friendly error when there is no session', async () => {
    hoist.getSession.mockResolvedValue({ data: { session: null } });
    await expect(uploadProfilePicture('file:///x.jpg')).rejects.toThrow(
      /signed in/i
    );
  });

  it('rethrows storage errors with their original message', async () => {
    hoist.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    hoist.upload.mockResolvedValue({
      error: { message: 'Storage quota exceeded', code: '42501' },
    });
    await expect(uploadProfilePicture('file:///x.jpg')).rejects.toThrow(
      'Storage quota exceeded'
    );
  });

  it('throws when the local image cannot be read', async () => {
    hoist.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      blob: async () => new Blob(['x']),
    });
    await expect(uploadProfilePicture('file:///x.jpg')).rejects.toThrow(
      /read the selected image/i
    );
  });
});
