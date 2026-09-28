/**
 * "About ads" text that depends on how this build is configured, so the
 * dialog never names a host the extension does not contact.
 */
import { MONETIZATION, type MonetizationConfig } from '@/config/monetization';
import { t, tp } from '@/i18n';

/**
 * Where the ad list and its images come from: the configured feed host, or
 * that nothing is downloaded when the remote feed is turned off.
 */
export function adsNetworkNotice(
  config: Pick<MonetizationConfig, 'sponsorFeedUrl' | 'features'> = MONETIZATION
): string {
  if (!config.features.remoteSponsorFeed)
    return t('support', 'aboutAdsNetworkOff');
  return tp('support', 'aboutAdsNetwork', {
    host: new URL(config.sponsorFeedUrl).host,
  });
}
