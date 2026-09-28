import { describe, expect, it } from 'vitest';
import { filterImages, imageKey, isDecorativeImage, upgradeImageUrl } from './images';

const MEDIA = 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D';

describe('upgradeImageUrl: pbs.twimg.com', () => {
  it.each([
    // format=jpg gets name=orig (the only format where orig exists)
    [`${MEDIA}?format=jpg&name=small`, `${MEDIA}?format=jpg&name=orig`],
    [`${MEDIA}?format=jpg&name=medium`, `${MEDIA}?format=jpg&name=orig`],
    [`${MEDIA}?format=jpg&name=900x900`, `${MEDIA}?format=jpg&name=orig`],
    [`${MEDIA}?format=jpeg&name=large`, `${MEDIA}?format=jpg&name=orig`],
    // png/webp orig is a 404, so they get the 4096x4096 box instead
    [`${MEDIA}?format=png&name=small`, `${MEDIA}?format=png&name=4096x4096`],
    [`${MEDIA}?format=webp&name=large`, `${MEDIA}?format=webp&name=4096x4096`],
    [`${MEDIA}?format=png&name=orig`, `${MEDIA}?format=png&name=4096x4096`],
    // legacy extension forms (syndication media_url_https, :size suffix)
    [`${MEDIA}.jpg`, `${MEDIA}?format=jpg&name=orig`],
    [`${MEDIA}.jpg:large`, `${MEDIA}?format=jpg&name=orig`],
    [`${MEDIA}.png`, `${MEDIA}?format=png&name=4096x4096`],
    [`${MEDIA}.jpg?name=small`, `${MEDIA}?format=jpg&name=orig`],
    // no format at all defaults to jpg
    [`${MEDIA}?name=small`, `${MEDIA}?format=jpg&name=orig`],
  ])('%s -> %s', (input, expected) => {
    expect(upgradeImageUrl(input)).toBe(expected);
  });

  it('leaves non-media pbs paths alone', () => {
    const avatar = 'https://pbs.twimg.com/profile_images/1/abc_normal.jpg';
    const thumb = 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/x.jpg';
    expect(upgradeImageUrl(avatar)).toBe(avatar);
    expect(upgradeImageUrl(thumb)).toBe(thumb);
  });
});

describe('upgradeImageUrl: other CDNs', () => {
  it('maps Bluesky feed thumbnails to full size', () => {
    expect(
      upgradeImageUrl('https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:abc/bafkrei123@jpeg')
    ).toBe('https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafkrei123@jpeg');
    const avatar = 'https://cdn.bsky.app/img/avatar/plain/did:plc:abc/bafk@jpeg';
    expect(upgradeImageUrl(avatar)).toBe(avatar);
  });

  it('strips the BOOTH resize segment from item images only', () => {
    expect(
      upgradeImageUrl(
        'https://booth.pximg.net/c/72x72_a2_g5/cf9efa93-2c93/i/8893147/d2a1_base_resized.jpg'
      )
    ).toBe('https://booth.pximg.net/cf9efa93-2c93/i/8893147/d2a1_base_resized.jpg');
    const icon = 'https://booth.pximg.net/c/48x48/users/1/icon_image/x_base_resized.jpg';
    expect(upgradeImageUrl(icon)).toBe(icon);
  });

  it('maps pixiv thumbnails to the 1200px master', () => {
    expect(
      upgradeImageUrl(
        'https://i.pximg.net/c/250x250_80_a2/img-master/img/2024/01/02/03/04/05/12345_p0_square1200.jpg'
      )
    ).toBe('https://i.pximg.net/img-master/img/2024/01/02/03/04/05/12345_p0_master1200.jpg');
    expect(
      upgradeImageUrl(
        'https://i.pximg.net/c/250x250_80_a2/custom-thumb/img/2024/01/02/03/04/05/12345_p1_custom1200.jpg'
      )
    ).toBe('https://i.pximg.net/img-master/img/2024/01/02/03/04/05/12345_p1_master1200.jpg');
  });

  it('does not guess pixiv originals', () => {
    const original = 'https://i.pximg.net/img-original/img/2024/01/02/03/04/05/12345_p0.png';
    expect(upgradeImageUrl(original)).toBe(original);
  });

  it('returns unknown and invalid URLs unchanged', () => {
    expect(upgradeImageUrl('https://example.com/a.jpg?w=100')).toBe(
      'https://example.com/a.jpg?w=100'
    );
    expect(upgradeImageUrl('not a url')).toBe('not a url');
  });
});

describe('imageKey', () => {
  it('ignores size and format parameters', () => {
    expect(imageKey(`${MEDIA}?format=jpg&name=orig`)).toBe(imageKey(`${MEDIA}?format=webp&name=small`));
    expect(imageKey('https://example.com/a.jpg?w=100&id=2')).toBe(
      imageKey('https://example.com/a.jpg?id=2&w=800')
    );
    expect(imageKey('https://example.com/a.jpg?id=1')).not.toBe(
      imageKey('https://example.com/a.jpg?id=2')
    );
  });
});

describe('isDecorativeImage', () => {
  it.each([
    'https://pbs.twimg.com/profile_images/1/me_normal.jpg',
    'https://abs-0.twimg.com/emoji/v2/svg/1f600.svg',
    'https://cdn.bsky.app/img/avatar/plain/did:plc:x/y@jpeg',
    'https://example.com/favicon.ico',
    'https://example.com/static/icons/menu.png',
    'https://example.com/logo.svg',
  ])('drops %s', (url) => {
    expect(isDecorativeImage({ url })).toBe(true);
  });

  it('drops images below 200px only when the size is known', () => {
    expect(isDecorativeImage({ url: 'https://e.com/a.jpg', width: 120, height: 900 })).toBe(true);
    expect(isDecorativeImage({ url: 'https://e.com/a.jpg', width: 900, height: 199 })).toBe(true);
    expect(isDecorativeImage({ url: 'https://e.com/a.jpg', width: 200, height: 200 })).toBe(false);
    expect(isDecorativeImage({ url: 'https://e.com/a.jpg' })).toBe(false);
  });
});

describe('filterImages', () => {
  it('upgrades, drops decorative and non-http images, dedupes and caps', () => {
    const result = filterImages([
      { url: `${MEDIA}?format=jpg&name=small` },
      { url: `${MEDIA}?format=webp&name=large`, width: 800, height: 532, alt: 'dupe' },
      { url: 'https://pbs.twimg.com/profile_images/1/me_normal.jpg' },
      { url: 'data:image/png;base64,AAAA' },
      { url: 'blob:https://example.com/uuid' },
      ...Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/p${i}.jpg` })),
    ]);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({
      url: `${MEDIA}?format=jpg&name=orig`,
      width: 800,
      height: 532,
      alt: 'dupe',
    });
    expect(result.slice(1).map((image) => image.url)).toEqual(
      Array.from({ length: 7 }, (_, i) => `https://example.com/p${i}.jpg`)
    );
  });

  it('respects a custom limit', () => {
    expect(filterImages([{ url: 'https://e.com/1.jpg' }, { url: 'https://e.com/2.jpg' }], 1)).toHaveLength(1);
  });
});
