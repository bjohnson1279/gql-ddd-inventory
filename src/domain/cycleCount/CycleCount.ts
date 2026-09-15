export interface CycleCount {
  id: string;
  tenantId: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  abcClass?: string;
  zone?: string;
  isBlindCount: boolean;
  assignedTo?: string;
  createdAt: Date;
}
