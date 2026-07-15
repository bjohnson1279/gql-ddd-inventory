import { PrismaClient } from '@prisma/client';
import { IStockOnboardingRepository } from '../../domain/repositories/IStockOnboardingRepository';
import { StockOnboarding } from '../../domain/entities/StockOnboarding';
import { StockOnboardingId } from '../../domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { StockOnboardingStatus } from '../../domain/enums/StockOnboardingStatus';
import { toUuid } from '../../shared/utils/uuid';


export class PostgresStockOnboardingRepository implements IStockOnboardingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: StockOnboardingId): Promise<StockOnboarding | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.stockOnboarding.findUnique({
      where: { id: dbId },
      include: {
        items: true,
      },
    });

    if (!model) return null;

    const onboarding = new StockOnboarding(
      new StockOnboardingId(model.id),
      new TenantId(model.tenantId),
      new LocationId(model.locationId),
      model.asOfDate
    );

    (onboarding as any)._status = model.status as StockOnboardingStatus;

    for (const item of model.items) {
      onboarding.setItem(
        new ProductVariantId(item.variantId),
        item.quantity,
        item.unitCostCents
      );
    }

    return onboarding;
  }

  async findAllByTenant(tenantId: TenantId): Promise<StockOnboarding[]> {
    const models = await this.prisma.stockOnboarding.findMany({
      where: { tenantId: tenantId.value },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const onboardings: StockOnboarding[] = [];
    for (const model of models) {
      const onboarding = new StockOnboarding(
        new StockOnboardingId(model.id),
        new TenantId(model.tenantId),
        new LocationId(model.locationId),
        model.asOfDate
      );
      (onboarding as any)._status = model.status as StockOnboardingStatus;

      for (const item of model.items) {
        onboarding.setItem(
          new ProductVariantId(item.variantId),
          item.quantity,
          item.unitCostCents
        );
      }
      onboardings.push(onboarding);
    }

    return onboardings;
  }

  async save(onboarding: StockOnboarding): Promise<void> {
    const dbId = toUuid(onboarding.id.value);

    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert aggregate root
      await tx.stockOnboarding.upsert({
        where: { id: dbId },
        create: {
          id: dbId,
          tenantId: onboarding.tenantId.value,
          locationId: onboarding.locationId.value,
          status: onboarding.status,
          asOfDate: onboarding.asOfDate,
        },
        update: {
          status: onboarding.status,
          asOfDate: onboarding.asOfDate,
        },
      });

      // 2. Delete existing items to replace them
      await tx.stockOnboardingItem.deleteMany({
        where: { onboardingId: dbId },
      });

      // 3. Create items
      if (onboarding.items.length > 0) {
        await tx.stockOnboardingItem.createMany({
          data: onboarding.items.map((item) => ({
            onboardingId: dbId,
            variantId: toUuid(item.variantId.value),
            quantity: item.quantity,
            unitCostCents: item.unitCostCents,
          })),
        });
      }
    });
  }
}
