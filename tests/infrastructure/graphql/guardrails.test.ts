import { parse, validate } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../../src/infrastructure/graphql/typeDefs';
import { resolvers } from '../../../src/infrastructure/graphql/resolvers';
import { depthLimitRule, complexityLimitRule } from '../../../src/infrastructure/graphql/guardrails';

describe('GraphQL Guardrails Validation Rules', () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  describe('Query Depth Limit Rule', () => {
    it('should allow queries under the depth limit', () => {
      const queryStr = `
        query {
          products {
            variants {
              sku
            }
          }
        }
      `;
      const document = parse(queryStr);
      const errors = validate(schema, document, [depthLimitRule(5)]);
      expect(errors).toHaveLength(0);
    });

    it('should reject queries exceeding the depth limit', () => {
      const queryStr = `
        query {
          products {
            variants {
              sku
              product {
                variants {
                  sku
                }
              }
            }
          }
        }
      `;
      const document = parse(queryStr);
      const errors = validate(schema, document, [depthLimitRule(4)]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Maximum query depth of 4 exceeded.');
    });
  });

  describe('Query Complexity Limit Rule', () => {
    it('should allow queries under the complexity limit', () => {
      const queryStr = `
        query {
          products {
            id
            name
          }
        }
      `;
      const document = parse(queryStr);
      const errors = validate(schema, document, [complexityLimitRule(100)]);
      expect(errors).toHaveLength(0);
    });

    it('should reject queries exceeding the complexity limit', () => {
      const queryStr = `
        query {
          products {
            id
            name
            variants {
              id
              sku
            }
          }
        }
      `;
      const document = parse(queryStr);
      // Complexity is:
      // products (5) + id (1) + name (1) + variants (5) + id (1) + sku (1) = 14
      const errors = validate(schema, document, [complexityLimitRule(10)]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Maximum query complexity of 10 exceeded (actual: 14).');
    });
  });
});
