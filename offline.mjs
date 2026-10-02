export function setupOffline({
  onChange,
  onUpdate,
  navigator: nav = globalThis.navigator,
  window: win = globalThis.window,
}) {
  let state = "preparing";
  let registration;
  let updateRequested = false;
  const workerUrl = new URL("./sw.js", import.meta.url);
  const ownController = () =>
    nav.serviceWorker?.controller?.scriptURL === workerUrl.href;
  const emit = () => onChange({ state, online: nav.onLine !== false });
  const offerUpdate = () =>
    onUpdate(
      registration?.waiting
        ? () => {
            updateRequested = true;
            registration.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
          }
        : null,
    );
  const refresh = () => {
    if (ownController()) state = "ready";
    if (updateRequested) win.location.reload();
    else emit();
  };
  win.addEventListener("online", emit);
  win.addEventListener("offline", emit);
  if (!win.isSecureContext || !nav.serviceWorker) {
    state = "unavailable";
    emit();
    return;
  }
  nav.serviceWorker.addEventListener("controllerchange", refresh);
  emit();
  nav.serviceWorker
    .register(workerUrl, {
      scope: "./",
      updateViaCache: "none",
    })
    .then((value) => {
      registration = value;
      offerUpdate();
      const watchInstalling = () => {
        const worker = registration.installing;
        if (!worker) return;
        const changed = () => {
          if (worker.state === "installed") offerUpdate();
          if (worker.state === "redundant" && !ownController()) {
            state = "unavailable";
            emit();
          }
        };
        worker.addEventListener("statechange", changed);
        changed();
      };
      registration.addEventListener("updatefound", watchInstalling);
      watchInstalling();
      if (
        !registration.active &&
        !registration.installing &&
        !registration.waiting
      )
        state = "unavailable";
      refresh();
    })
    .catch(() => {
      state = "unavailable";
      emit();
    });
}
