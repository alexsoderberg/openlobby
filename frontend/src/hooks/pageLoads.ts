const pending = new Set<Promise<unknown>>();

/** Registers a page's first load so a page transition can wait for it. */
export function trackLoad(load: Promise<unknown>) {
  pending.add(load);
  const done = () => pending.delete(load);
  load.then(done, done);
}

/** Resolves when every registered load has settled (failures count) or after `timeoutMs`, whichever is first. */
export function pageLoadsSettled(timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const settled = Promise.allSettled([...pending]).then(() => undefined);
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}
