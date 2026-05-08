import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerPwaServiceWorker } from './register-service-worker';

const { registerSW } = vi.hoisted(() => ({
  registerSW: vi.fn(),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW,
}));

describe('registerPwaServiceWorker', () => {
  beforeEach(() => {
    registerSW.mockReset();
    registerSW.mockReturnValue(undefined);
  });

  it('registers the service worker when enabled and supported', () => {
    const serviceWorker = {} as ServiceWorkerContainer;

    registerPwaServiceWorker({
      enabled: true,
      serviceWorker,
    });

    expect(registerSW).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh: expect.any(Function),
      }),
    );
  });

  it('forces activation of an updated service worker when refresh is needed', () => {
    const updateServiceWorker = vi.fn();
    registerSW.mockReturnValue(updateServiceWorker);

    registerPwaServiceWorker({
      enabled: true,
      serviceWorker: {} as ServiceWorkerContainer,
    });

    const [options] = registerSW.mock.calls[0];
    options.onNeedRefresh();

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('skips registration when disabled', () => {
    registerPwaServiceWorker({
      enabled: false,
      serviceWorker: {} as ServiceWorkerContainer,
    });

    expect(registerSW).not.toHaveBeenCalled();
  });

  it('skips registration when service workers are unavailable', () => {
    registerPwaServiceWorker({
      enabled: true,
      serviceWorker: undefined,
    });

    expect(registerSW).not.toHaveBeenCalled();
  });
});
