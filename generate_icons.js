const sharp = require('sharp');
const path = require('path');

// Matches Logo.tsx exactly — bold F with accent dot
const svgCode = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="28" fill="#1c1c1e"/>
  <path d="M32 72V28H68" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 50H60" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="71" cy="72" r="8" fill="#A855F7"/>
</svg>`;

async function generate() {
  const publicDir = path.join(__dirname, 'public');
  const buffer = Buffer.from(svgCode);

  await sharp(buffer).resize(512, 512).png().toFile(path.join(publicDir, 'icon.png'));
  await sharp(buffer).resize(512, 512).png().toFile(path.join(publicDir, 'icon-v3.png'));
  
  // Maskable icon needs extra padding (safe-zone = inner 80%)
  const maskablesvg = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="0" fill="#1c1c1e"/>
  <path d="M32 72V28H68" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 50H60" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="71" cy="72" r="8" fill="#A855F7"/>
</svg>`;
  
  await sharp(Buffer.from(maskablesvg)).resize(512, 512).png().toFile(path.join(publicDir, 'maskable-v3.png'));

  console.log('Icons generated successfully.');
}

generate().catch(console.error);
