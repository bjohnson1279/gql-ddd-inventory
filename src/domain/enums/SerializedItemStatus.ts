export enum SerializedItemStatus {
  Pending = 'pending',
  InStock = 'in_stock',
  Sold = 'sold',
  Returned = 'returned',
  Quarantined = 'quarantined',
  Transferred = 'transferred',
  Damaged = 'damaged',
  WrittenOff = 'written_off',
}

const AllowedTransitions: Record<SerializedItemStatus, SerializedItemStatus[]> = {
  [SerializedItemStatus.Pending]: [
    SerializedItemStatus.InStock,
    SerializedItemStatus.Quarantined,
    SerializedItemStatus.WrittenOff,
  ],
  [SerializedItemStatus.InStock]: [
    SerializedItemStatus.Sold,
    SerializedItemStatus.Transferred,
    SerializedItemStatus.Quarantined,
    SerializedItemStatus.Damaged,
    SerializedItemStatus.WrittenOff,
  ],
  [SerializedItemStatus.Sold]: [
    SerializedItemStatus.Returned,
  ],
  [SerializedItemStatus.Returned]: [
    SerializedItemStatus.InStock,
    SerializedItemStatus.Quarantined,
    SerializedItemStatus.Damaged,
    SerializedItemStatus.WrittenOff,
  ],
  [SerializedItemStatus.Quarantined]: [
    SerializedItemStatus.InStock,
    SerializedItemStatus.Damaged,
    SerializedItemStatus.WrittenOff,
  ],
  [SerializedItemStatus.Transferred]: [
    SerializedItemStatus.InStock,
    SerializedItemStatus.Quarantined,
    SerializedItemStatus.Damaged,
  ],
  [SerializedItemStatus.Damaged]: [
    SerializedItemStatus.Quarantined,
    SerializedItemStatus.WrittenOff,
  ],
  [SerializedItemStatus.WrittenOff]: [],
};

export function canTransitionTo(current: SerializedItemStatus, next: SerializedItemStatus): boolean {
  return AllowedTransitions[current].includes(next);
}
