# @composable-backend/testing

Test harness for [composable-backend](https://github.com/ernestojballon/composable-backend). Reduces test boilerplate from ~15 lines to 2 and adds event spying.

## Install

```bash
npm install --save-dev @composable-backend/testing
```

Peer dependency: `composable-backend` (^1.2.0).

## Quick start

### Before (manual setup)

```typescript
import { fileURLToPath } from 'url';
import { AppConfig, Platform, PostOffice, Sender, EventEnvelope } from 'composable-backend';
import myTask from '../src/my-task.task.js';

function getRootFolder() {
  const folder = fileURLToPath(new URL('..', import.meta.url));
  const path = folder.includes('\\') ? folder.replaceAll('\\', '/') : folder;
  const colon = path.indexOf(':');
  return colon == 1 ? path.substring(colon + 1) : path;
}

let platform: Platform;

beforeAll(async () => {
  AppConfig.getInstance(getRootFolder() + 'tests/resources');
  platform = Platform.getInstance();
  await platform.getReady();
  platform.registerComposable(myTask);
});

it('returns a greeting', async () => {
  const po = new PostOffice(new Sender('unit.test', '1', 'TEST'));
  const result = await po.request(
    new EventEnvelope().setTo('v1.my.task').setBody({ name: 'Ada' }),
    5000
  );
  expect(result.getBody()).toEqual({ message: 'Hello Ada!' });
});
```

### After (with test harness)

```typescript
import { TestHarness } from '@composable-backend/testing';
import myTask from '../src/my-task.task.js';

let harness: TestHarness;

beforeAll(async () => {
  harness = await TestHarness.setup();
  harness.register(myTask);
});

it('returns a greeting', async () => {
  const result = await harness.call('v1.my.task', { name: 'Ada' });
  expect(result).toEqual({ message: 'Hello Ada!' });
});
```

## API

### TestHarness

| Method | Returns | Description |
|---|---|---|
| `TestHarness.setup(options?)` | `Promise<TestHarness>` | Initialize platform and config. Auto-detects resources folder. |
| `register(composable)` | `void` | Register a `defineComposable()` task |
| `register(route, composable, instances?, visibility?)` | `void` | Register a class-style composable |
| `call<T>(route, body?, timeout?)` | `Promise<T>` | RPC call — returns response body directly |
| `request(route, body?, headers?, timeout?)` | `Promise<EventEnvelope>` | RPC call — returns full envelope (headers, status, body) |
| `send(route, body?, headers?)` | `Promise<void>` | Fire-and-forget event |
| `spy(route)` | `EventSpy` | Create a spy that captures all events sent to a route |
| `clearSpies()` | `void` | Reset all spy counters |
| `getPlatform()` | `Platform` | Access the underlying Platform instance |

### EventSpy

Captures events sent to a route for inspection.

```typescript
const spy = harness.spy('kafka.notification');

// ... run code that sends to kafka.notification ...

expect(spy.count()).toBe(1);
expect(spy.last().body).toEqual({ content: 'hello' });
expect(spy.hasHeader('topic', 'leads.scored')).toBe(true);
expect(spy.hasBody({ content: 'hello' })).toBe(true);
```

| Method | Returns | Description |
|---|---|---|
| `events()` | `CapturedEvent[]` | All captured events |
| `count()` | `number` | Number of captured events |
| `first()` | `CapturedEvent \| null` | First captured event |
| `last()` | `CapturedEvent \| null` | Last captured event |
| `at(index)` | `CapturedEvent \| null` | Event at index |
| `hasEvent(predicate)` | `boolean` | Any event matches predicate |
| `hasHeader(key, value)` | `boolean` | Any event has this header |
| `hasBody(body)` | `boolean` | Any event has this body (deep equality) |
| `clear()` | `void` | Reset captured events |

### CapturedEvent

```typescript
interface CapturedEvent {
  to: string;
  from: string | null;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}
```
