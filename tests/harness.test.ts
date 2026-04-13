import { describe, expect, it, beforeAll } from 'vitest';
import { defineComposable, EventEnvelope } from 'composable-backend';
import { TestHarness, EventSpy } from '../src/index.js';

const echoTask = defineComposable({
  process: 'test.echo',
  handler: async (evt: EventEnvelope) => {
    return evt.getBody();
  },
  instances: 1,
});

const greetTask = defineComposable({
  process: 'test.greet',
  handler: async (evt: EventEnvelope) => {
    const body = evt.getBody() as Record<string, unknown>;
    return { message: `Hello ${body.name}!` };
  },
  instances: 1,
});

describe('TestHarness', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.setup();
    harness.register(echoTask);
    harness.register(greetTask);
  });

  it('call() returns body directly', async () => {
    const result = await harness.call('test.echo', { ping: true });
    expect(result).toEqual({ ping: true });
  });

  it('call() with typed response', async () => {
    const result = await harness.call<{ message: string }>('test.greet', { name: 'Ada' });
    expect(result.message).toBe('Hello Ada!');
  });

  it('request() returns full envelope', async () => {
    const result = await harness.request('test.echo', { data: 42 });
    expect(result.getStatus()).toBe(200);
    expect(result.getBody()).toEqual({ data: 42 });
  });

  it('request() with custom headers', async () => {
    const result = await harness.request('test.echo', 'hello', { 'x-custom': 'value' });
    expect(result.getBody()).toBe('hello');
  });
});

describe('EventSpy', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await TestHarness.setup();
  });

  it('captures events sent to a route', async () => {
    const spy = harness.spy('spy.target');

    await harness.send('spy.target', { hello: 'world' });
    // small delay for async event delivery
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.count()).toBe(1);
    expect(spy.first()!.body).toEqual({ hello: 'world' });
  });

  it('hasHeader checks headers', async () => {
    const spy = harness.spy('spy.headers');

    await harness.send('spy.headers', 'data', { topic: 'leads.scored' });
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.hasHeader('topic', 'leads.scored')).toBe(true);
    expect(spy.hasHeader('topic', 'wrong')).toBe(false);
  });

  it('hasBody checks deep equality', async () => {
    const spy = harness.spy('spy.body');

    await harness.send('spy.body', { content: { nested: true } });
    await new Promise((r) => setTimeout(r, 50));

    expect(spy.hasBody({ content: { nested: true } })).toBe(true);
    expect(spy.hasBody({ content: { nested: false } })).toBe(false);
  });

  it('clear resets captured events', async () => {
    const spy = harness.spy('spy.clear');

    await harness.send('spy.clear', 'first');
    await new Promise((r) => setTimeout(r, 50));
    expect(spy.count()).toBe(1);

    spy.clear();
    expect(spy.count()).toBe(0);
  });
});
