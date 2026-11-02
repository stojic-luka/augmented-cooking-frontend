import { describe, expect, it } from 'vitest';
import { uploadRecipeImage } from '@features/recipes/services/recipeImage';
import { uploadAvatar } from './uploadAvatar';
import { uploadReviewImage } from '@features/reviews/services/writeReview';
import { TEST_ORIGIN } from '@/test/origin';
import { IDS } from '@/test/fixtures/db';
import { seedSession } from '@/test/auth';

/**
 * Storage uploads across the three buckets. Avatars live in a public bucket,
 * so the public URL is the persisted value; recipe and review images live in
 * private buckets — the service returns the storage path only, and signed
 * URLs are minted at read time. The timestamp segment varies by design.
 */
function pngFile(name: string): File {
  return new File(['fake-image-bytes'], name, { type: 'image/png' });
}

describe('storage uploads', () => {
  it('uploadAvatar writes under the user prefix and returns the public URL', async () => {
    seedSession();
    const url = await uploadAvatar(IDS.user, pngFile('me.png'));
    expect(url).toMatch(new RegExp(`^${TEST_ORIGIN}/storage/v1/object/public/avatars/${IDS.user}/avatar-\\d+$`));
  });

  it('uploadRecipeImage keeps the file extension and returns the storage path', async () => {
    seedSession();
    const path = await uploadRecipeImage(IDS.user, pngFile('dish.png'));
    expect(path).toMatch(new RegExp(`^${IDS.user}/\\d+\\.png$`));
  });

  it('uploadReviewImage defaults the extension and returns the storage path', async () => {
    seedSession();
    const file = new File(['x'], 'noext', { type: 'image/jpeg' });
    const path = await uploadReviewImage(IDS.user, file);
    expect(path).toMatch(new RegExp(`^${IDS.user}/\\d+\\.bin$`));
  });
});
