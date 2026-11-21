// -----------------------------------------------------------------------------
// Every handler of the Pushsafer integration, registered on the Gladys client
// it receives: index.js passes the real one, the tests the fake Gladys of the
// SDK (`@gladysassistant/integration-sdk/testing`).
//
// A COMMUNICATION integration of the SEND-ONLY family (`messaging: { receive:
// false }`): Gladys notifications go out as Pushsafer pushes.
//   - The private key and the username of the Pushsafer account, and the look
//     of the notifications, are set once by the administrator
//     (`config_schema`); each user enters the device or the device group
//     their notifications go to (`contact_schema`, "My account" block), which
//     Gladys hands with every message to `onSendMessage`.
//   - Scene triggers push_not_sent / api_calls_low, scene action send_push,
//     widgets account / recent, Configuration screen buttons
//     test_connection / send_test_push.
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  normalizeTarget,
  boundedInteger,
  hasKey,
  hasAccount,
  contactTarget,
  pushFields,
  LIMITS,
} from './config.js';
import {
  createPushsaferClient,
  PushsaferError,
  FAILURE_REASONS,
  toPushsaferError,
} from './pushsafer-api.js';
import { pictureOf } from './picture.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { createFailureEvents, SCENE_TRIGGERS } from './events.js';
import { buildAccountWidget, buildRecentWidget, WIDGETS, clip } from './widgets.js';
import { t, all, formatNumber } from './i18n.js';

const ACTIONS = Object.freeze({ TEST_CONNECTION: 'test_connection', SEND_TEST: 'send_test_push' });
const SCENE_ACTIONS = Object.freeze({ SEND_PUSH: 'send_push' });

// The key and the devices are read again every 30 minutes: a revoked key or a
// new device shows in the status and the widgets. These calls cost no API
// call of the account (only pushes do).
const ACCOUNT_INTERVAL_MS = 30 * 60 * 1000;

const TEST_MESSAGE = 'Gladys Assistant: Pushsafer test OK';

// Status message of each failure reason (the others: status_error).
const STATUS_OF_REASON = {
  [FAILURE_REASONS.NOT_CONFIGURED]: 'status_not_configured',
  [FAILURE_REASONS.INVALID_KEY]: 'status_invalid_key',
  [FAILURE_REASONS.UNREACHABLE]: 'status_unreachable',
  [FAILURE_REASONS.TIMEOUT]: 'status_unreachable',
  [FAILURE_REASONS.SERVER_ERROR]: 'status_unreachable',
};

