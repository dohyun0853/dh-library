import fs from 'node:fs/promises';
import sharp from 'sharp';
const svg=await fs.readFile('public/favicon.svg');for(const size of [192,512])await sharp(svg).resize(size,size).png().toFile(`public/icon-${size}.png`);
