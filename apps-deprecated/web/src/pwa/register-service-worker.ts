import { registerSW } from 'virtual:pwa-register';

export function registerPwaServiceWorker({
  enabled = import.meta.env.PROD,
  serviceWorker = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
}: {
  enabled?: boolean;
  serviceWorker?: ServiceWorkerContainer;
} = {}) {
  if (!enabled || !serviceWorker) {
    return undefined;
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateServiceWorker?.(true);
    },
  });

  return updateServiceWorker;
}
