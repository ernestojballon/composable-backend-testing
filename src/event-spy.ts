import { EventEnvelope, defineComposable, PostOffice, Sender } from 'composable-backend';
import type { CapturedEvent } from './types.js';

/**
 * Captures events sent to a specific route for inspection in tests.
 *
 * Usage:
 *   const spy = new EventSpy('kafka.notification');
 *   spy.register(platform);
 *
 *   // ... run your code that sends to 'kafka.notification' ...
 *
 *   expect(spy.count()).toBe(1);
 *   expect(spy.last().body).toEqual({ content: 'hello' });
 */
export class EventSpy {
  private readonly route: string;
  private readonly captured: CapturedEvent[] = [];

  constructor(route: string) {
    this.route = route;
  }

  /**
   * Register the spy as a composable that captures events on the given route.
   * If a composable is already registered at this route, it will be replaced.
   */
  register(platform: { register: (route: string, composable: object, instances?: number) => void; release?: (route: string) => void }): void {
    const captured = this.captured;
    const spy = defineComposable({
      process: this.route,
      instances: 1,
      handler: async (evt: EventEnvelope) => {
        captured.push({
          to: evt.getTo() ?? this.route,
          from: evt.getFrom() ?? null,
          headers: { ...evt.getHeaders() } as Record<string, string>,
          body: evt.getBody(),
          timestamp: Date.now(),
        });
        return null;
      },
    });
    // Release existing registration if possible
    if (platform.release) {
      try { platform.release(this.route); } catch { /* not registered yet */ }
    }
    platform.register(this.route, spy, 1);
  }

  /** All captured events. */
  events(): CapturedEvent[] {
    return [...this.captured];
  }

  /** Number of captured events. */
  count(): number {
    return this.captured.length;
  }

  /** The last captured event, or null if none. */
  last(): CapturedEvent | null {
    return this.captured.length > 0 ? this.captured[this.captured.length - 1] : null;
  }

  /** The first captured event, or null if none. */
  first(): CapturedEvent | null {
    return this.captured.length > 0 ? this.captured[0] : null;
  }

  /** Get a captured event by index. */
  at(index: number): CapturedEvent | null {
    return this.captured[index] ?? null;
  }

  /** Reset captured events. */
  clear(): void {
    this.captured.length = 0;
  }

  /** Check if any captured event matches a predicate. */
  hasEvent(predicate: (evt: CapturedEvent) => boolean): boolean {
    return this.captured.some(predicate);
  }

  /** Check if any event was sent with a specific header value. */
  hasHeader(key: string, value: string): boolean {
    return this.captured.some((e) => e.headers[key] === value);
  }

  /** Check if any event body matches (deep equality via JSON). */
  hasBody(body: unknown): boolean {
    const target = JSON.stringify(body);
    return this.captured.some((e) => JSON.stringify(e.body) === target);
  }
}
