// -----------------------------------------------------------------------------
// Configuration of the Pushsafer integration.
//
// Two levels, as the manifest declares them:
//   - `config_schema` (the administrator, once for the house): the private
//     key and the username of the Pushsafer account, the look of the
//     notifications (title, icon, sound, vibration, priority, time to live)
//     and the low API calls threshold;
//   - `contact_schema` (each user, in the "My account" block): the device or
//     the device group their notifications go to. Gladys hands it with every
//     message.
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'Gladys';
const DEFAULT_LOW_API_CALLS = 20;

// Bounds of the Pushsafer fields (https://www.pushsafer.com/en/pushapi_ext).
const LIMITS = Object.freeze({
  title: 255,
  message: 5000,
  icon: [1, 181],
  sound: [0, 62],
  vibration: [1, 3],
  priority: [-2, 2],
  timeToLive: [0, 43200],
  confirm: [10, 10800],
  url: 2000,
  urlTitle: 100,
});

/**
 * @description A trimmed string, '' for anything else.
 * @param {any} value - The raw value.
 * @returns {string} The string.
 */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @description An integer within bounds, or null when empty or out of them.
 * @param {any} value - The raw value ('' and null mean "not set").
 * @param {number[]} bounds - `[min, max]`.
 * @returns {number|null} The integer.
 * @example
 * boundedInteger('62', [0, 62]); // -> 62
 */
function boundedInteger(value, [min, max]) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return null;
  }
  return number;
}

/**
 * @description Normalize a target: `a` (all devices), a device id (`52`),
 * several device ids (`52|65`, commas and spaces accepted) or a group
 * (`gs23`).
 * @param {any} value - What the user typed.
 * @returns {string|null} The Pushsafer `d` value, or null when invalid.
 * @example
 * normalizeTarget(' 52, 65 '); // -> '52|65'
 */
function normalizeTarget(value) {
  const raw = text(String(value ?? '')).toLowerCase();
  if (raw === 'a' || raw === 'all') {
    return 'a';
  }
  if (/^gs\d{1,10}$/.test(raw)) {
    return raw;
  }
  const ids = raw
    .split(/[\s|,;]+/)
    .filter(Boolean)
    .filter((id, index, list) => list.indexOf(id) === index);
  if (ids.length === 0 || ids.length > 50 || !ids.every((id) => /^\d{1,10}$/.test(id))) {
    return null;
  }
  return ids.join('|');
}

/**
 * @description Normalize the integration configuration.
 * @param {object} [raw] - The raw values (gladys.config).
 * @returns {object} The configuration used by the integration.
 * @example
 * normalizeConfig({ private_key: 'XXXXXXXXXXXXXXXXXXXX', username: 'jane@example.com' });
 */
function normalizeConfig(raw = {}) {
  const threshold = Number(raw.low_api_calls_threshold);
  return {
    privateKey: text(raw.private_key),
    username: text(raw.username),
    title: text(raw.title).slice(0, LIMITS.title) || DEFAULT_TITLE,
    icon: boundedInteger(raw.icon, LIMITS.icon),
    sound: boundedInteger(raw.sound, LIMITS.sound),
    vibration: boundedInteger(raw.vibration, LIMITS.vibration),
    priority: boundedInteger(raw.priority, LIMITS.priority) ?? 0,
    timeToLive: boundedInteger(raw.time_to_live, LIMITS.timeToLive) ?? 0,
    lowApiCallsThreshold:
      raw.low_api_calls_threshold === undefined ||
      raw.low_api_calls_threshold === null ||
      raw.low_api_calls_threshold === '' ||
      !Number.isFinite(threshold)
        ? DEFAULT_LOW_API_CALLS
        : Math.max(0, Math.round(threshold)),
  };
}

/**
 * @description Whether the private key is set (enough to send).
 * @param {object} config - normalizeConfig.
 * @returns {boolean} True when the integration can send.
 */
const hasKey = (config) => Boolean(config.privateKey);

/**
 * @description Whether the key and the username are set (needed to read the
 * account: check the key, list the devices).
 * @param {object} config - normalizeConfig.
 * @returns {boolean} True when the account can be read.
 */
const hasAccount = (config) => Boolean(config.privateKey && config.username);

/**
 * @description The target of a user, from the values of their "My account"
 * block.
 * @param {object} [contact] - The contact_schema values.
 * @returns {string|null} The Pushsafer `d` value, or null.
 * @example
 * contactTarget({ device: 'gs12' }); // -> 'gs12'
 */
function contactTarget(contact = {}) {
  return normalizeTarget(contact?.device);
}

/**
 * @description The fields of a push with the defaults of the configuration.
 * @param {object} config - normalizeConfig.
 * @param {object} push - `{ target, message, title?, priority?, sound?, icon?,
 *   iconColor?, url?, urlTitle?, timeToLive?, confirm?, picture? }`.
 * @returns {object} The Pushsafer form fields.
 * @example
 * pushFields(config, { target: 'a', message: 'Hello' });
 */
function pushFields(config, push) {
  const pick = (value, fallback) => (value === null || value === undefined ? fallback : value);
  const color = text(push.iconColor);
  const url = text(push.url).slice(0, LIMITS.url);
  return {
    d: push.target,
    m: String(push.message ?? '').slice(0, LIMITS.message),
    t: (text(push.title) || config.title).slice(0, LIMITS.title),
    i: pick(push.icon, config.icon),
    s: pick(push.sound, config.sound),
    v: config.vibration,
    pr: pick(push.priority, config.priority),
    l: pick(push.timeToLive, config.timeToLive) || null,
    c: /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null,
    u: url || null,
    ut: url ? text(push.urlTitle).slice(0, LIMITS.urlTitle) || null : null,
    cr: push.confirm ?? null,
    p: push.picture ?? null,
  };
}

export {
  normalizeConfig,
  normalizeTarget,
  boundedInteger,
  hasKey,
  hasAccount,
  contactTarget,
  pushFields,
  LIMITS,
  DEFAULT_TITLE,
  DEFAULT_LOW_API_CALLS,
};
