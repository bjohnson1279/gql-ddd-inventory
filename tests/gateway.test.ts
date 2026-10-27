import { createFederatedGateway } from '../src/gateway';

describe('Federated Gateway Security Guardrails', () => {
  it('should create an ApolloServer instance with depth and complexity validation rules and formatError', () => {
    const server = createFederatedGateway([]);
    expect(server).toBeDefined();
    const internals = (server as any).internals;
    expect(internals.validationRules).toBeDefined();
    expect(internals.validationRules.length).toBe(2);
    expect(typeof internals.formatError).toBe('function');
  });
});
