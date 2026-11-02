import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createReport } from './createReport';
import { IDS } from '@/test/fixtures/db';
import { clearTables, tables } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { server } from '@/test/server';

/**
 * Reports carry exactly one target column (recipe_id XOR review_id, enforced
 * by the reports_one_target check in the database).
 */
describe('createReport', () => {
  beforeEach(() => {
    seedSession();
    clearTables();
  });

  it('writes recipe targets into recipe_id and trims the reason', async () => {
    await createReport({
      reporterId: IDS.otherUser,
      targetType: 'recipe',
      targetId: IDS.recipeA,
      reason: '  Stolen content  ',
    });
    expect(tables.reports).toHaveLength(1);
    expect(tables.reports[0]).toMatchObject({
      reporter_id: IDS.otherUser,
      recipe_id: IDS.recipeA,
      review_id: null,
      reason: 'Stolen content',
      status: 'open',
    });
  });

  it('writes review targets into review_id', async () => {
    await createReport({
      reporterId: IDS.otherUser,
      targetType: 'review',
      targetId: IDS.reviewGreat,
      reason: 'Spam',
    });
    expect(tables.reports[0]).toMatchObject({
      reporter_id: IDS.otherUser,
      recipe_id: null,
      review_id: IDS.reviewGreat,
    });
  });

  it('surfaces backend rejections (e.g. the one-target CHECK)', async () => {
    server.use(
      http.post('*/rest/v1/reports', () =>
        HttpResponse.json(
          { code: '23514', message: 'new row violates check constraint "reports_one_target"' },
          { status: 400 },
        ),
      ),
    );

    await expect(
      createReport({ reporterId: IDS.otherUser, targetType: 'recipe', targetId: IDS.recipeA, reason: 'x' }),
    ).rejects.toThrow(/reports_one_target/);
  });
});
