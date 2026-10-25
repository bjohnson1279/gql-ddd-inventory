export interface CycleCountPlan {
  id: string;
  tenantId: string;
  name: string;
  abcClassification: string;
  frequencyDays: number;
  zone?: string | null;
  isActive: boolean;
  createdAt?: Date;
}
