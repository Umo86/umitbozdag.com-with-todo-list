/** Unknown versions never trigger an APK download prompt. */
export function newerAppBuild(installed: unknown, available: unknown): boolean {
  const current = typeof installed === "string" && /^\d+$/.test(installed) ? Number(installed) : installed;
  return typeof current === "number" && Number.isSafeInteger(current) && current > 0
    && typeof available === "number" && Number.isSafeInteger(available) && available > current;
}

export function canRefreshApp(state: { hidden: boolean; editing: boolean; saving: boolean; dragging: boolean }): boolean {
  return !state.hidden && !state.editing && !state.saving && !state.dragging;
}