/**
 * @description Register the handlers of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options (tests).
 * @param {Function} [options.transport] - HTTP transport of the Pushsafer client.
 * @param {string} [options.statePath] - The state file.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {Function} [options.wait] - `(ms) => Promise`, the pause before a retry.
 * @param {boolean} [options.timers] - Start the periodic reading (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    transport,
    statePath = DEFAULT_PATH,
    now = () => Date.now(),
    wait,
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // What the account widget shows: the devices and groups of the last reading.
  let account = null;
  let readAt = null;
  let readFailure = null;
  let lastFailure = null;
  let lastStatus = null;
  let accountTimer = null;

  const api = createPushsaferClient({
    getCredentials: () => config,
    ...(transport ? { transport } : {}),
    ...(wait ? { wait } : {}),
  });
  const store = createStore({ path: statePath, now, logger });
  const failures = createFailureEvents(gladys, logger);

  /**
   * @description Ask the dashboards to fetch the widgets again (fire and forget).
   * @param {string[]} [keys] - The widgets.
   */
  function refreshWidgets(keys = Object.values(WIDGETS)) {
    keys.forEach((key) => {
      Promise.resolve()
        .then(() => gladys.requestWidgetRefresh(key))
        .catch((err) => logger.debug?.(`Widget refresh of ${key} failed: ${err.message}`));
    });
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The API calls left as a text of a language ("?" when unknown).
   * @param {string} language - The language.
   * @returns {string} The text.
   */
  const callsText = (language) => {
    const calls = store.apiCalls();
    return calls ? formatNumber(calls.left, language, 0) : t('apiCallsUnknown', language);
  };

  /**
   * @description The name of a target, from the devices and groups read.
   * @param {string} target - The Pushsafer `d` value.
   * @returns {string} "iPhone (52)", "Group: Family (gs12)", or the target.
   */
  function targetName(target) {
    if (!account || !target || target === 'a') {
      return target;
    }
    const names = target.split('|').map((id) => {
      const known = [...account.devices, ...account.groups].find((entry) => entry.id === id);
      return known ? `${known.name} (${id})` : id;
    });
    return names.join(', ');
  }

  /**
   * @description Compare the API calls left with the threshold; fire
   * `api_calls_low` when they go below it.
   * @param {number|null} left - API calls left.
   * @param {object} [options] - Options.
   * @param {boolean} [options.fire] - Whether a scene trigger may fire (never for a scene action).
   * @returns {Promise<void>}
   */
  async function checkApiCalls(left, { fire = true } = {}) {
    if (typeof left !== 'number' || !fire) {
      return;
    }
    const low = left < config.lowApiCallsThreshold;
    if (low === store.lowApiCalls()) {
      return;
    }
    await store.setLowApiCalls(low);
    if (!low) {
      return;
    }
    logger.warn(
      `${left} Pushsafer API calls left, below the threshold of ${config.lowApiCallsThreshold}`,
    );
    try {
      await gladys.publishSceneEvent(SCENE_TRIGGERS.API_CALLS_LOW, {
        api_calls_left: left,
        threshold: config.lowApiCallsThreshold,
      });
    } catch (err) {
      logger.warn(`Could not fire ${SCENE_TRIGGERS.API_CALLS_LOW}: ${err.message}`);
    }
  }

  /**
   * @description Check the key, read the devices and groups, report the status.
   * @returns {Promise<object|null>} The account `{ devices, groups }`, null when not read.
   */
  async function refreshAccount() {
    try {
      if (!hasKey(config)) {
        readFailure = FAILURE_REASONS.NOT_CONFIGURED;
        account = null;
        await reportStatus(false, all('noKey'));
        return null;
      }
      if (!hasAccount(config)) {
        // The key alone is enough to send: only the reading of the account
        // needs the username.
        readFailure = null;
        account = null;
        await reportStatus(true, all('statusKeyOnly', { calls: callsText }));
        return null;
      }
      await api.checkKey();
      const [devices, groups] = await Promise.all([api.devices(), api.groups()]);
      account = { devices, groups };
      readAt = now();
      readFailure = null;
      await reportStatus(
        true,
        all('statusConnected', {
          username: clip(config.username, 50),
          devices: devices.length,
          groups: groups.length,
          calls: callsText,
        }),
      );
      return account;
    } catch (err) {
      const failure = toPushsaferError(err);
      readFailure = failure.reason;
      logger.warn(`Unable to read the Pushsafer account (${failure.reason}): ${failure.message}`);
      await reportStatus(false, all(STATUS_OF_REASON[failure.reason] ?? 'status_error'));
      return null;
    } finally {
      refreshWidgets([WIDGETS.ACCOUNT]);
    }
  }

  /**
   * @description Send a push and remember it.
   * @param {object} push - See config.js `pushFields`.
   * @param {object} options - Options.
   * @param {boolean} options.fire - Whether api_calls_low may fire.
   * @returns {Promise<{ apiCallsLeft: number|null, messageIds: string }>} The report.
   */
  async function deliver(push, { fire }) {
    const fields = pushFields(config, push);
    const remembered = { title: fields.t, message: fields.m, target: fields.d };
    try {
      if (!fields.d) {
        throw new PushsaferError('No valid device or device group (use a, 52, 52|65 or gs12)', {
          reason: FAILURE_REASONS.INVALID_DEVICE,
        });
      }
      if (!fields.m.trim()) {
        throw new PushsaferError('The message is empty', {
          reason: FAILURE_REASONS.EMPTY_MESSAGE,
        });
      }
      const report = await api.send(fields);
      await store.recordSent({ ...remembered, apiCallsLeft: report.apiCallsLeft });
      await checkApiCalls(report.apiCallsLeft, { fire });
      return report;
    } catch (err) {
      const failure = toPushsaferError(err);
      lastFailure = { reason: failure.reason, at: now() };
      await store.recordFailed({ ...remembered, reason: failure.reason });
      throw failure;
    } finally {
      refreshWidgets();
    }
  }

  // --- Outgoing message: Gladys asks us to deliver a notification --------------------
  // A scene "send a message", an alert or a notification routed to a user ends
  // up here, for the users who entered a device. `message` is `{ text, file }`:
  // an attached image (a camera snapshot) goes in the push.
  gladys.onSendMessage(async (contact, message) => {
    const target = contactTarget(contact) ?? '';
    const picture = pictureOf(message?.file);
    if (picture.reason) {
      logger.warn(`The attached file is not sent (${picture.reason})`);
    }
    try {
      logger.info(
        `onSendMessage -> push to ${target || '(no device)'}${picture.dataUrl ? ' with an image' : ''}`,
      );
      await deliver(
        { target, message: message?.text ?? '', picture: picture.dataUrl },
        { fire: true },
      );
      failures.sent(target);
    } catch (err) {
      const failure = toPushsaferError(err);
      logger.warn(
        `Push to ${target || '(no device)'} not sent (${failure.reason}): ${failure.message}`,
      );
      await failures.failed(target, failure);
      throw failure;
    }
  });

  // --- Scene actions -------------------------------------------------------------------
  // Their result goes to the scene; they never fire a scene trigger.
  gladys.onSceneAction(SCENE_ACTIONS.SEND_PUSH, async (fields = {}) => {
    const target = normalizeTarget(fields.device);
    if (!target) {
      throw new Error('The device is not valid: use a (all), 52, 52|65 or gs12 (a group)');
    }
    const report = await deliver(
      {
        target,
        message: String(fields.message ?? ''),
        title: fields.title,
        priority: boundedInteger(fields.priority, LIMITS.priority),
        sound: boundedInteger(fields.sound, LIMITS.sound),
        icon: boundedInteger(fields.icon, LIMITS.icon),
        iconColor: fields.icon_color,
        url: fields.url,
        timeToLive: boundedInteger(fields.time_to_live, LIMITS.timeToLive),
        confirm: boundedInteger(fields.confirm_seconds, LIMITS.confirm),
      },
      { fire: false },
    );
    return {
      message_ids: report.messageIds.slice(0, 1000),
      api_calls_left: report.apiCallsLeft ?? store.apiCalls()?.left ?? 0,
    };
  });

  // --- Configuration screen buttons ----------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!hasKey(config)) {
      return all('noKey');
    }
    if (!hasAccount(config)) {
      return all('noUsername');
    }
    const read = await refreshAccount();
    if (!read) {
      return all(STATUS_OF_REASON[readFailure] ?? 'status_error');
    }
    return all('testOk', {
      // The message stays under 200 characters: long lists are cut.
      devices: (language) =>
        read.devices.length > 0
          ? clip(read.devices.map((device) => `${device.name} (${device.id})`).join(', '), 60)
          : t('devicesNone', language),
      groups: (language) =>
        read.groups.length > 0
          ? clip(read.groups.map((group) => `${group.name} (${group.id})`).join(', '), 40)
          : t('groupsNone', language),
      calls: callsText,
    });
  });

  gladys.onAction(ACTIONS.SEND_TEST, async (fields = {}) => {
    const typed = String(fields.device ?? '').trim();
    const target = normalizeTarget(typed || 'a');
    if (!target) {
      return all('invalidTarget', { device: clip(typed, 30) });
    }
    if (!hasKey(config)) {
      return all('noKey');
    }
    try {
      const report = await deliver({ target, message: TEST_MESSAGE }, { fire: false });
      return all('testSent', {
        device: clip(targetName(target), 60),
        calls: (language) =>
          typeof report.apiCallsLeft === 'number'
            ? formatNumber(report.apiCallsLeft, language, 0)
            : t('apiCallsUnknown', language),
      });
    } catch (err) {
      const failure = toPushsaferError(err);
      return all('testNotSent', {
        reason: (language) => t(`reason_${failure.reason}`, language),
      });
    }
  });

  // --- Dashboard widgets -----------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.ACCOUNT, async ({ language } = {}) =>
    buildAccountWidget({
      snapshot: {
        configured: hasKey(config),
        username: config.username,
        account,
        readAt,
        readFailure,
        apiCalls: store.apiCalls(),
        lastFailure,
        counters: store.counters(),
        threshold: config.lowApiCallsThreshold,
      },
      language,
      now: now(),
    }),
  );

  gladys.onWidgetGet(WIDGETS.RECENT, async ({ language } = {}) =>
    buildRecentWidget({
      pushes: store.recent().map((push) => ({ ...push, targetName: targetName(push.target) })),
      counters: store.counters(),
      language,
    }),
  );

  // --- Configuration ---------------------------------------------------------------------

  /**
   * @description Read the configuration again.
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      config = normalizeConfig(await gladys.getConfig());
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  /** @description (Re)start the periodic reading of the account. */
  function schedule() {
    clearInterval(accountTimer);
    accountTimer = null;
    if (!timers) {
      return;
    }
    accountTimer = setInterval(() => {
      refreshAccount().catch((err) => logger.error('Account reading failed', err));
    }, ACCOUNT_INTERVAL_MS);
    accountTimer.unref?.();
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previousThreshold = config.lowApiCallsThreshold;
    const previousKey = config.privateKey;
    await loadConfig(rawConfig);
    lastStatus = null;
    if (config.lowApiCallsThreshold !== previousThreshold || config.privateKey !== previousKey) {
      // A new threshold or account: the next send compares again from scratch.
      await store.setLowApiCalls(null);
    }
    logger.info('Configuration updated');
    await refreshAccount();
    schedule();
    refreshWidgets();
  });

  // --- Connection lifecycle --------------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await store.load();
    lastStatus = null;
    await refreshAccount();
    schedule();
  });

  // --- Graceful shutdown -----------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    clearInterval(accountTimer);
    await store.flush();
  });

  return {
    getConfig: () => config,
    store,
    refreshAccount,
    schedule,
  };
}

export { createApp, ACTIONS, SCENE_ACTIONS, TEST_MESSAGE };
