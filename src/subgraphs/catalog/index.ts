import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { resolvers } from '../../infrastructure/graphql/resolvers';
import { globalPrisma, getTenantPrisma } from '../../infrastructure/persistence/prismaClient';
import { createDataLoaders } from '../../infrastructure/graphql/dataloaders';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dummy_jwt_secret';

const typeDefs = parse(`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key", "@external", "@requires", "@provides"])

  enum TrackingMode {
    quantity
    serial
    lot
  }

  enum BarcodeSymbology {
    upc_a
    upc_e
    ean_13
    ean_8
    code_128
    qr
    itf_14
    gs1_128
  }

  enum BarcodeSource {
    supplier
    internal
    gs1
  }

  enum ScanContext {
    pos
    receiving
    cycle_count
    transfer_out
    transfer_in
  }

  type VariantAttribute {
    name: String!
    value: String!
  }

  type Barcode {
    id: ID!
    variantId: ID!
    barcodeValue: String!
    symbology: BarcodeSymbology!
    source: BarcodeSource!
    isPrimary: Boolean!
    assignedAt: String!
  }

  type KitComponent {
    id: ID!
    variantId: ID!
    quantity: Int!
  }

  type Kit {
    id: ID!
    sku: String!
    name: String!
    components: [KitComponent!]!
  }

  type ProductUomConfiguration {
    sku: String!
    baseUnitName: String!
    purchaseUnitName: String
    saleUnitName: String
    conversionRules: [UomConversionRuleDTO!]!
  }

  type UomConversionRuleDTO {
    unitName: String!
    factorToBase: Float!
    label: String
  }

  type ProductVariant @key(fields: "id") {
    id: ID!
    productId: ID!
    sku: String!
    attributes: [VariantAttribute!]!
    weightGrams: Int
    volumeCubicMeters: Float
  }

  type Product @key(fields: "id") {
    id: ID!
    name: String!
    variants: [ProductVariant!]!
  }

  input AttributeInput {
    name: String!
    value: String!
  }

  input KitComponentInput {
    variantId: ID!
    quantity: Int!
  }

  input ConfigureUomInput {
    sku: String!
    baseUnitName: String!
    purchaseUnitName: String
    saleUnitName: String
  }

  input UnitInput {
    unitName: String!
  }

  input AddUomConversionRuleInput {
    sku: String!
    unit: UnitInput!
    factorToBase: Float!
    label: String
  }

  input RemoveUomConversionRuleInput {
    sku: String!
    unitName: String!
  }

  input SetUomUnitsInput {
    sku: String!
    purchaseUnit: UnitInput
    saleUnit: UnitInput
  }

  input AssignBarcodeInput {
    variantId: ID!
    barcodeValue: String!
    symbology: BarcodeSymbology!
    source: BarcodeSource!
    isPrimary: Boolean
  }

  input RevokeBarcodeInput {
    barcodeValue: String!
  }

  input ScanPayloadInput {
    quantity: Int
    locationId: String
    referenceId: String
    actorId: String
  }

  type Query {
    product(id: ID!): Product
    products: [Product!]!
    variants: [ProductVariant!]!
    kits: [Kit!]!
    uomConfigurations: [ProductUomConfiguration!]!
    lookupBarcode(value: String!): Barcode
  }

  type Mutation {
    createProduct(id: ID!, name: String!): Boolean!
    addProductVariant(productId: ID!, sku: String!, attributes: [AttributeInput!]!, trackingMode: TrackingMode!): Boolean!
    createKit(id: ID!, sku: String!, name: String!, components: [KitComponentInput!]!): Boolean!
    addKitComponent(kitId: ID!, variantId: ID!, quantity: Int!): Boolean!
    configureProductUom(input: ConfigureUomInput!): Boolean!
    addUomConversionRule(input: AddUomConversionRuleInput!): Boolean!
    removeUomConversionRule(input: RemoveUomConversionRuleInput!): Boolean!
    setUomUnits(input: SetUomUnitsInput!): Boolean!
    assignBarcode(input: AssignBarcodeInput!): Boolean!
    revokeBarcode(input: RevokeBarcodeInput!): Boolean!
    generateInternalBarcode(sku: String!, tenantId: ID!): String!
    dispatchBarcodeScan(rawScan: String!, context: ScanContext!, payload: ScanPayloadInput!): Boolean!
  }
`);

const catalogResolvers = {
  ...resolvers,
  Product: {
    ...resolvers.Product,
    __resolveReference(reference: any, context: any) {
      return context.prisma.productModel.findUnique({
        where: { id: reference.id }
      });
    }
  },
  ProductVariant: {
    ...resolvers.ProductVariant,
    __resolveReference(reference: any, context: any) {
      return context.prisma.productVariantModel.findUnique({
        where: { id: reference.id }
      });
    }
  }
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers: catalogResolvers as any }),
});

async function start() {
  const PORT = parseInt(process.env.PORT || '4002', 10);
  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
      let auth: any = undefined;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          auth = jwt.verify(token, JWT_SECRET) as any;
        } catch (err) {}
      }
      const tenantId = auth?.tenantId;
      const activePrisma = tenantId ? getTenantPrisma(globalPrisma, tenantId) : globalPrisma;
      return {
        auth,
        prisma: activePrisma,
        loaders: createDataLoaders(activePrisma),
      };
    },
  });
  console.log(`🚀 Catalog Subgraph ready at ${url}`);
}

start().catch(console.error);
