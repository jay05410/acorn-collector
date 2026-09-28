/**
 * Bundled "house" promos shown when the remote feed is unavailable or has
 * nothing for a slot. Built on demand so their text follows the current UI
 * language.
 */
import { t, tp } from '@/i18n';
import {
  DONATION_LINKS,
  MONETIZATION,
  SPONSOR_CONTACT,
  type DonationLinks,
} from '@/config/monetization';
import { PLACEMENTS, type Creative } from './feed';

export type HouseIcon = 'coffee' | 'star' | 'share' | 'megaphone';

/** A creative plus the bundled icon shown when it has no image. */
export interface DisplayCreative extends Creative {
  icon?: HouseIcon;
}

export interface HouseLinks {
  donationLinks: DonationLinks;
  sponsorContact: string;
  /** Store listing page, or null outside a Chrome Web Store install. */
  webStoreUrl: string | null;
  homepageUrl: string;
}

interface RuntimeInfo {
  id: string;
  getManifest(): { update_url?: string };
}

const WEB_STORE_UPDATE_HOST = /^https:\/\/clients2\.google\.com\//;

/**
 * The listing URL: the configured one, else derived from the extension ID
 * when installed from the Chrome Web Store (its manifest carries Google's
 * update_url). Unpacked and self-hosted builds have no listing.
 */
export function resolveWebStoreUrl(
  configured: string,
  runtime: RuntimeInfo | undefined
): string | null {
  if (configured) return configured;
  if (!runtime?.id) return null;
  const updateUrl = runtime.getManifest().update_url ?? '';
  return WEB_STORE_UPDATE_HOST.test(updateUrl)
    ? `https://chromewebstore.google.com/detail/${runtime.id}`
    : null;
}

function currentRuntime(): RuntimeInfo | undefined {
  return typeof chrome === 'undefined' ? undefined : chrome.runtime;
}

export function defaultHouseLinks(): HouseLinks {
  return {
    donationLinks: DONATION_LINKS,
    sponsorContact: SPONSOR_CONTACT,
    webStoreUrl: resolveWebStoreUrl(MONETIZATION.webStoreUrl, currentRuntime()),
    homepageUrl: MONETIZATION.homepageUrl,
  };
}

/**
 * House promos in the current language; ones without a link are left out.
 * With a store listing every placement has at least three, so the footer,
 * analysis and settings slots can show different ones at the same time.
 */
export function houseCreatives(
  links: HouseLinks = defaultHouseLinks()
): DisplayCreative[] {
  const appName = t('common', 'appName');
  const donateUrl =
    links.donationLinks.buyMeACoffee || links.donationLinks.githubSponsors;
  const creatives: DisplayCreative[] = [];

  if (donateUrl) {
    creatives.push({
      id: 'house-donate',
      // Settings already shows the donation card next to its slot.
      placements: ['footer', 'analysis'],
      locales: ['*'],
      title: tp('support', 'houseDonateTitle', { appName }),
      body: t('support', 'houseDonateBody'),
      cta: t('support', 'houseDonateCta'),
      clickUrl: donateUrl,
      sponsorName: appName,
      weight: 3,
      icon: 'coffee',
    });
  }
  if (links.webStoreUrl) {
    creatives.push({
      id: 'house-rate',
      placements: PLACEMENTS,
      locales: ['*'],
      title: t('support', 'houseRateTitle'),
      body: t('support', 'houseRateBody'),
      cta: t('support', 'houseRateCta'),
      clickUrl: `${links.webStoreUrl.replace(/\/+$/, '')}/reviews`,
      sponsorName: appName,
      weight: 2,
      icon: 'star',
    });
  }
  creatives.push(
    {
      id: 'house-share',
      placements: PLACEMENTS,
      locales: ['*'],
      title: t('support', 'houseShareTitle'),
      body: tp('support', 'houseShareBody', { appName }),
      cta: t('support', 'houseShareCta'),
      clickUrl: links.webStoreUrl ?? links.homepageUrl,
      sponsorName: appName,
      weight: 2,
      icon: 'share',
    },
    {
      id: 'house-advertise',
      placements: PLACEMENTS,
      locales: ['*'],
      title: t('support', 'houseAdvertiseTitle'),
      body: t('support', 'houseAdvertiseBody'),
      cta: t('support', 'houseAdvertiseCta'),
      clickUrl: links.sponsorContact,
      sponsorName: appName,
      weight: 1,
      icon: 'megaphone',
    }
  );
  return creatives;
}
