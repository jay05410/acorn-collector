import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '..', 'public', 'icon');

mkdirSync(iconDir, { recursive: true });

const sizes = [16, 32, 48, 128];

const acornColor = { r: 245, g: 158, b: 11 };

for (const size of sizes) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size * 0.4;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (dist <= radius) {
        png.data[idx] = acornColor.r;
        png.data[idx + 1] = acornColor.g;
        png.data[idx + 2] = acornColor.b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  const buffer = PNG.sync.write(png);
  writeFileSync(join(iconDir, `${size}.png`), buffer);
  console.log(`Created ${size}.png`);
}

console.log('All icons generated!');
