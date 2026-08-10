// Run: node generate-icons.mjs
import { createCanvas } from 'canvas';
import { writeFileSync, readFileSync } from 'fs';

// We'll use a simpler approach - write an HTML file that generates PNGs via canvas
const html = `<!DOCTYPE html>
<html>
<head><title>Icon Generator</title></head>
<body>
<script>
const svgStr = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#080808"/>
  <text x="256" y="340" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="300" fill="#F2F0EB" letter-spacing="-10">R</text>
  <circle cx="390" cy="160" r="40" fill="#ADFF2F"/>
</svg>\`;

function generatePNG(size, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const blob = new Blob([svgStr], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

window.onload = () => {
  setTimeout(() => generatePNG(192, 'icon-192.png'), 500);
  setTimeout(() => generatePNG(512, 'icon-512.png'), 1500);
};
</script>
<p>Generating icons... Check your Downloads folder.</p>
</body>
</html>`;

writeFileSync('C:/Users/Ramzan/OneDrive/Desktop/preddeploy/RentIt/project/generate-icons.html', html);
console.log('HTML generator created. Open generate-icons.html in browser to download PNGs.');
