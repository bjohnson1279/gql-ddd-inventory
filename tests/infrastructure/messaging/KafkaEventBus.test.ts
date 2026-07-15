import { KafkaEventBus } from "../../../src/infrastructure/messaging/KafkaEventBus";
import { Kafka } from "kafkajs";

jest.mock("kafkajs", () => {
  const mockProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const mockConsumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockImplementation(async ({ eachMessage }) => {
      (mockConsumer as any)._eachMessage = eachMessage;
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const mockKafka = jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
    consumer: jest.fn().mockReturnValue(mockConsumer),
  }));

  return {
    Kafka: mockKafka,
  };
});

describe("KafkaEventBus", () => {
  let eventBus: KafkaEventBus;
  let mockProducerInstance: any;
  let mockConsumerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new KafkaEventBus("localhost:9092,localhost:9093");
    
    const kafkaInstance = new Kafka({ clientId: 't', brokers: [] });
    mockProducerInstance = kafkaInstance.producer();
    mockConsumerInstance = kafkaInstance.consumer({ groupId: 'g' });
  });

  afterEach(async () => {
    await eventBus.disconnect();
  });

  it("should initialize Kafka client with configuration", () => {
    expect(Kafka).toHaveBeenCalledWith(
      expect.objectContaining({
        brokers: ["localhost:9092", "localhost:9093"],
        clientId: "gql-ddd-inventory",
      })
    );
  });

  it("should connect producer and publish domain events", async () => {
    const dummyEvent = {
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      tenantId: "t-1",
    } as any;

    // Simulate publication
    eventBus.publish(dummyEvent);

    // Wait a brief tick for async publish/sendEvent
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockProducerInstance.connect).toHaveBeenCalled();
    expect(mockProducerInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "inventory-events",
        messages: [
          expect.objectContaining({
            key: "t-1",
            value: expect.stringContaining("occurredAt"),
          }),
        ],
      })
    );
  });

  it("should subscribe, start consumer and dispatch incoming messages to local handlers", async () => {
    const handler = jest.fn();
    eventBus.subscribe("MockDomainEvent", handler);

    // Wait a brief tick for async startConsumer
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockConsumerInstance.connect).toHaveBeenCalled();
    expect(mockConsumerInstance.subscribe).toHaveBeenCalledWith({
      topic: "inventory-events",
      fromBeginning: false,
    });
    expect(mockConsumerInstance.run).toHaveBeenCalled();

    // Trigger mock message consumption
    const mockMessagePayload = {
      type: "MockDomainEvent",
      payload: {
        sku: "SKU-ABC",
        occurredAt: "2026-07-15T12:30:00.000Z",
      },
    };

    const eachMessageFn = mockConsumerInstance._eachMessage;
    expect(eachMessageFn).toBeDefined();

    await eachMessageFn({
      topic: "inventory-events",
      partition: 0,
      message: {
        value: Buffer.from(JSON.stringify(mockMessagePayload)),
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "SKU-ABC",
        occurredAt: new Date("2026-07-15T12:30:00.000Z"),
      })
    );
  });

  it("should handle error gracefully on consumer message parsing exception", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    eventBus.subscribe("MockDomainEvent", () => {});

    // Wait a brief tick for async startConsumer
    await new Promise((resolve) => setTimeout(resolve, 50));

    const eachMessageFn = mockConsumerInstance._eachMessage;
    await eachMessageFn({
      topic: "inventory-events",
      partition: 0,
      message: {
        value: Buffer.from("invalid-json"),
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("[KafkaEventBus] Error processing consumed message");
    consoleErrorSpy.mockRestore();
  });
});
