// -----------------------------------------------------------------------------
// A fake Pushsafer API, as the transport of src/pushsafer-api.js. It answers
// the endpoints the integration uses the way the real service does (seen on
// 2026-11-21): JSON `{"status":1,…}` in HTTP 200 on success,
// `{"status":0,"error":"…"}` with Pushsafer's own HTTP statuses (250, 270,
// 280…) on failure. Nothing touches the network.
// -----------------------------------------------------------------------------

const KEYS = Object.freeze({ private_key: 'AbCdEfGhIjKlMnOpQrSt', username: 'jane@example.com' });

/**
 * @description A Pushsafer answer.
 * @param {number} status - HTTP status.
 * @param {any} body - JSON body (a string is sent as is).
 * @returns {{ status: number, text: string }} The answer.
 */
const answer = (status, body) => ({
  status,
  text: typeof body === 'string' ? body : JSON.stringify(body),
});

/**
 * @description Create the fake API.
 * @param {object} [options] - What it serves.
 * @param {object} [options.devices] - Id -> `{ name, platform, status }`.
 * @param {object} [options.groups] - Id -> `{ name, devices }`.
 * @param {number} [options.available] - API calls of the account.
 * @param {Array} [options.sends] - Forced answers of /api, one per call (then normal):
 *   `{ status, body }` or `{ throws: Error }`.
 * @returns {object} `{ transport, calls, pushes, state }`.
 * @example
 * const pushsafer = createFakePushsafer();
 * createApp(gladys, { transport: pushsafer.transport });
 */
function createFakePushsafer({
  devices = {
    52: { name: 'iPhone Jane', platform: 'iOS', status: '1' },
    65: { name: 'Pixel', platform: 'Android', status: '1' },
  },
  groups = { gs12: { name: 'Family', devices: '52|65' } },
  available = 1000,
  sends = [],
} = {}) {
  const calls = [];
  const state = { devices, groups, available, sends: [...sends], down: false, nextId: 9000 };

  /**
   * @description Answer one request.
   * @param {object} request - `{ url, form }`.
   * @returns {Promise<{ status: number, text: string }>} The answer.
   */
  async function transport({ url, form }) {
    const params = Object.fromEntries(new URLSearchParams(form.toString()));
    const path = new URL(url).pathname;
    calls.push({ path, params });
    if (state.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (path === '/api') {
      const forced = state.sends.shift();
      if (forced?.throws) {
        throw forced.throws;
      }
      if (forced) {
        return answer(forced.status, forced.body);
      }
      if (!params.k || !params.m) {
        return answer(400, { status: 0, error: 'empty message and or private key' });
      }
      if (params.k !== KEYS.private_key) {
        return answer(250, { status: 0, error: 'invalid key' });
      }
      const target = params.d ?? 'a';
      let ids;
      if (target === 'a') {
        ids = Object.keys(state.devices);
      } else if (/^gs/.test(target)) {
        if (!state.groups[target]) {
          return answer(275, { status: 0, error: 'invalid device group' });
        }
        ids = state.groups[target].devices.split('|');
      } else {
        ids = target.split('|');
        if (!ids.every((id) => state.devices[id])) {
          return answer(270, { status: 0, error: 'invalid device' });
        }
      }
      if (state.available < ids.length) {
        return answer(280, { status: 0, error: 'not enough api calls' });
      }
      state.available -= ids.length;
      const messageIds = ids.map((id) => `${(state.nextId += 1)}:${id}`).join(',');
      return answer(200, {
        status: 1,
        success: 'message transmitted',
        available: state.available,
        message_ids: messageIds,
      });
    }
    if (params.k !== KEYS.private_key || params.u !== KEYS.username) {
      return answer(250, { status: 0, error: 'invalid authentication' });
    }
    if (path === '/api-k') {
      return answer(200, { status: 1, success: 'key is valid' });
    }
    if (path === '/api-de') {
      return answer(200, {
        status: 1,
        devices: Object.fromEntries(
          Object.entries(state.devices).map(([id, device]) => [
            id,
            {
              id,
              name: device.name,
              status: device.status,
              sent: '3',
              platform: device.platform,
              isguest: '0',
              created: '2026-11-01 10:00:00',
              lastsync: '2026-11-21 08:00:00',
            },
          ]),
        ),
      });
    }
    if (path === '/api-g') {
      return answer(200, { status: 1, groups: state.groups });
    }
    return answer(404, 'not found');
  }

  return {
    transport,
    calls,
    state,
    /** @returns {object[]} The form fields of every push sent (accepted or not). */
    pushes: () => calls.filter((call) => call.path === '/api').map((call) => call.params),
  };
}

export { createFakePushsafer, KEYS };
