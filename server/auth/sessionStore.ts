import session from 'express-session';
import { prisma } from '../db/client.ts';

/**
 * PostgreSQL-backed Session Store implementing Express Session Store contract via Prisma.
 * Persists session state to the PostgreSQL "sessions" table.
 * Includes in-memory resilience for graceful development without an active PostgreSQL daemon.
 */
export class PrismaSessionStore extends session.Store {
  // In-memory fallback map used strictly when PostgreSQL is disconnected
  private memoryFallback: Map<string, { data: session.SessionData; expiresAt: Date }> = new Map();
  private lastDbFailureTime = 0;
  private readonly DB_RETRY_INTERVAL_MS = 10000; // Check DB availability at most every 10s if failing

  constructor() {
    super();
  }

  private isDbAvailable(): boolean {
    return Date.now() - this.lastDbFailureTime > this.DB_RETRY_INTERVAL_MS;
  }

  private markDbFailure(): void {
    this.lastDbFailureTime = Date.now();
  }

  override get(
    sid: string,
    callback: (err?: any, session?: session.SessionData | null) => void
  ): void {
    if (!this.isDbAvailable()) {
      const fallback = this.memoryFallback.get(sid);
      if (fallback && fallback.expiresAt > new Date()) {
        return callback(null, fallback.data);
      }
      return callback(null, null);
    }

    prisma.session
      .findUnique({ where: { sid } })
      .then((record) => {
        if (!record) {
          const fallback = this.memoryFallback.get(sid);
          if (fallback && fallback.expiresAt > new Date()) {
            return callback(null, fallback.data);
          }
          return callback(null, null);
        }

        if (record.expiresAt && record.expiresAt < new Date()) {
          this.destroy(sid, () => {});
          return callback(null, null);
        }

        try {
          const parsedData = JSON.parse(record.data) as session.SessionData;
          return callback(null, parsedData);
        } catch (parseErr) {
          return callback(parseErr);
        }
      })
      .catch(() => {
        this.markDbFailure();
        const fallback = this.memoryFallback.get(sid);
        if (fallback && fallback.expiresAt > new Date()) {
          return callback(null, fallback.data);
        }
        callback(null, null);
      });
  }

  override set(
    sid: string,
    sessionData: session.SessionData,
    callback?: (err?: any) => void
  ): void {
    const maxAge = sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + maxAge);
    const serialized = JSON.stringify(sessionData);

    this.memoryFallback.set(sid, { data: sessionData, expiresAt });

    if (!this.isDbAvailable()) {
      return callback?.(null);
    }

    prisma.session
      .upsert({
        where: { sid },
        update: {
          data: serialized,
          expiresAt,
        },
        create: {
          id: sid,
          sid,
          data: serialized,
          expiresAt,
        },
      })
      .then(() => {
        callback?.(null);
      })
      .catch(() => {
        this.markDbFailure();
        callback?.(null);
      });
  }

  override destroy(sid: string, callback?: (err?: any) => void): void {
    this.memoryFallback.delete(sid);

    if (!this.isDbAvailable()) {
      return callback?.(null);
    }

    prisma.session
      .deleteMany({ where: { sid } })
      .then(() => {
        callback?.(null);
      })
      .catch(() => {
        this.markDbFailure();
        callback?.(null);
      });
  }

  override touch(
    sid: string,
    sessionData: session.SessionData,
    callback?: (err?: any) => void
  ): void {
    const maxAge = sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + maxAge);

    const fallback = this.memoryFallback.get(sid);
    if (fallback) {
      fallback.expiresAt = expiresAt;
    }

    if (!this.isDbAvailable()) {
      return callback?.(null);
    }

    prisma.session
      .updateMany({
        where: { sid },
        data: { expiresAt },
      })
      .then(() => callback?.(null))
      .catch(() => {
        this.markDbFailure();
        callback?.(null);
      });
  }
}
