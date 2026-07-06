import { Kafka, Producer, Consumer } from 'kafkajs';
import { IEventBus, EventHandler } from '../../domain/events/IEventBus';
import { DomainEvent } from '../../domain/events/DomainEvent';

export class KafkaEventBus implements IEventBus {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer | null = null;
  private isConnected = false;
  private localHandlers = new Map<string, EventHandler[]>();
  private brokerUrl: string;

  constructor(brokerUrl: string) {
    this.brokerUrl = brokerUrl;
    const brokers = this.brokerUrl ? this.brokerUrl.split(',') : ['localhost:9092'];
    this.kafka = new Kafka({
      clientId: 'gql-ddd-inventory',
      brokers: brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });
    this.producer = this.kafka.producer();
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log(`[KafkaEventBus] Connected to Kafka bootstrap servers at: ${this.brokerUrl}`);
    } catch (err: any) {
      console.error('[KafkaEventBus] Producer connection failed:', err.message || err);
    }
  }

  public publish(event: DomainEvent): void {
    if (!this.isConnected) {
      this.connect()
        .then(() => this.sendEvent(event))
        .catch(() => {});
    } else {
      this.sendEvent(event).catch(() => {});
    }
  }

  private async sendEvent(event: DomainEvent): Promise<void> {
    const eventName = event.constructor.name;
    const topic = 'inventory-events';
    
    const payload = {
      ...event,
      occurredAt: event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt
    };

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: (event as any).tenantId || 'default',
            value: JSON.stringify({
              type: eventName,
              payload
            })
          }
        ]
      });
      console.log(`[KafkaEventBus] Published event "${eventName}" to topic "${topic}"`);
    } catch (err: any) {
      console.error(`[KafkaEventBus] Failed to publish event "${eventName}":`, err.message || err);
    }
  }

  public subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.localHandlers.has(eventName)) {
      this.localHandlers.set(eventName, []);
    }
    this.localHandlers.get(eventName)!.push(handler as EventHandler);

    if (!this.consumer) {
      this.startConsumer().catch(err => {
        console.error('[KafkaEventBus] Consumer startup failed:', err);
      });
    }
  }

  private async startConsumer(): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId: 'gql-inventory-group' });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'inventory-events', fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (!message.value) return;
          const { type, payload } = JSON.parse(message.value.toString());
          const handlers = this.localHandlers.get(type) || [];
          for (const handler of handlers) {
            const eventObj = {
              ...payload,
              occurredAt: new Date(payload.occurredAt)
            };
            await handler(eventObj);
          }
        } catch (err: any) {
          console.error('[KafkaEventBus] Error processing consumed message:', err.message || err);
        }
      }
    });
    console.log('[KafkaEventBus] Asynchronous consumer loop active');
  }

  public async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      console.log('[KafkaEventBus] Disconnected from Kafka');
    } catch (err: any) {
      console.error('[KafkaEventBus] Error during disconnect:', err.message || err);
    }
  }
}
