// -----------------------------------------------------------------------------
// Units: configuration, targets, image attachments, the Pushsafer client and
// the state file. Nothing touches the network.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeConfig, normalizeTarget, pushFields, contactTarget } from '../src/config.js';
import { pictureOf, MAX_BYTES } from '../src/picture.js';
import {
  createPushsaferClient,
  reasonOfAnswer,
  messageIdsOf,
  FAILURE_REASONS,
} from '../src/pushsafer-api.js';
import { createStore, MAX_RECENT } from '../src/store.js';
import { createFakePushsafer, KEYS } from './helpers/fake-pushsafer.js';

const silent = { warn() {}, info() {}, debug() {}, error() {} };

test('targets: all, devices, several devices, a group; anything else is refused', () => {
  assert.equal(normalizeTarget('a'), 'a');
  assert.equal(normalizeTarget(' ALL '), 'a');
  assert.equal(normalizeTarget('52'), '52');
  assert.equal(normalizeTarget('52|65'), '52|65');
  assert.equal(normalizeTarget(' 52, 65 ;52 '), '52|65');
  assert.equal(normalizeTarget('GS12'), 'gs12');
  for (const bad of ['', null, undefined, 'phone', 'gs', 'gs12|52', '52|x', '-1', '1.5']) {
    assert.equal(normalizeTarget(bad), null, String(bad));
  }
  assert.equal(contactTarget({ device: '7' }), '7');
  assert.equal(contactTarget(undefined), null);
});

test('configuration: defaults, bounds, empty values keep the setting of the device', () => {
  const config = normalizeConfig({});
  assert.deepEqual(config, {
    privateKey: '',
    username: '',
    title: 'Gladys',
    icon: null,
    sound: null,
    vibration: null,
    priority: 0,
    timeToLive: 0,
    lowApiCallsThreshold: 20,
  });
  const set = normalizeConfig({
    private_key: ' key ',
    username: ' jane ',
    title: '  ',
    icon: '181',
    sound: 0,
    vibration: '3',
    priority: '-2',
    time_to_live: '43200',
    low_api_calls_threshold: '7.4',
  });
  assert.equal(set.privateKey, 'key');
  assert.equal(set.username, 'jane');
  assert.equal(set.title, 'Gladys');
  assert.equal(set.icon, 181);
  assert.equal(set.sound, 0, 'silent is a real value');
  assert.equal(set.vibration, 3);
  assert.equal(set.priority, -2);
  assert.equal(set.timeToLive, 43200);
  assert.equal(set.lowApiCallsThreshold, 7);
  const out = normalizeConfig({ icon: 182, sound: 63, priority: 3, vibration: 'x' });
  assert.equal(out.icon, null);
  assert.equal(out.sound, null);
  assert.equal(out.priority, 0);
  assert.equal(out.vibration, null);
});

test('push fields: the push overrides the configuration, a bad color or link is dropped', () => {
  const config = normalizeConfig({ title: 'Home', icon: 5, sound: 3, priority: '1' });
  const fields = pushFields(config, {
    target: 'a',
    message: 'x'.repeat(6000),
    icon: 7,
    sound: 0,
    iconColor: 'red',
    url: '   ',
    urlTitle: 'ignored without a link',
  });
  assert.equal(fields.m.length, 5000);
  assert.equal(fields.t, 'Home');
  assert.equal(fields.i, 7);
  assert.equal(fields.s, 0);
  assert.equal(fields.pr, 1);
  assert.equal(fields.c, null);
  assert.equal(fields.u, null);
  assert.equal(fields.ut, null);
  assert.equal(fields.l, null, 'no time to live means never deleted');
});

test('attachments: Gladys camera images, data URLs, raw base64; the rest is dropped', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]).toString('base64');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString('base64');
  assert.equal(pictureOf(`image/jpg;base64,${jpeg}`).dataUrl, `data:image/jpeg;base64,${jpeg}`);
  assert.equal(pictureOf(`data:image/png;base64,${png}`).dataUrl, `data:image/png;base64,${png}`);
  assert.equal(pictureOf(png).dataUrl, `data:image/png;base64,${png}`);
  assert.deepEqual(pictureOf(null), { dataUrl: null, reason: null });
  assert.equal(pictureOf('hello world!').reason, 'not_an_image');
  assert.equal(pictureOf(Buffer.from('plain text').toString('base64')).reason, 'not_an_image');
  const big = Buffer.alloc(MAX_BYTES + 1, 0xff).toString('base64');
  assert.equal(pictureOf(big).reason, 'too_large');
});

