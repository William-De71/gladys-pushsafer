// -----------------------------------------------------------------------------
// The handlers of src/app.js, driven by the fake Gladys of the SDK (the real
// GladysIntegration with an in-memory Gladys, so payloads are checked the way
// the core checks them) against a fake Pushsafer API. Nothing touches the
// network; the state file lives in a temporary directory.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, TEST_MESSAGE } from '../src/app.js';
import { createFakePushsafer, KEYS } from './helpers/fake-pushsafer.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const CONTACT = { device: '52' };
const MESSAGE = { text: 'The front door is open', file: null };
// The smallest valid JPEG header is enough: the integration only checks the type.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/**
 * @description A connected fake Gladys running the integration against a fake Pushsafer.
 * @param {object} [options] - Options.
 * @param {object} [options.config] - Configuration values on top of the keys.
 * @param {object} [options.pushsafer] - Options of createFakePushsafer.
 * @param {string} [options.statePath] - The state file (a new temporary one by default).
 * @param {Function} [options.now] - The clock.
 * @returns {Promise<object>} `{ gladys, pushsafer, app, statePath }`.
 */
async function start({
  config = {},
  pushsafer: fake = {},
  statePath,
  now = () => Date.now(),
} = {}) {
  const path = statePath ?? join(await mkdtemp(join(tmpdir(), 'pushsafer-')), 'state.json');
  const pushsafer = createFakePushsafer(fake);
  const gladys = createFakeGladys({ config: { ...KEYS, ...config } });
  const app = createApp(gladys, {
    transport: pushsafer.transport,
    statePath: path,
    now,
    wait: async () => {},
    timers: false,
  });
  await gladys.connect();
  return { gladys, pushsafer, app, statePath: path };
}

/**
 * @description Check a scene event against its manifest declaration.
 * @param {object} event - `{ key, data }`.
 */
function assertDeclared(event) {
  const trigger = byKey(manifest.scene_triggers).get(event.key);
  assert.ok(trigger, event.key);
  const variables = trigger.variables.map((variable) => variable.key).sort();
  assert.deepEqual(Object.keys(event.data).sort(), variables, event.key);
  for (const value of Object.values(event.data)) {
    assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
  }
}

const messageOf = (ack) => ack.data?.message ?? ack.data;

