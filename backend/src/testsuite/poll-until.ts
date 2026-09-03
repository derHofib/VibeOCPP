// Shared polling loop used by both message-log-waiter.service.ts (waiting
// for a station-initiated message) and the command-step wait in
// testsuite-step-executor.service.ts (waiting for the callback controller
// to resolve a step) — both are "poll a piece of shared DB state until a
// condition holds or a deadline passes" with the same shape.
export async function pollUntil<T>(
  check: () => Promise<T | null>,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() >= deadline) return null;
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
