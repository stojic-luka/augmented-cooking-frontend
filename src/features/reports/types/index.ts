export type ReportTargetType = 'recipe' | 'review';

export interface CreateReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}