test('connects: checks the key, reads the devices and groups', async () => {
  const { gladys, pushsafer } = await start();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(
    gladys.fake.connectionStatus.message.fr,
    'Compte Pushsafer jane@example.com. Appareils : 2, groupes : 1. Appels d’API restants : connu après le premier push.',
  );
  assert.deepEqual(
    pushsafer.calls.map((call) => call.path).sort(),
    ['/api-de', '/api-g', '/api-k'],
    'reading the account sends no push',
  );
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('without a key: disconnected with a message in four languages, no Pushsafer call', async () => {
  const pushsafer = createFakePushsafer();
  const gladys = createFakeGladys({ config: {} });
  createApp(gladys, {
    transport: pushsafer.transport,
    statePath: '/nonexistent/state.json',
    timers: false,
  });
  await gladys.connect();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(Object.keys(gladys.fake.connectionStatus.message).sort(), [
    'de',
    'en',
    'es',
    'fr',
  ]);
  assert.equal(pushsafer.calls.length, 0);
});

test('the key alone: ready to send, nothing read', async () => {
  const { gladys, pushsafer } = await start({ config: { username: '' } });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.en, /key not checked/);
  assert.equal(pushsafer.calls.length, 0);
  const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(ack.success, true);
});

test('a refused key: disconnected, with the reason', async () => {
  const { gladys } = await start({ config: { private_key: 'WrongWrongWrongWrong' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refuses the key/);
});

test('a message goes to the device of the target user, with the look of the configuration', async () => {
  const { gladys, pushsafer, app } = await start({
    config: {
      title: 'Maison',
      icon: 20,
      sound: 8,
      vibration: '2',
      priority: '1',
      time_to_live: 60,
    },
  });
  const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(ack.success, true);
  const [push] = pushsafer.pushes();
  assert.deepEqual(push, {
    k: KEYS.private_key,
    d: '52',
    m: 'The front door is open',
    t: 'Maison',
    i: '20',
    s: '8',
    v: '2',
    pr: '1',
    l: '60',
  });
  assert.equal(app.store.counters().sent, 1);
  assert.deepEqual(app.store.apiCalls().left, 999);
  assert.deepEqual(gladys.fake.sceneEvents, []);
  assert.ok(gladys.fake.widgetRefreshes.includes('account'));
});

test('the default look: title Gladys, priority normal, nothing else forced', async () => {
  const { gladys, pushsafer } = await start();
  await gladys.fake.sendMessage({ device: 'gs12' }, MESSAGE);
  assert.deepEqual(pushsafer.pushes()[0], {
    k: KEYS.private_key,
    d: 'gs12',
    m: 'The front door is open',
    t: 'Gladys',
    pr: '0',
  });
});

test('a camera snapshot goes with the push as a data URL', async () => {
  const { gladys, pushsafer } = await start();
  const file = `image/jpg;base64,${JPEG.toString('base64')}`;
  await gladys.fake.sendMessage(CONTACT, { text: 'Motion', file });
  assert.equal(pushsafer.pushes()[0].p, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
});

test('a refused push fails the message and fires push_not_sent once, until a push goes through', async () => {
  const { gladys, pushsafer } = await start({ pushsafer: { available: 0 } });
  for (let i = 0; i < 3; i += 1) {
    const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
    assert.equal(ack.success, false);
  }
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [event] = gladys.fake.sceneEvents;
  assertDeclared(event);
  assert.equal(event.key, 'push_not_sent');
  assert.equal(event.data.reason, 'no_api_calls');
  assert.equal(event.data.status, 280);
  assert.equal(event.data.device, '52');
  assert.doesNotMatch(JSON.stringify(event), new RegExp(KEYS.private_key));

  pushsafer.state.available = 10;
  assert.equal((await gladys.fake.sendMessage(CONTACT, MESSAGE)).success, true);
  pushsafer.state.available = 0;
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === 'push_not_sent').length, 2);
});

test('a refused device is its own scope: another user still fires once for the account', async () => {
  const { gladys } = await start({ config: { private_key: KEYS.private_key } });
  await gladys.fake.sendMessage({ device: '99' }, MESSAGE);
  await gladys.fake.sendMessage({ device: '99' }, MESSAGE);
  const events = gladys.fake.sceneEvents.filter((e) => e.key === 'push_not_sent');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.reason, 'invalid_device');
});

test('a user without a valid device: not sent, invalid_device, no Pushsafer call', async () => {
  const { gladys, pushsafer } = await start();
  const ack = await gladys.fake.sendMessage({ device: 'my phone' }, MESSAGE);
  assert.equal(ack.success, false);
  assert.equal(pushsafer.pushes().length, 0);
  assert.equal(gladys.fake.sceneEvents[0].data.reason, 'invalid_device');
});

test('a network failure is retried once; a 520 of Cloudflare too', async () => {
  const { gladys, pushsafer } = await start({
    pushsafer: {
      sends: [
        { throws: Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }) },
      ],
    },
  });
  assert.equal((await gladys.fake.sendMessage(CONTACT, MESSAGE)).success, true);
  assert.equal(pushsafer.pushes().length, 2);

  pushsafer.state.sends.push({ status: 520, body: 'error code: 520' });
  assert.equal((await gladys.fake.sendMessage(CONTACT, MESSAGE)).success, true);
  assert.equal(pushsafer.pushes().length, 4);

  // A refusal of Pushsafer itself is never retried.
  pushsafer.state.sends.push({ status: 250, body: { status: 0, error: 'invalid key' } });
  assert.equal((await gladys.fake.sendMessage(CONTACT, MESSAGE)).success, false);
  assert.equal(pushsafer.pushes().length, 5);
});

test('api_calls_low fires once below the threshold, survives a restart, re-arms above it', async () => {
  const first = await start({
    config: { low_api_calls_threshold: 999 },
    pushsafer: { available: 1000 },
  });
  await first.gladys.fake.sendMessage(CONTACT, MESSAGE); // 999 left: not below
  assert.deepEqual(first.gladys.fake.sceneEvents, []);
  await first.gladys.fake.sendMessage(CONTACT, MESSAGE); // 998 left
  await first.gladys.fake.sendMessage(CONTACT, MESSAGE); // 997 left
  const low = first.gladys.fake.sceneEvents.filter((e) => e.key === 'api_calls_low');
  assert.equal(low.length, 1);
  assertDeclared(low[0]);
  assert.deepEqual(low[0].data, { api_calls_left: 998, threshold: 999 });
  await first.app.store.flush();

  const second = await start({
    config: { low_api_calls_threshold: 999 },
    pushsafer: { available: 990 },
    statePath: first.statePath,
  });
  await second.gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.deepEqual(second.gladys.fake.sceneEvents, [], 'already low before the restart');

  second.pushsafer.state.available = 5000;
  await second.gladys.fake.sendMessage(CONTACT, MESSAGE);
  second.pushsafer.state.available = 10;
  await second.gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(second.gladys.fake.sceneEvents.filter((e) => e.key === 'api_calls_low').length, 1);
});

