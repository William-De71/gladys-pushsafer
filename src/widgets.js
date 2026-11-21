// -----------------------------------------------------------------------------
// Dashboard widgets of the Pushsafer integration.
//
//   - `account`  the Pushsafer account at a glance: API calls left (colored
//                against the low API calls threshold), the state of the key,
//                the devices and groups, the pushes sent this month, the
//                threshold and the last failure;
//   - `recent`   the last pushes of Gladys, sent or not, newest first; a tap
//                opens the whole text.
//
// The contents come from what the integration already knows (the last
// reading of the account, /data/state.json): a widget never calls Pushsafer.
// Every text exists in the four languages (contents are cached per
// language). Budget of a card: 8 components, 1 main one (card-list), 6 tiles,
// 2 texts of which one body, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, ago, formatNumber } from './i18n.js';

const WIDGETS = Object.freeze({ ACCOUNT: 'account', RECENT: 'recent' });
const MAX_RECENT_ITEMS = 8;
const TTL = { account: 300, recent: 60, message: 30 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long title', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of the API calls tile.
 * @param {number|null} left - API calls left.
 * @param {number} threshold - Low API calls threshold.
 * @returns {string} The color.
 */
function callsColor(left, threshold) {
  if (typeof left !== 'number') {
    return 'neutral';
  }
  if (left < threshold || left <= 0) {
    return 'danger';
  }
  return left < threshold * 2 ? 'warning' : 'success';
}

/**
 * @description The `account` widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - What the integration knows (app.js).
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 * @example
 * buildAccountWidget({ snapshot, language: 'fr', now: Date.now() });
 */
function buildAccountWidget({ snapshot, language, now }) {
  const {
    configured,
    username,
    account,
    readAt,
    readFailure,
    apiCalls,
    lastFailure,
    counters,
    threshold,
  } = snapshot;
  if (!configured) {
    return messageContent(t('noKey', language));
  }

  const components = [];
  components.push({
    type: 'text',
    variant: 'caption',
    text: clip(
      account && username
        ? t('accountCaption', language, { username, ago: ago(readAt, now, language) })
        : t('accountCaptionKeyOnly', language),
      80,
    ),
  });
  components.push({
    type: 'value',
    value: apiCalls ? apiCalls.left : '?',
    label: clip(t('tileApiCalls', language), 24),
    icon: 'send',
    color: callsColor(apiCalls?.left ?? null, threshold),
  });
  components.push({
    type: 'value',
    value: counters.sent,
    label: clip(t('tileSent', language), 24),
    icon: 'bell',
    color: 'primary',
  });
  if (apiCalls && apiCalls.left < threshold) {
    components.push({ type: 'text', variant: 'body', text: t('apiCallsLowText', language) });
  }

  const rows = [
    {
      label: t('rowConnection', language),
      value: clip(
        readFailure ? t(`reason_${readFailure}`, language) : t('connectionOk', language),
        40,
      ),
      color: readFailure ? 'danger' : 'success',
    },
  ];
  if (account) {
    const enabled = account.devices.filter((device) => device.enabled).length;
    rows.push({
      label: t('rowDevices', language),
      value: clip(
        t('devicesValue', language, {
          enabled,
          total: account.devices.length,
          groups: account.groups.length,
        }),
        40,
      ),
      color: enabled > 0 ? 'info' : 'warning',
    });
  } else if (!username) {
    rows.push({
      label: t('rowDevices', language),
      value: clip(t('devicesNoUsername', language), 40),
      color: 'neutral',
    });
  }
  rows.push({
    label: t('rowApiCallsAt', language),
    value: clip(apiCalls ? ago(apiCalls.at, now, language) : t('apiCallsUnknown', language), 40),
    color: 'neutral',
  });
  rows.push({
    label: t('rowThreshold', language),
    value: t('thresholdValue', language, { threshold: formatNumber(threshold, language, 0) }),
    color: 'neutral',
  });
  if (counters.failed > 0) {
    rows.push({ label: t('rowFailed', language), value: counters.failed, color: 'warning' });
  }
  if (lastFailure) {
    rows.push({
      label: clip(t('rowLastFailure', language, { ago: ago(lastFailure.at, now, language) }), 40),
      value: clip(t(`reason_${lastFailure.reason}`, language), 40),
      color: 'warning',
    });
  }
  components.push({ type: 'status', items: rows });

  return { ttl_seconds: TTL.account, components };
}

/**
 * @description The `recent` widget.
 * @param {object} options - Options.
 * @param {object[]} options.pushes - The last pushes, newest first, with `targetName`.
 * @param {object} options.counters - The counters of the month.
 * @param {string} options.language - The user language.
 * @returns {object} The content.
 * @example
 * buildRecentWidget({ pushes, counters, language: 'en' });
 */
function buildRecentWidget({ pushes, counters, language }) {
  if (pushes.length === 0) {
    return messageContent(t('recentEmpty', language), TTL.recent);
  }
  return {
    ttl_seconds: TTL.recent,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(
          t('recentCaption', language, { sent: counters.sent, failed: counters.failed }),
          80,
        ),
      },
      {
        type: 'card-list',
        display: 'list',
        // In a list, the date takes the place of the subtitle: the outcome
        // goes in the badge, the text in the title and the detail panel.
        items: pushes.slice(0, MAX_RECENT_ITEMS).map((push) => ({
          title: clip(push.message || push.title || '…', 60),
          date: new Date(push.at).toISOString(),
          badge: push.ok
            ? { text: clip(t('badgeSent', language), 16), color: 'success' }
            : { text: clip(t('badgeNotSent', language), 16), color: 'danger' },
          description: [
            push.title,
            push.message,
            `${t('detailDevice', language)} ${push.targetName || push.target || '?'}`,
            push.ok ? '' : `${t('detailReason', language)} ${t(`reason_${push.reason}`, language)}`,
          ]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 2000),
        })),
      },
    ],
  };
}

export { buildAccountWidget, buildRecentWidget, WIDGETS, callsColor, clip };
