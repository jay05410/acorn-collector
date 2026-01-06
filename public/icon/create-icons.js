const fs = require('fs');
const sizes = [16, 32, 48, 128];

const createSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#f59e0b" rx="${size * 0.1}"/>
  <text x="50%" y="55%" font-family="Arial" font-size="${size * 0.5}" fill="white" text-anchor="middle" dominant-baseline="middle">🌰</text>
</svg>`;

sizes.forEach(size => {
  fs.writeFileSync(`${size}.svg`, createSvg(size));
  console.log(`Created ${size}.svg`);
});
