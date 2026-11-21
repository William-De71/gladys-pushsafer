// -----------------------------------------------------------------------------
// Client of the Pushsafer API (https://www.pushsafer.com/en/pushapi).
//
//   POST /api      send a push           k, m (+ d, t, s, v, i, c, u, ut, p,
//                                         is, l, pr, re, ex, cr, a, ao, af)
//   POST /api-k    check the key          k, u (username or e-mail)
//   POST /api-de   the devices (extended) k, u
//   POST /api-g    the device groups      k, u
//
// Every call is a form POST (application/x-www-form-urlencoded) over HTTPS.
// Pushsafer answers JSON, `{"status":1,…}` on success and
// `{"status":0,"error":"…"}` on failure, with non standard HTTP statuses for
// its own errors (seen on the real service on 2026-11-21: 250 "invalid key"
// for a wrong key on /api, 250 "invalid authentication" on /api-k, /api-de
// and /api-g, 400 "empty message and or private key"); the documentation
// lists 255, 260, 270, 275 and 280 too. A send answers the API calls left
// (`available`) and the ids of the messages (`message_ids`, "id:device,…").
//
// The private key never appears in an error message nor a log line.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.pushsafer.com';
const TIMEOUT_MS = 15 * 1000;

// Why a call failed, as the `reason` of a PushsaferError, of the
// `push_not_sent` scene trigger and of the widgets. Scenes store these
// values: never rename one.
const FAILURE_REASONS = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  INVALID_KEY: 'invalid_key',
  INVALID_DEVICE: 'invalid_device',
  INVALID_GROUP: 'invalid_group',
  NO_API_CALLS: 'no_api_calls',
  EMPTY_MESSAGE: 'empty_message',
  REJECTED: 'rejected',
  SERVER_ERROR: 'server_error',
  TIMEOUT: 'timeout',
  UNREACHABLE: 'unreachable',
  UNEXPECTED: 'unexpected',
});

// Pushsafer status codes of the documentation, and the reason of each.
const REASON_OF_CODE = {
  250: FAILURE_REASONS.INVALID_KEY,
  255: FAILURE_REASONS.INVALID_KEY,
  260: FAILURE_REASONS.EMPTY_MESSAGE,
  270: FAILURE_REASONS.INVALID_DEVICE,
  275: FAILURE_REASONS.INVALID_GROUP,
  280: FAILURE_REASONS.NO_API_CALLS,
};

// A send is retried once, after this pause, when no answer of Pushsafer came
// back (network error) or when Cloudflare in front of it answered a 5xx
// (a 520 was seen on 2026-11-21). A push may then rarely arrive twice: better
// than a lost alarm.
const RETRY_DELAY_MS = 3 * 1000;

/**
 * @description A failed Pushsafer call, with the reason.
 */
class PushsaferError extends Error {
  /**
   * @param {string} message - Readable message, in English, without the key.
   * @param {object} details - Details.
   * @param {string} details.reason - One of FAILURE_REASONS.
   * @param {number|null} [details.status] - HTTP status, when Pushsafer answered.
   * @param {Error} [details.cause] - Underlying error.
   */
  constructor(message, { reason, status = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PushsaferError';
    this.reason = reason;
    this.status = status;
  }
}

/**
 * @description Wrap any failure into a PushsaferError.
 * @param {Error} err - The failure.
 * @returns {PushsaferError} The PushsaferError.
 * @example
 * toPushsaferError(new Error('boom')).reason; // -> 'unexpected'
 */
function toPushsaferError(err) {
  if (err instanceof PushsaferError) {
    return err;
  }
  return new PushsaferError(String(err?.message ?? err), {
    reason: FAILURE_REASONS.UNEXPECTED,
    cause: err,
  });
}

/**
 * @description The reason of a Pushsafer answer that is not a success.
 * @param {number} status - HTTP status.
 * @param {string} error - The `error` text of the body.
 * @returns {string} One of FAILURE_REASONS.
 * @example
 * reasonOfAnswer(250, 'invalid key'); // -> 'invalid_key'
 */
function reasonOfAnswer(status, error) {
  if (REASON_OF_CODE[status]) {
    return REASON_OF_CODE[status];
  }
  const text = String(error ?? '').toLowerCase();
  if (/api.?calls/.test(text)) {
    return FAILURE_REASONS.NO_API_CALLS;
  }
  if (/device ?group/.test(text)) {
    return FAILURE_REASONS.INVALID_GROUP;
  }
  if (/device/.test(text)) {
    return FAILURE_REASONS.INVALID_DEVICE;
  }
  if (/key|authenti/.test(text)) {
    return FAILURE_REASONS.INVALID_KEY;
  }
  if (/empty message/.test(text)) {
    return FAILURE_REASONS.EMPTY_MESSAGE;
  }
  if (status >= 500) {
    return FAILURE_REASONS.SERVER_ERROR;
  }
  return status >= 400 || status === 200 ? FAILURE_REASONS.REJECTED : FAILURE_REASONS.UNEXPECTED;
}

/**
 * @description The default transport: a form POST with a timeout.
 * @param {object} request - `{ url, form }` (form: URLSearchParams).
 * @returns {Promise<{ status: number, text: string }>} The answer.
 */
async function fetchTransport({ url, form }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      'user-agent': 'gladys-pushsafer',
    },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: response.status, text: await response.text() };
}

/**
 * @description Parse the ids of a send: "1324312:118,1324313:324".
 * @param {any} value - The `message_ids` of the answer.
 * @returns {string} The ids, comma separated, '' when absent.
 * @example
 * messageIdsOf('1324312:118,1324313:324'); // -> '1324312:118,1324313:324'
 */
