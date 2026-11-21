// -----------------------------------------------------------------------------
// What the integration remembers across restarts, in /data/state.json (the
// only writable path of the container):
//
//   month, sent, failed      counters of the current month (the account
//                            widget), reset each month
//   apiCalls, apiCallsAt     the API calls left, as the last send answered
//                            them: Pushsafer has no endpoint to read them
//   lowApiCalls              the last state of the low API calls transition,
//                            so a restart does not fire `api_calls_low` again
//   recent                   the last pushes (sent or not), for the recent
//                            widget: title, start of the text, target
//
// A missing or broken file starts empty. Writes go through a temporary file
// and a rename, one after the other.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/state.json';
const MAX_RECENT = 20;
const MAX_RECENT_TEXT = 500;

/**
 * @description The month of an instant, 'YYYY-MM' (UTC).
 * @param {number} instant - The instant, in ms.
 * @returns {string} The month.
 * @example
 * monthOf(Date.UTC(2026, 10, 21)); // -> '2026-11'
 */
const monthOf = (instant) => new Date(instant).toISOString().slice(0, 7);

/**
 * @description A fresh state.
 * @param {number} now - Now, in ms.
 * @returns {object} The state.
 */
function emptyState(now) {
  return {
    version: 1,
    month: monthOf(now),
    sent: 0,
    failed: 0,
    apiCalls: null,
    apiCallsAt: null,
    lowApiCalls: null,
    recent: [],
  };
}

/**
 * @description Whether an entry of the recent list is well formed.
 * @param {any} entry - The entry.
 * @returns {boolean} True when kept.
 */
const validEntry = (entry) =>
  entry &&
  typeof entry.title === 'string' &&
  typeof entry.message === 'string' &&
  typeof entry.target === 'string' &&
  Number.isFinite(entry.at) &&
  typeof entry.ok === 'boolean';

/**
 * @description Keep the known fields of a state read from disk.
 * @param {object} data - The parsed file.
 * @param {number} now - Now, in ms.
 * @returns {object} The state.
 */
function sanitize(data, now) {
  const state = emptyState(now);
  if (typeof data?.month === 'string') {
    state.month = data.month;
  }
  ['sent', 'failed'].forEach((key) => {
    if (Number.isInteger(data?.[key]) && data[key] >= 0) {
      state[key] = data[key];
    }
  });
  if (Number.isFinite(data?.apiCalls) && Number.isFinite(data?.apiCallsAt)) {
    state.apiCalls = data.apiCalls;
    state.apiCallsAt = data.apiCallsAt;
  }
  if (typeof data?.lowApiCalls === 'boolean') {
    state.lowApiCalls = data.lowApiCalls;
  }
  if (Array.isArray(data?.recent)) {
    state.recent = data.recent.filter(validEntry).slice(0, MAX_RECENT);
  }
  return state;
}

/**
 * @description Create the store.
 * @param {object} options - Options.
 * @param {string} [options.path] - The JSON file.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} options.logger - Logger.
 * @returns {object} The store.
 * @example
 * const store = createStore({ logger });
 * await store.load();
 */
function createStore({ path = DEFAULT_PATH, now = () => Date.now(), logger }) {
  let state = emptyState(now());
  let saving = Promise.resolve();

  /**
   * @description A new month starts the counters again.
   */
  function rollMonth() {
    const month = monthOf(now());
    if (state.month !== month) {
      state.month = month;
      state.sent = 0;
      state.failed = 0;
    }
  }

  /**
   * @description Write the state (queued, never throws).
   * @returns {Promise<void>} Resolves once written (or failed).
   */
  function save() {
    const content = JSON.stringify(state);
    saving = saving.then(async () => {
      try {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, content);
        await rename(`${path}.tmp`, path);
      } catch (err) {
        logger.warn(`Unable to write ${path}: ${err.message}`);
      }
    });
    return saving;
  }

  /**
   * @description Put a push at the top of the recent list.
   * @param {object} push - `{ title, message, target, ok, reason? }`.
   */
  function remember(push) {
    state.recent = [
      {
        title: String(push.title ?? '').slice(0, 255),
        message: String(push.message ?? '').slice(0, MAX_RECENT_TEXT),
        target: String(push.target ?? '').slice(0, 100),
        at: now(),
        ok: push.ok,
        ...(push.reason ? { reason: push.reason } : {}),
      },
      ...state.recent,
    ].slice(0, MAX_RECENT);
  }

  return {
    /**
     * @description Read the file; a missing or broken file starts empty.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        state = sanitize(JSON.parse(await readFile(path, 'utf8')), now());
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Unable to read ${path}: ${err.message}`);
        }
        state = emptyState(now());
      }
      rollMonth();
    },

    /** @returns {{ month: string, sent: number, failed: number }} The counters. */
    counters() {
      rollMonth();
      return { month: state.month, sent: state.sent, failed: state.failed };
    },

    /** @returns {{ left: number, at: number }|null} The API calls left, when known. */
    apiCalls: () =>
      state.apiCalls === null ? null : { left: state.apiCalls, at: state.apiCallsAt },

    /**
     * @description A push went through.
     * @param {object} push - `{ title, message, target, apiCallsLeft }`.
     * @returns {Promise<void>}
     */
    recordSent(push) {
      rollMonth();
      state.sent += 1;
      if (Number.isFinite(push.apiCallsLeft)) {
        state.apiCalls = push.apiCallsLeft;
        state.apiCallsAt = now();
      }
      remember({ ...push, ok: true });
      return save();
    },

    /**
     * @description A push was not sent.
     * @param {object} push - `{ title, message, target, reason }`.
     * @returns {Promise<void>}
     */
    recordFailed(push) {
      rollMonth();
      state.failed += 1;
      if (push.reason === 'no_api_calls') {
        state.apiCalls = 0;
        state.apiCallsAt = now();
      }
      remember({ ...push, ok: false });
      return save();
    },

    /** @returns {boolean|null} The last low API calls state (null: never known). */
    lowApiCalls: () => state.lowApiCalls,

    /**
     * @description Remember the low API calls state.
     * @param {boolean|null} low - Below the threshold or not (null: compare again).
     * @returns {Promise<void>}
     */
    setLowApiCalls(low) {
      if (state.lowApiCalls === low) {
        return Promise.resolve();
      }
      state.lowApiCalls = low;
      return save();
    },

    /** @returns {object[]} The last pushes, newest first. */
    recent: () => [...state.recent],

    /** @returns {Promise<void>} Resolves when every write is done (tests, shutdown). */
    flush: () => saving,
  };
}

export { createStore, monthOf, DEFAULT_PATH, MAX_RECENT };
