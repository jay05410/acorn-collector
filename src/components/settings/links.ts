/** External pages the settings screen links to. */
import { MONETIZATION } from '@/config/monetization';
import type { ApiProviderId } from '@/lib/ai/models';

/** Where each provider's own keys are created and revoked. */
export const PROVIDER_KEY_PAGES: Readonly<Record<ApiProviderId, string>> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://platform.claude.com/settings/keys',
  openrouter: 'https://openrouter.ai/settings/keys',
};

/** Key prefixes, shown as input placeholders only. */
export const PROVIDER_KEY_PLACEHOLDERS: Readonly<Record<ApiProviderId, string>> =
  {
    openai: 'sk-...',
    anthropic: 'sk-ant-...',
    openrouter: 'sk-or-...',
  };

export const SOURCE_CODE_URL = MONETIZATION.homepageUrl;
export const NATIVE_HOST_README_URL = `${MONETIZATION.homepageUrl}/blob/main/native-host/README.md`;
export const PRIVACY_POLICY_URL = MONETIZATION.privacyPolicyUrl;
