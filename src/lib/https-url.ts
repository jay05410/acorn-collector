/**
 * The https URL rule shared by the build-time revenue configuration and the
 * sponsor feed validator: an absolute https: URL with no embedded user name
 * or password.
 */

/** Why a string is not an acceptable https URL (message is the reason). */
export class HttpsUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpsUrlError';
  }
}

/** Parses an absolute https URL without credentials, or throws HttpsUrlError. */
export function parseHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpsUrlError('not a URL');
  }
  if (url.protocol !== 'https:') throw new HttpsUrlError('must use https');
  if (url.username || url.password)
    throw new HttpsUrlError('must not contain credentials');
  return url;
}
