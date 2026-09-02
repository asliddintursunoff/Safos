const listeners = new Set();
let seq = 0;

export function toast(message, type = "ok") {
  if (!message) return;
  const item = { id: ++seq, message: String(message), type };
  listeners.forEach((fn) => fn(item));
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (type === "ok") haptic?.notificationOccurred?.("success");
    else if (type === "error") haptic?.notificationOccurred?.("error");
    else haptic?.impactOccurred?.("light");
  } catch {
    /* optional */
  }
}

toast.ok = (message) => toast(message, "ok");
toast.error = (message) => toast(message, "error");
toast.info = (message) => toast(message, "info");

export function onToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