test('answers of Pushsafer: its own statuses and texts give the reasons', () => {
  assert.equal(reasonOfAnswer(250, 'invalid key'), FAILURE_REASONS.INVALID_KEY);
  assert.equal(reasonOfAnswer(250, 'invalid authentication'), FAILURE_REASONS.INVALID_KEY);
  assert.equal(reasonOfAnswer(255, ''), FAILURE_REASONS.INVALID_KEY);
  assert.equal(reasonOfAnswer(260, ''), FAILURE_REASONS.EMPTY_MESSAGE);
  assert.equal(reasonOfAnswer(270, ''), FAILURE_REASONS.INVALID_DEVICE);
  assert.equal(reasonOfAnswer(275, ''), FAILURE_REASONS.INVALID_GROUP);
  assert.equal(reasonOfAnswer(280, ''), FAILURE_REASONS.NO_API_CALLS);
  assert.equal(
    reasonOfAnswer(400, 'empty message and or private key'),
    FAILURE_REASONS.INVALID_KEY,
  );
  assert.equal(reasonOfAnswer(200, 'not enough API calls'), FAILURE_REASONS.NO_API_CALLS);
  assert.equal(reasonOfAnswer(520, ''), FAILURE_REASONS.SERVER_ERROR);
  assert.equal(reasonOfAnswer(418, 'teapot'), FAILURE_REASONS.REJECTED);
  assert.equal(messageIdsOf('1:2,3:4'), '1:2,3:4');
  assert.equal(messageIdsOf(undefined), '');
});

test('the client: devices and groups, a timeout, the key never in an error', async () => {
  const fake = createFakePushsafer({
    devices: {
      65: { name: 'Pixel', platform: 'Android', status: '0' },
      52: { name: 'iPhone', platform: 'iOS', status: '1' },
    },
  });
  const api = createPushsaferClient({
    getCredentials: () => ({ privateKey: KEYS.private_key, username: KEYS.username }),
    transport: fake.transport,
  });
  await api.checkKey();
  assert.deepEqual(
    (await api.devices()).map((device) => [
      device.id,
      device.name,
      device.platform,
      device.enabled,
    ]),
    [
      ['52', 'iPhone', 'iOS', true],
      ['65', 'Pixel', 'Android', false],
    ],
  );
  assert.deepEqual(await api.groups(), [{ id: 'gs12', name: 'Family', devices: 2 }]);

  const slow = createPushsaferClient({
    getCredentials: () => ({ privateKey: 'SecretSecretSecret12' }),
    transport: async () => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    },
  });
  await assert.rejects(slow.send({ m: 'x', d: 'a' }), (err) => {
    assert.equal(err.reason, FAILURE_REASONS.TIMEOUT);
    assert.doesNotMatch(err.message, /SecretSecret/);
    return true;
  });

  const refused = createPushsaferClient({
    getCredentials: () => ({ privateKey: 'SecretSecretSecret12' }),
    transport: fake.transport,
  });
  await assert.rejects(refused.send({ m: 'x' }), (err) => {
    assert.equal(err.reason, FAILURE_REASONS.INVALID_KEY);
    assert.equal(err.status, 250);
    assert.doesNotMatch(err.message, /SecretSecret/);
    return true;
  });

  const none = createPushsaferClient({ getCredentials: () => ({ privateKey: '' }) });
  await assert.rejects(none.send({ m: 'x' }), { reason: FAILURE_REASONS.NOT_CONFIGURED });
});

test('the state file: counters of the month, API calls, recent pushes, a broken file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pushsafer-store-'));
  const path = join(dir, 'state.json');
  let clock = Date.parse('2026-11-30T10:00:00Z');
  const store = createStore({ path, now: () => clock, logger: silent });
  await store.load();
  await store.recordSent({ title: 'T', message: 'M', target: '52', apiCallsLeft: 42 });
  await store.recordFailed({ title: 'T', message: 'N', target: '52', reason: 'no_api_calls' });
  assert.deepEqual(store.counters(), { month: '2026-11', sent: 1, failed: 1 });
  assert.deepEqual(store.apiCalls(), { left: 0, at: clock }, 'no calls left is known');
  for (let i = 0; i < MAX_RECENT + 5; i += 1) {
    await store.recordSent({ title: 'T', message: `n${i}`, target: 'a', apiCallsLeft: null });
  }
  assert.equal(store.recent().length, MAX_RECENT);
  assert.equal(store.recent()[0].message, `n${MAX_RECENT + 4}`);
  await store.setLowApiCalls(true);
  await store.flush();

  clock = Date.parse('2026-12-01T00:00:01Z');
  const again = createStore({ path, now: () => clock, logger: silent });
  await again.load();
  assert.deepEqual(again.counters(), { month: '2026-12', sent: 0, failed: 0 });
  assert.equal(again.lowApiCalls(), true);
  assert.equal(again.apiCalls().left, 0);
  assert.equal(again.recent().length, MAX_RECENT);
  assert.ok(JSON.parse(await readFile(path, 'utf8')).recent.length <= MAX_RECENT);

  await writeFile(path, '{ broken');
  const broken = createStore({ path, now: () => clock, logger: silent });
  await broken.load();
  assert.deepEqual(broken.counters().sent, 0);
  assert.equal(broken.apiCalls(), null);
});
