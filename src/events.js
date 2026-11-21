// -----------------------------------------------------------------------------
// Scene triggers of the Pushsafer integration.
//
//   push_not_sent    Gladys could not send a notification through Pushsafer.
//                    One event per TRANSITION, never one per failed message:
//                    the first failure fires, the following ones of the same
//                    scope stay silent until a push goes through again. The
//                    scope is the account (key, API calls, Pushsafer down…),
//                    or the target for a device or group Pushsafer refuses.
//                    This is what keeps a scene that answers the failure
//                    through this same channel from looping.
//   api_calls_low    the API calls left went below the threshold of the
//                    configuration; armed again once they are back above it.
//
// A scene ACTION never fires a trigger: its result goes to the scene.
// Event data is flat (scalars only) and holds the declared variables only.
// -----------------------------------------------------------------------------

import { FAILURE_REASONS } from './pushsafer-api.js';

const SCENE_TRIGGERS = Object.freeze({
  PUSH_NOT_SENT: 'push_not_sent',
  API_CALLS_LOW: 'api_calls_low',
});

const ACCOUNT_SCOPE = 'account';
const MAX_DATA_TEXT = 1000;

// The failures that belong to one target, not to the whole account.
const TARGET_REASONS = new Set([FAILURE_REASONS.INVALID_DEVICE, FAILURE_REASONS.INVALID_GROUP]);

/**
 * @description Track the failures and fire `push_not_sent` on the first one
 * of each scope.
 * @param {object} gladys - The GladysIntegration client.
 * @param {object} logger - Logger.
 * @returns {{ failed: Function, sent: Function }} The tracker.
 * @example
 * const failures = createFailureEvents(gladys, logger);
 * await failures.failed('52', err);
 * failures.sent('52');
 */
function createFailureEvents(gladys, logger) {
  const failing = new Set();

  return {
    /**
     * @description A notification was not sent: fire the trigger if its scope
     * was not already failing. Never throws.
     * @param {string} target - The target of the push (`d`), '' when unknown.
     * @param {object} err - A PushsaferError.
     * @returns {Promise<boolean>} True when the trigger fired.
     */
    async failed(target, err) {
      const reason = err.reason ?? FAILURE_REASONS.UNEXPECTED;
      const scope = TARGET_REASONS.has(reason) ? `target:${target}` : ACCOUNT_SCOPE;
      if (failing.has(scope)) {
        return false;
      }
      failing.add(scope);
      try {
        await gladys.publishSceneEvent(SCENE_TRIGGERS.PUSH_NOT_SENT, {
          reason,
          status: typeof err.status === 'number' ? err.status : null,
          error: String(err.message).slice(0, MAX_DATA_TEXT),
          device: String(target ?? '').slice(0, MAX_DATA_TEXT),
        });
        return true;
      } catch (eventErr) {
        logger.warn(`Could not fire ${SCENE_TRIGGERS.PUSH_NOT_SENT}: ${eventErr.message}`);
        return false;
      }
    },

    /**
     * @description A push went through: the account works again, and so does
     * this target.
     * @param {string} target - The target of the push.
     */
    sent(target) {
      failing.delete(ACCOUNT_SCOPE);
      failing.delete(`target:${target}`);
    },
  };
}

export { createFailureEvents, SCENE_TRIGGERS, TARGET_REASONS };
