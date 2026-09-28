// Shared by every staggered/stepped canvas animation (group-drag catch-up,
// the majority-swap auto-reposition, a template branch's own step-by-step
// reveal) — one small await instead of each one hand-rolling its own
// setTimeout-wrapped Promise.
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
