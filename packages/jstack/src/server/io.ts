import { Redis } from "@upstash/redis/cloudflare"
import { logger } from "jstack-shared"

/**
 * IO class for managing real-time communication between clients
 * @template IncomingEvents Type definition for incoming events
 * @template OutgoingEvents Type definition for outgoing events
 */
export class IO<IncomingEvents, OutgoingEvents> {
  private targetRoom: string | null = null
  private redis: Redis
  private readonly prefix: string;

  /**
   * Creates a new IO instance
   * @param redisUrl Redis server URL
   * @param redisToken Authentication token for Redis
   * @param options Additional configuration options
   */
  constructor(redisUrl: string, redisToken: string, options: { prefix?: string } = {}) {
    this.redis = new Redis({ token: redisToken, url: redisUrl, automaticDeserialization: true });
    this.prefix = options.prefix || "io"
  }

  /**
  * Formats a room name with the prefix
  * @param room Room identifier
  * @returns Prefixed room name
  */
  private formatRoomName(room: string): string {
    return `${this.prefix}:${room}`;
  }

  /**
   * Sends to all connected clients in the targeted room
   * @param event Event name
   * @param data Event data
   * @returns Promise that resolves when the message is published
   */
  async emit<K extends keyof OutgoingEvents>(event: K, data: OutgoingEvents[K]) {
    try {
      if (!this.targetRoom) {
        logger.warn('IO emit called without setting a target room first');
        return;
      }

      const roomName = this.formatRoomName(this.targetRoom);
      const payload = JSON.stringify([event, data]);

      await this.redis.publish(roomName, payload);

      logger.success(`IO emitted to room "${this.targetRoom}":`, [event, data]);
    } catch (error) {
      logger.error('Failed to emit event', error);
      throw error;
    } finally {
      // Reset target room after emitting
      this.targetRoom = null;
    }
  }

  /**
   * Targets a specific room for the next emit operation
   * @param room Room identifier
   * @returns this (for method chaining)
   */
  to(room: string): this {
    if (!room) {
      logger.warn('Empty room name provided to IO.to()');
    }

    this.targetRoom = room;
    return this;
  }

  /**
   * Get all clients in a specific room
   * @param room Room identifier
   * @returns Promise that resolves with an array of client IDs
   */
  async getClientsInRoom(room: string): Promise<string[]> {
    try {
      const roomName = this.formatRoomName(room);
      const clients = await this.redis.smembers(`${roomName}:clients`);
      return clients;
    } catch (error) {
      logger.error(`Failed to get clients in room "${room}"`, error);
      return [];
    }
  }

  /**
  * Clear all resources when shutting down
  */
  async close(): Promise<void> {
    try {
      // Redis client cleanup if needed
    } catch (error) {
      logger.error('Error closing IO connections', error);
    }
  }
}