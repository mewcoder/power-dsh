// A bounded summary lets unopened sessions report the actual committed turn outcome.
const summarySchema = {
  parse(value) {
    if (!value || !Number.isSafeInteger(value.seq) || value.seq < -1
      || !Number.isSafeInteger(value.turn) || value.turn < 0 || typeof value.reason !== 'string') {
      throw new TypeError('Invalid power-dsh notification summary');
    }
    return { seq: value.seq, turn: value.turn, reason: value.reason };
  },
};

/** Read-only summary; it adds no tools, prompts, or session events. */
export function notificationProjection() {
  return {
    key: 'powerDshNotifications', stateVersion: 1,
    stateSchema: summarySchema,
    init: () => ({ seq: -1, turn: 0, reason: '' }),
    apply(state, event) {
      if (event.type !== 'turn/end') return state;
      return { seq: event.seq, turn: event.data.turn, reason: event.data.reason.kind };
    },
    wire: { viewSchema: summarySchema, view: state => state },
  };
}
