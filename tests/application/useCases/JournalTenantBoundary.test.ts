import { CreateJournalEntryUseCase, GetJournalEntryByIdUseCase } from '../../../src/application/useCases/ManageJournals';
import { JournalEntry } from '../../../src/domain/entities/JournalEntry';
import { JournalEntryId } from '../../../src/domain/valueObjects/JournalEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { AccountingMethod, DebitCredit } from '../../../src/domain/enums/AccountingEnums';
import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';

describe('journal tenant boundaries and durable publication', () => {
  const entry = () => new JournalEntry(new JournalEntryId('J-1'), new TenantId('store-a'), new Date('2026-01-01'), 'Receipt', AccountingMethod.Accrual);
  const input = () => ({ id: 'J-1', tenantId: 'store-a', date: '2026-01-01', description: 'Receipt', method: AccountingMethod.Accrual,
    lines: [{ accountCode: '1000', amountCents: 1234, type: DebitCredit.Debit }, { accountCode: '4000', amountCents: 1234, type: DebitCredit.Credit }] });
  function repository() { return { save: jest.fn(), saveBatch: jest.fn(), findById: jest.fn(), findAllByTenant: jest.fn() }; }

  it('returns an owned journal and passes the exact identifier to storage', async () => {
    const repo = repository(); const owned = entry(); repo.findById.mockResolvedValue(owned);
    expect(await new GetJournalEntryByIdUseCase(repo).execute('store-a', 'J-1')).toBe(owned);
    expect(repo.findById.mock.calls[0][0].value).toBe('J-1');
  });
  it.each([null, entry()])('does not disclose missing or foreign journals: %s', async value => {
    const repo = repository(); repo.findById.mockResolvedValue(value);
    expect(await new GetJournalEntryByIdUseCase(repo).execute('store-b', 'J-1')).toBeNull();
  });
  it('does not publish an event if journal persistence fails', async () => {
    const repo = repository(); repo.save.mockRejectedValue(new Error('Storage unavailable'));
    const bus = { publish: jest.fn() };
    await expect(new CreateJournalEntryUseCase(repo, new DomainEventDispatcher(bus as any)).execute(input())).rejects.toThrow('Storage unavailable');
    expect(bus.publish).not.toHaveBeenCalled();
  });
  it.each([undefined, 'purchase-42'])('publishes exact cents and tenant identity after saving (reference %s)', async referenceId => {
    const repo = repository(); const publish = jest.fn(() => { expect(repo.save).toHaveBeenCalledTimes(1); });
    await new CreateJournalEntryUseCase(repo, new DomainEventDispatcher({ publish } as any)).execute({ ...input(), referenceId });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'store-a', referenceId: referenceId ?? null,
      lines: expect.arrayContaining([expect.objectContaining({ amountCents: 1234, memo: '' })]) }));
  });
});
