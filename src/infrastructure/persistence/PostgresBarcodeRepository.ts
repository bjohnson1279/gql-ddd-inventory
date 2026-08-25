import { PrismaClient, Prisma } from '@prisma/client';
import { IBarcodeRepository } from '../../domain/repositories/IBarcodeRepository';
import { VariantBarcodeSet } from '../../domain/entities/VariantBarcodeSet';
import { BarcodeAssignment } from '../../domain/entities/BarcodeAssignment';
import { BarcodeAssignmentId } from '../../domain/valueObjects/BarcodeAssignmentId';
import { Barcode } from '../../domain/valueObjects/Barcode';
import { BarcodeSymbology, BarcodeSource } from '../../domain/enums/BarcodeEnums';
import { Sku } from '../../domain/valueObjects/Sku';
import { toUuid } from '../utils/uuid';


export class PostgresBarcodeRepository implements IBarcodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSkuByBarcodeValue(value: string): Promise<Sku | null> {
    const barcode = await this.prisma.barcode.findFirst({
      where: { value: value },
      include: {
        variant: true,
      },
    });

    if (!barcode || !barcode.variant) {
      return null;
    }

    return new Sku(barcode.variant.sku);
  }

  async findSetBySku(sku: Sku): Promise<VariantBarcodeSet | null> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { sku: sku.value },
      include: {
        barcodes: true,
      },
    });

    if (!variant) {
      return null;
    }

    const set = new VariantBarcodeSet(sku);
    for (const b of variant.barcodes) {
      set.loadAssignment(
        new BarcodeAssignment(
          new BarcodeAssignmentId(b.id),
          sku,
          new Barcode(b.symbology as BarcodeSymbology, b.value),
          b.source as BarcodeSource,
          b.isPrimary ?? false,
          b.assignedAt
        )
      );
    }

    return set;
  }

  async save(set: VariantBarcodeSet): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { sku: set.sku.value },
    });

    if (!variant) {
      throw new Error(`ProductVariant not found for SKU: ${set.sku.value}`);
    }

    const dbVariantId = variant.id;

    await this.prisma.$transaction(async (tx) => {
      const idsToKeep = set.all.map((a) => toUuid(a.id.value));

      // 1. Delete removed barcodes
      await tx.barcode.deleteMany({
        where: {
          variantId: dbVariantId,
          id: { notIn: idsToKeep },
        },
      });

      // 2. Upsert remaining barcodes using batched raw query to fix N+1
      const values = set.all.map((a) => {
        const dbId = toUuid(a.id.value);
        return Prisma.sql`(${dbId}::uuid, ${dbVariantId}::uuid, ${a.barcode.value}, ${a.barcode.symbology}, ${a.source}, ${a.isPrimary}, ${a.assignedAt}::timestamptz)`;
      });

      if (values.length > 0) {
        await tx.$executeRaw`
          INSERT INTO "barcodes" ("id", "variant_id", "value", "symbology", "source", "is_primary", "assigned_at")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("id") DO UPDATE SET
            "value" = EXCLUDED."value",
            "symbology" = EXCLUDED."symbology",
            "source" = EXCLUDED."source",
            "is_primary" = EXCLUDED."is_primary",
            "assigned_at" = EXCLUDED."assigned_at";
        `;
      }
    });
  }

  async findAllAssignments(): Promise<BarcodeAssignment[]> {
    const barcodes = await this.prisma.barcode.findMany({
      include: { variant: true },
      orderBy: { assignedAt: 'desc' },
    });

    return barcodes.map((b) =>
      new BarcodeAssignment(
        new BarcodeAssignmentId(b.id),
        new Sku(b.variant.sku),
        new Barcode(b.symbology as BarcodeSymbology, b.value),
        b.source as BarcodeSource,
        b.isPrimary ?? false,
        b.assignedAt
      )
    );
  }
}
