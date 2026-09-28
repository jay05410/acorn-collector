/**
 * Revenue configuration: sponsor feed, donation links and feature flags.
 *
 * Every value can be overridden at build time with a VITE_* environment
 * variable (shell or .env file); see sponsors/README.md. Invalid overrides fall
 * back to the defaults below, so a typo can never point the extension at an
 * insecure URL.
 */

const REPO_URL = 'https://github.com/jay05410/acorn-collector';

const DEFAULTS = {
  sponsorFeedUrl:
    'https://raw.githubusercontent.com/jay05410/acorn-collector/main/sponsors/feed.json',
  githubSponsorsUrl: 'https://github.com/sponsors/jay05410',
  sponsorContactUrl: `${REPO_URL}/issues`,
  privacyPolicyUrl: `${REPO_URL}/blob/main/docs/PRIVACY.md`,
} as const;

/** The build-time variables this module reads. All optional. */
export interface MonetizationEnv {
  VITE_SPONSOR_FEED_URL?: unknown;
  VITE_BMC_URL?: unknown;
  VITE_GH_SPONSORS_URL?: unknown;
  VITE_SPONSOR_CONTACT_URL?: unknown;
  VITE_CWS_URL?: unknown;
  VITE_PRIVACY_POLICY_URL?: unknown;
  VITE_SPONSOR_SLOTS?: unknown;
  VITE_REMOTE_SPONSOR_FEED?: unknown;
}

export interface DonationLinks {
  /** Empty unless configured; an empty link's button is hidden. */
  buyMeACoffee: string;
  /** Defaults to the owner's page; empty when turned off with "off". */
  githubSponsors: string;
}

export interface MonetizationFeatures {
  /** Render sponsor slots at all. */
  sponsorSlots: boolean;
  /** Download the remote sponsor feed; when off only house promos show. */
  remoteSponsorFeed: boolean;
}

export interface MonetizationConfig {
  sponsorFeedUrl: string;
  /** Hosts sponsor images may load from: only the feed's own host. */
  sponsorImageHosts: readonly string[];
  donationLinks: DonationLinks;
  /** "Advertise here" target: an https URL or a mailto: address. */
  sponsorContact: string;
  /** Chrome Web Store listing; empty = derive it from the installed ID. */
  webStoreUrl: string;
  privacyPolicyUrl: string;
  /** Project page, used by the "share" house promo outside the store. */
  homepageUrl: string;
  features: MonetizationFeatures;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** An absolute https URL without embedded credentials, or null. */
export function toHttpsUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function toContactUrl(value: unknown): string | null {
  const raw = text(value);
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(raw)) return raw;
  return toHttpsUrl(raw);
}

const OFF_VALUES = ['0', 'false', 'off', 'no', 'none'];

/** "off" hides the link; unset or invalid values use the fallback. */
function optionalUrl(value: unknown, fallback: string): string {
  if (OFF_VALUES.includes(text(value).toLowerCase())) return '';
  return toHttpsUrl(value) ?? fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  const raw = text(value).toLowerCase();
  if (OFF_VALUES.includes(raw)) return false;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  return fallback;
}

/** Pure resolver, exported for tests. */
export function resolveMonetizationConfig(
  env: MonetizationEnv
): MonetizationConfig {
  const sponsorFeedUrl =
    toHttpsUrl(env.VITE_SPONSOR_FEED_URL) ?? DEFAULTS.sponsorFeedUrl;
  return {
    sponsorFeedUrl,
    sponsorImageHosts: [new URL(sponsorFeedUrl).host],
    donationLinks: {
      buyMeACoffee: optionalUrl(env.VITE_BMC_URL, ''),
      githubSponsors: optionalUrl(
        env.VITE_GH_SPONSORS_URL,
        DEFAULTS.githubSponsorsUrl
      ),
    },
    sponsorContact:
      toContactUrl(env.VITE_SPONSOR_CONTACT_URL) ?? DEFAULTS.sponsorContactUrl,
    webStoreUrl: toHttpsUrl(env.VITE_CWS_URL) ?? '',
    privacyPolicyUrl:
      toHttpsUrl(env.VITE_PRIVACY_POLICY_URL) ?? DEFAULTS.privacyPolicyUrl,
    homepageUrl: REPO_URL,
    features: {
      sponsorSlots: flag(env.VITE_SPONSOR_SLOTS, true),
      remoteSponsorFeed: flag(env.VITE_REMOTE_SPONSOR_FEED, true),
    },
  };
}

// Each variable is read by name so Vite can inline it at build time.
export const MONETIZATION: MonetizationConfig = resolveMonetizationConfig({
  VITE_SPONSOR_FEED_URL: import.meta.env.VITE_SPONSOR_FEED_URL,
  VITE_BMC_URL: import.meta.env.VITE_BMC_URL,
  VITE_GH_SPONSORS_URL: import.meta.env.VITE_GH_SPONSORS_URL,
  VITE_SPONSOR_CONTACT_URL: import.meta.env.VITE_SPONSOR_CONTACT_URL,
  VITE_CWS_URL: import.meta.env.VITE_CWS_URL,
  VITE_PRIVACY_POLICY_URL: import.meta.env.VITE_PRIVACY_POLICY_URL,
  VITE_SPONSOR_SLOTS: import.meta.env.VITE_SPONSOR_SLOTS,
  VITE_REMOTE_SPONSOR_FEED: import.meta.env.VITE_REMOTE_SPONSOR_FEED,
});

export const SPONSOR_FEED_URL = MONETIZATION.sponsorFeedUrl;
export const DONATION_LINKS = MONETIZATION.donationLinks;
export const SPONSOR_CONTACT = MONETIZATION.sponsorContact;
export const FEATURES = MONETIZATION.features;
