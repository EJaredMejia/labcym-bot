import {
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
} from "@whiskeysockets/baileys";
import { getRedisClient } from "./session.service";

const PREFIX = "baileys_auth:";

export async function useRedisAuthState(sessionId = "default"): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("Redis client is not available. Check your Redis environment variables.");
  }

  const keyPrefix = `${PREFIX}${sessionId}:`;

  // Parse JSON with Baileys binary Buffer reviver
  const deserialize = (data: any) => {
    if (!data) return null;
    const str = typeof data === "object" ? JSON.stringify(data) : String(data);
    return JSON.parse(str, BufferJSON.reviver);
  };

  // Load existing credentials or initialize new ones
  const rawCreds = await redis.get(`${keyPrefix}creds`);
  const creds: AuthenticationCreds = deserialize(rawCreds) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<{ [key: string]: SignalDataTypeMap[T] }> => {
          const data: { [key: string]: SignalDataTypeMap[T] } = {};
          if (!ids.length) return data;

          const pipeline = redis.pipeline();
          ids.forEach((id) => pipeline.get(`${keyPrefix}${type}-${id}`));
          const results = await pipeline.exec();

          ids.forEach((id, index) => {
            const value = deserialize(results[index]);
            if (value) data[id] = value;
          });

          return data;
        },
        set: async (dataset: any): Promise<void> => {
          const pipeline = redis.pipeline();
          let count = 0;

          for (const category in dataset) {
            for (const id in dataset[category]) {
              const value = dataset[category][id];
              const key = `${keyPrefix}${category}-${id}`;

              if (value) {
                pipeline.set(key, JSON.stringify(value, BufferJSON.replacer));
              } else {
                pipeline.del(key);
              }
              count++;
            }
          }

          if (count > 0) {
            await pipeline.exec();
          }
        },
      },
    },
    saveCreds: async () => {
      await redis.set(
        `${keyPrefix}creds`,
        JSON.stringify(creds, BufferJSON.replacer),
      );
    },
  };
}
