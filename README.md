# @composable-backend/testing

Test utilities for [composable-backend](https://github.com/ernestojballon/composable-backend). Test composable functions with zero boilerplate.

## Install

```bash
npm install --save-dev @composable-backend/testing
```

Peer dependency: `composable-backend` (^1.2.0).

## Quick start

A composable is just input -> function -> output. Test it directly:

```typescript
import { describe, expect, it } from 'vitest';
import { testTask } from '@composable-backend/testing';
import myTask from '../src/my-task.task.js';

describe('my task', () => {
  it('returns expected result', async () => {
    const result = await testTask(myTask, { name: 'Ada' });
    expect(result).toEqual({ message: 'Hello Ada!' });
  });
});
```

No setup. No beforeAll. No platform initialization. Just import the task and test it.

### Before (manual setup — 15 lines)

```typescript
import { fileURLToPath } from 'url';
import { AppConfig, Platform, PostOffice, Sender, EventEnvelope } from 'composable-backend';
import myTask from '../src/my-task.task.js';

function getRootFolder() { /* ... 5 lines ... */ }

let platform: Platform;

beforeAll(async () => {
  AppConfig.getInstance(getRootFolder() + 'tests/resources');
  platform = Platform.getInstance();
  await platform.getReady();
  platform.registerComposable(myTask);
});

it('works', async () => {
  const po = new PostOffice(new Sender('unit.test', '1', 'TEST'));
  const result = await po.request(
    new EventEnvelope().setTo('v1.my.task').setBody({ name: 'Ada' }), 5000
  );
  expect(result.getBody()).toEqual({ message: 'Hello Ada!' });
});
```

### After (testTask — 1 line)

```typescript
import { testTask } from '@composable-backend/testing';
import myTask from '../src/my-task.task.js';

it('works', async () => {
  const result = await testTask(myTask, { name: 'Ada' });
  expect(result).toEqual({ message: 'Hello Ada!' });
});
```

## API

### testTask(task, body?, headers?)

Test a composable function directly. Calls the handler without the platform or event bus.

```typescript
// Basic
const result = await testTask(myTask, { name: 'Ada' });

// With headers
const result = await testTask(myTask, { data: 'payload' }, { topic: 'leads' });

// No input
const result = await testTask(myTask);
```

- Runs `inputSchema` validation if defined on the task
- Runs `outputSchema` validation if defined on the task
- Returns the handler's return value directly

### TestHarness

For tests that need the full event bus (task-to-task communication, spying):

```typescript
import { TestHarness } from '@composable-backend/testing';

const harness = await TestHarness.setup();
harness.register(myTask);

const result = await harness.call('v1.my.task', { name: 'Ada' });
```

| Method | Returns | Description |
|---|---|---|
| `TestHarness.setup(options?)` | `Promise<TestHarness>` | Initialize platform and config |
| `register(composable)` | `void` | Register a composable |
| `call<T>(route, body?, timeout?)` | `Promise<T>` | RPC — returns body directly |
| `request(route, body?, headers?, timeout?)` | `Promise<EventEnvelope>` | RPC — returns full envelope |
| `send(route, body?, headers?)` | `Promise<void>` | Fire-and-forget |
| `spy(route)` | `EventSpy` | Capture events for assertions |
| `clearSpies()` | `void` | Reset all spies |

### EventSpy

Capture events sent to a route:

```typescript
const spy = harness.spy('kafka.notification');

await harness.call('v1.lead.publish', leadData);

expect(spy.count()).toBe(1);
expect(spy.last().body).toEqual({ content: leadData });
expect(spy.hasHeader('topic', 'leads.scored')).toBe(true);
```

| Method | Returns | Description |
|---|---|---|
| `events()` | `CapturedEvent[]` | All captured events |
| `count()` | `number` | Number of captured events |
| `first()` / `last()` | `CapturedEvent \| null` | First/last event |
| `at(index)` | `CapturedEvent \| null` | Event by index |
| `hasHeader(key, value)` | `boolean` | Any event has this header |
| `hasBody(body)` | `boolean` | Any event has this body (deep equality) |
| `hasEvent(predicate)` | `boolean` | Any event matches predicate |
| `clear()` | `void` | Reset captured events |

## When to use what

| Need | Use |
|---|---|
| Test a single task (most common) | `testTask(task, input)` |
| Test task-to-task communication | `TestHarness` + `call()` |
| Spy on events sent to a route | `TestHarness` + `spy()` |
