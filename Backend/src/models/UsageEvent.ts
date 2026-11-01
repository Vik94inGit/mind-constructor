import mongoose from "mongoose";

// One thing a signed-in user did in the app (opened it, added a quick note,
// finished a Think it through...), kept so the admin page can show how the
// app is used. Never the content of a thought: only the event's name from
// abl/usageAbl.ts's USAGE_EVENTS and a few short labels (a node type, a view
// name). Kept for a little over a year, then MongoDB drops it (TTL index).
export const USAGE_EVENT_TTL_DAYS = 400;

const UsageEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  // Short, whitelisted labels only (see usageAbl.ts's EVENT_PROPS).
  props: { type: Map, of: String, default: undefined },
  // A throwaway "try it" account (User.isDemo), so the summary can leave
  // them out or count them separately.
  demo: { type: Boolean, default: false },
  // When it happened in the browser (an event sent late, after the app was
  // offline, keeps its own time), and its UTC day for daily counts.
  at: { type: Date, required: true },
  day: { type: String, required: true }, // YYYY-MM-DD, UTC
});

// at: the summary reads a time window; the TTL drops old events.
UsageEventSchema.index({ at: 1 }, { expireAfterSeconds: USAGE_EVENT_TTL_DAYS * 24 * 60 * 60 });
UsageEventSchema.index({ day: 1, userId: 1 });

export const UsageEvent = mongoose.model("UsageEvent", UsageEventSchema);
