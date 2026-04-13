import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AppConfig,
  Platform,
  PostOffice,
  Sender,
  EventEnvelope,
  NoOpComposable,
} from 'composable-backend';
import { EventSpy } from './event-spy.js';
import type { TestHarnessOptions, CapturedEvent } from './types.js';

/**
 * Test harness for composable-backend.
 *
 * Reduces test setup from ~15 lines to 2:
 *
 *   const harness = await TestHarness.setup();
 *   const result = await harness.call('v1.hello.greet', { name: 'Ada' });
 *
 * Provides event spying, simplified RPC, and automatic platform lifecycle.
 */
export class TestHarness {
  private readonly platform: Platform;
  private readonly spies = new Map<string, EventSpy>();

  private constructor(platform: Platform) {
    this.platform = platform;
  }

  /**
   * Initialize the test harness.
   * Sets up AppConfig, Platform, and registers NoOpComposable.
   *
   * @param options - optional configuration
   * @returns ready-to-use harness
   */
  static async setup(options?: TestHarnessOptions): Promise<TestHarness> {
    const resourcePath = options?.resourcePath ?? TestHarness.findResources();
    AppConfig.getInstance(resourcePath);
    const platform = Platform.getInstance();
    await platform.getReady();
    platform.registerComposable(NoOpComposable);
    return new TestHarness(platform);
  }

  /**
   * Auto-detect resources folder by searching common locations.
   */
  private static findResources(): string {
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, 'tests', 'resources'),
      path.join(cwd, 'test', 'resources'),
      path.join(cwd, 'src', 'config'),
      path.join(cwd, 'src', 'resources'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        return p;
      }
    }
    return cwd;
  }

  /**
   * Get the Platform instance.
   */
  getPlatform(): Platform {
    return this.platform;
  }

  /**
   * Register a composable (class-style or defineComposable-style).
   */
  register(routeOrComposable: string | object, composable?: object, instances?: number, visibility?: string): void {
    if (typeof routeOrComposable === 'string') {
      this.platform.register(routeOrComposable, composable!, instances, visibility);
    } else {
      this.platform.registerComposable(routeOrComposable as any);
    }
  }

  /**
   * Send a fire-and-forget event.
   */
  async send(route: string, body?: unknown, headers?: Record<string, string>): Promise<void> {
    const po = new PostOffice(new Sender('test.harness', '', 'TEST'));
    const evt = new EventEnvelope().setTo(route);
    if (body !== undefined) evt.setBody(body as any);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        evt.setHeader(k, v);
      }
    }
    await po.send(evt);
  }

  /**
   * Make an RPC call and return the response body.
   * This is the most common test operation.
   */
  async call<T = unknown>(route: string, body?: unknown, timeout = 5000): Promise<T> {
    const po = new PostOffice(new Sender('test.harness', '', 'TEST'));
    const evt = new EventEnvelope().setTo(route);
    if (body !== undefined) evt.setBody(body as any);
    const result = await po.request(evt, timeout);
    return result.getBody() as T;
  }

  /**
   * Make an RPC call and return the full EventEnvelope response.
   * Use when you need to inspect headers, status, etc.
   */
  async request(route: string, body?: unknown, headers?: Record<string, string>, timeout = 5000): Promise<EventEnvelope> {
    const po = new PostOffice(new Sender('test.harness', '', 'TEST'));
    const evt = new EventEnvelope().setTo(route);
    if (body !== undefined) evt.setBody(body as any);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        evt.setHeader(k, v);
      }
    }
    return await po.request(evt, timeout);
  }

  /**
   * Create an EventSpy that captures all events sent to a route.
   * The spy replaces any existing composable at that route.
   */
  spy(route: string): EventSpy {
    const existing = this.spies.get(route);
    if (existing) {
      existing.clear();
      return existing;
    }
    const eventSpy = new EventSpy(route);
    eventSpy.register(this.platform);
    this.spies.set(route, eventSpy);
    return eventSpy;
  }

  /**
   * Clear all spy captured events.
   */
  clearSpies(): void {
    for (const spy of this.spies.values()) {
      spy.clear();
    }
  }
}
