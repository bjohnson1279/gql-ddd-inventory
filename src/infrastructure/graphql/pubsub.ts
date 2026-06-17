import { PubSub } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

let pubsubInstance: any;

if (process.env.NODE_ENV === 'test') {
  pubsubInstance = new PubSub();
} else {
  const redisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  };

  pubsubInstance = new RedisPubSub({
    publisher: new Redis(redisOptions),
    subscriber: new Redis(redisOptions),
  });
}

export const pubsub = pubsubInstance;
