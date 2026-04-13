import { EventEnvelope } from 'composable-backend';

interface ComposableLike {
  handleEvent(evt: EventEnvelope): Promise<unknown>;
  inputSchema?: { parse(value: unknown): unknown };
  outputSchema?: { parse(value: unknown): unknown };
}

/**
 * Test a composable task directly — no platform, no event bus, no setup.
 *
 * Usage:
 *   const result = await testTask(myTask, { name: 'Ada' });
 *   expect(result).toEqual({ message: 'Hello Ada!' });
 *
 * @param task - A DefinedComposable (from defineComposable()) or any object with handleEvent()
 * @param body - Input payload (optional)
 * @param headers - Event headers (optional)
 * @returns The handler's return value
 */
export async function testTask<T = unknown>(
  task: ComposableLike,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const evt = new EventEnvelope();
  if (body !== undefined) {
    const validated = task.inputSchema ? task.inputSchema.parse(body) : body;
    evt.setBody(validated as string | number | object | boolean | Buffer | Uint8Array);
  }
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      evt.setHeader(k, v);
    }
  }
  const result = await task.handleEvent(evt);
  if (task.outputSchema && result != null) {
    task.outputSchema.parse(result);
  }
  return result as T;
}
