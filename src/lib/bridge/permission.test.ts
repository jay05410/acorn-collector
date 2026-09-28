import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasBridgePermission, requestBridgePermission } from './permission';

afterEach(() => vi.unstubAllGlobals());

describe('bridge permission', () => {
  it('checks and requests only the optional nativeMessaging permission', async () => {
    const contains = vi.fn().mockResolvedValue(false);
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', { permissions: { contains, request } });

    await expect(hasBridgePermission()).resolves.toBe(false);
    await expect(requestBridgePermission()).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({ permissions: ['nativeMessaging'] });
    expect(request).toHaveBeenCalledWith({ permissions: ['nativeMessaging'] });
  });
});