test('the send_push scene action: its own fields, declared outputs, never a trigger', async () => {
  const { gladys, pushsafer } = await start({ config: { low_api_calls_threshold: 5000 } });
  const ack = await gladys.fake.sceneAction('send_push', {
    device: '52, 65',
    message: 'Water leak in the cellar',
    title: 'Alarm',
    priority: '2',
    sound: 25,
    icon: 2,
    icon_color: '#ff0000',
    url: 'https://gladys.local/dashboard',
    time_to_live: 0,
    confirm_seconds: 60,
  });
  assert.equal(ack.success, true);
  const outputs = ack.data?.outputs ?? ack.data;
  const declared = byKey(manifest.scene_actions)
    .get('send_push')
    .outputs.map((o) => o.key);
  assert.deepEqual(Object.keys(outputs).sort(), declared.sort());
  assert.equal(outputs.api_calls_left, 998);
  assert.match(outputs.message_ids, /^\d+:52,\d+:65$/);
  assert.deepEqual(pushsafer.pushes()[0], {
    k: KEYS.private_key,
    d: '52|65',
    m: 'Water leak in the cellar',
    t: 'Alarm',
    i: '2',
    s: '25',
    pr: '2',
    c: '#FF0000',
    u: 'https://gladys.local/dashboard',
    cr: '60',
  });
  assert.deepEqual(gladys.fake.sceneEvents, [], 'below the threshold, but an action never fires');

  const wrong = await gladys.fake.sceneAction('send_push', { device: 'phone', message: 'x' });
  assert.equal(wrong.success, false);
  const refused = await gladys.fake.sceneAction('send_push', { device: '77', message: 'x' });
  assert.equal(refused.success, false);
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('Configuration screen: test the connection, send a test push', async () => {
  const { gladys, pushsafer } = await start();
  const tested = await gladys.fake.action('test_connection');
  assert.equal(tested.success, true);
  assert.equal(
    messageOf(tested).en,
    'Connected. Devices: iPhone Jane (52), Pixel (65). Groups: Family (gs12). API calls left: known after the first push.',
  );
  assert.equal(pushsafer.pushes().length, 0);

  const wrong = await gladys.fake.action('send_test_push', { device: 'hello' });
  assert.match(messageOf(wrong).en, /is not a valid device/);
  assert.equal(pushsafer.pushes().length, 0);

  const sent = await gladys.fake.action('send_test_push', { device: '52' });
  assert.equal(
    messageOf(sent).fr,
    'Push de test envoyé à iPhone Jane (52). Appels d’API restants : 999.',
  );
  assert.equal(pushsafer.pushes()[0].m, TEST_MESSAGE);
  assert.equal(pushsafer.pushes()[0].d, '52');

  const all = await gladys.fake.action('send_test_push', {});
  assert.match(messageOf(all).en, /Test push sent to a\. API calls left: 997/);

  const refused = await gladys.fake.action('send_test_push', { device: '77' });
  assert.equal(messageOf(refused).en, 'The test push was not sent: device refused.');
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('test the connection without username, or with a refused key', async () => {
  const noUser = await start({ config: { username: '' } });
  assert.match(messageOf(await noUser.gladys.fake.action('test_connection')).en, /username/);
  const wrong = await start({ config: { private_key: 'WrongWrongWrongWrong' } });
  assert.match(messageOf(await wrong.gladys.fake.action('test_connection')).en, /refuses the key/);
});

test('both widgets are valid in every language, from what the integration knows', async () => {
  const clock = Date.parse('2026-11-21T08:00:00Z');
  const { gladys, pushsafer } = await start({
    config: { low_api_calls_threshold: 1500 },
    now: () => clock,
  });
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of ['account', 'recent']) {
      const ack = await gladys.fake.widgetGet(key, { language });
      assert.equal(ack.success, true, `${key} ${language}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language} (empty)`);
    }
  }
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  await gladys.fake.sendMessage({ device: '77' }, { text: 'Lost', file: null });
  const before = pushsafer.calls.length;
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of ['account', 'recent']) {
      const ack = await gladys.fake.widgetGet(key, { language });
      assert.equal(ack.success, true, `${key} ${language}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
    }
  }
  assert.equal(pushsafer.calls.length, before, 'a widget never calls Pushsafer');

  const account = (await gladys.fake.widgetGet('account', { language: 'en' })).data.content;
  const calls = account.components.find((component) => component.type === 'value');
  assert.equal(calls.value, 999);
  assert.equal(calls.color, 'danger');
  const rows = account.components.find((component) => component.type === 'status').items;
  assert.ok(rows.some((row) => row.value === 'device refused' && row.label.startsWith('Last')));
  assert.ok(rows.some((row) => row.value === '2 on / 2 · groups: 1'));

  const recent = (await gladys.fake.widgetGet('recent', { language: 'fr' })).data.content;
  const list = recent.components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.badge.text]),
    [
      ['Lost', 'non parti'],
      ['The front door is open', 'envoyé'],
    ],
  );
  assert.match(list.items[1].description, /À : iPhone Jane \(52\)/);
});

test('a new key or threshold compares the API calls again from scratch', async () => {
  const { gladys, app } = await start({ config: { low_api_calls_threshold: 999 } });
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(app.store.lowApiCalls(), true);
  await gladys.fake.configUpdated({ ...KEYS, low_api_calls_threshold: 10 });
  assert.equal(app.store.lowApiCalls(), null);
  assert.equal(app.getConfig().lowApiCallsThreshold, 10);
});