function messageIdsOf(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  return '';
}

/**
 * @description Create the client.
 * @param {object} options - Options.
 * @param {Function} options.getCredentials - `() => ({ privateKey, username })`.
 * @param {Function} [options.transport] - `({ url, form }) => Promise<{ status, text }>`.
 * @param {Function} [options.wait] - `(ms) => Promise`, the pause before a retry.
 * @param {number} [options.retryDelayMs] - The pause before a retry.
 * @returns {object} The client.
 * @example
 * const api = createPushsaferClient({ getCredentials: () => config });
 * await api.send({ m: 'Hello', d: 'a' });
 */
function createPushsaferClient({
  getCredentials,
  transport = fetchTransport,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  retryDelayMs = RETRY_DELAY_MS,
}) {
  /**
   * @description One call, its answer parsed.
   * @param {string} path - '/api', '/api-k'…
   * @param {object} params - The form fields (empty values are dropped).
   * @returns {Promise<object>} The JSON body of a success.
   */
  async function call(path, params) {
    const { privateKey } = getCredentials();
    if (!privateKey) {
      throw new PushsaferError('The Pushsafer private key is missing in the configuration', {
        reason: FAILURE_REASONS.NOT_CONFIGURED,
      });
    }
    const form = new URLSearchParams();
    form.set('k', privateKey);
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        form.set(name, String(value));
      }
    });

    let answer;
    try {
      answer = await transport({ url: `${BASE_URL}${path}`, form });
    } catch (err) {
      const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new PushsaferError(
        timeout
          ? `Pushsafer did not answer within ${TIMEOUT_MS / 1000} s`
          : `Pushsafer is unreachable (${err?.cause?.code ?? err?.code ?? err?.message})`,
        { reason: timeout ? FAILURE_REASONS.TIMEOUT : FAILURE_REASONS.UNREACHABLE, cause: err },
      );
    }

    let body;
    try {
      body = JSON.parse(answer.text);
    } catch {
      body = null;
    }
    if (answer.status === 200 && body && Number(body.status) === 1) {
      return body;
    }
    const error = typeof body?.error === 'string' ? body.error : '';
    const reason = reasonOfAnswer(answer.status, error);
    throw new PushsaferError(
      `Pushsafer refused the call to ${path} (HTTP ${answer.status}${error ? `: ${error.slice(0, 200)}` : ''})`,
      { reason, status: answer.status },
    );
  }

  /**
   * @description Whether a failed send may be tried again.
   * @param {PushsaferError} err - The failure.
   * @returns {boolean} True for no answer or a 5xx.
   */
  const retryable = (err) =>
    err.reason === FAILURE_REASONS.UNREACHABLE ||
    (err.reason === FAILURE_REASONS.SERVER_ERROR && err.status >= 500);

  return {
    /**
     * @description Send a push.
     * @param {object} params - The Pushsafer fields (m, d, t, s, v, i, c, u, ut, p, is, l, pr, cr…).
     * @returns {Promise<{ apiCallsLeft: number|null, messageIds: string }>} The report.
     */
    async send(params) {
      let body;
      try {
        body = await call('/api', params);
      } catch (err) {
        if (!(err instanceof PushsaferError) || !retryable(err)) {
          throw err;
        }
        await wait(retryDelayMs);
        body = await call('/api', params);
      }
      const available = Number(body.available);
      return {
        apiCallsLeft: Number.isFinite(available) ? available : null,
        messageIds: messageIdsOf(body.message_ids),
      };
    },

    /**
     * @description Check the private key with the username of the account.
     * @returns {Promise<void>} Resolves when Pushsafer accepts them.
     */
    async checkKey() {
      await call('/api-k', { u: getCredentials().username });
    },

    /**
     * @description The devices of the account.
     * @returns {Promise<object[]>} `{ id, name, platform, enabled, guest, lastSync }`, by name.
     */
    async devices() {
      const body = await call('/api-de', { u: getCredentials().username });
      const devices = body.devices && typeof body.devices === 'object' ? body.devices : {};
      return Object.entries(devices)
        .map(([key, device]) => ({
          id: String(device?.id ?? key),
          name: String(device?.name ?? key).slice(0, 100),
          platform: typeof device?.platform === 'string' ? device.platform.slice(0, 30) : '',
          // "status" is the switch of the device in the dashboard (1 / 0).
          enabled: String(device?.status ?? '1') !== '0',
          guest: String(device?.isguest ?? '0') === '1',
          lastSync: typeof device?.lastsync === 'string' ? device.lastsync : '',
        }))
        .filter((device) => /^\d+$/.test(device.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * @description The device groups of the account.
     * @returns {Promise<object[]>} `{ id, name, devices }` (devices: count), by name.
     */
    async groups() {
      const body = await call('/api-g', { u: getCredentials().username });
      const groups = body.groups && typeof body.groups === 'object' ? body.groups : {};
      return Object.entries(groups)
        .map(([id, group]) => ({
          id,
          name: String(group?.name ?? id).slice(0, 100),
          devices: String(group?.devices ?? '')
            .split('|')
            .filter(Boolean).length,
        }))
        .filter((group) => /^gs\d+$/.test(group.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

export {
  createPushsaferClient,
  PushsaferError,
  toPushsaferError,
  reasonOfAnswer,
  messageIdsOf,
  FAILURE_REASONS,
  BASE_URL,
  RETRY_DELAY_MS,
};
