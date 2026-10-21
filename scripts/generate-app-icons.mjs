import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgBuffer = fs.readFileSync('public/assets/images/RD.svg');

// Create transparent version of RD logo by removing the white background rect
const svgString = svgBuffer.toString('utf-8');
const transparentSvg = Buffer.from(
  svgString.replace(/<rect[^>]+fill="#ffffff"[^>]*\/>/g, '')
);

const mipmapConfigs = [
  { folder: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { folder: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { folder: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { folder: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { folder: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 }
];

async function generate() {
  const baseDir = 'android/app/src/main/res';
  
  for (const conf of mipmapConfigs) {
    const dir = path.join(baseDir, conf.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 1. Foreground icon for adaptive icon:
    // Canvas: conf.fgSize x conf.fgSize
    // Logo content: ~60% of canvas size centered (fits safely within 66% Android safe zone)
    const logoFgSize = Math.round(conf.fgSize * 0.60);
    const logoFgBuffer = await sharp(transparentSvg)
      .resize(logoFgSize, logoFgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: conf.fgSize,
        height: conf.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: logoFgBuffer, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    // 2. Legacy regular icon:
    // Canvas: conf.iconSize x conf.iconSize, white background with RD logo centered (~75% size)
    const logoLegacySize = Math.round(conf.iconSize * 0.75);
    const logoLegacyBuffer = await sharp(transparentSvg)
      .resize(logoLegacySize, logoLegacySize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: conf.iconSize,
        height: conf.iconSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{ input: logoLegacyBuffer, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // 3. Legacy round icon:
    // Circular mask on white background with RD logo
    const roundMask = Buffer.from(
      `<svg width="${conf.iconSize}" height="${conf.iconSize}"><circle cx="${conf.iconSize/2}" cy="${conf.iconSize/2}" r="${conf.iconSize/2}" fill="#fff" /></svg>`
    );
    const roundBase = await sharp({
      create: {
        width: conf.iconSize,
        height: conf.iconSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{ input: logoLegacyBuffer, gravity: 'center' }])
      .png()
      .toBuffer();

    await sharp(roundBase)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`Generated ${conf.folder} icons.`);
  }

  // 4. Splash screens:
  const splashConfigs = [
    { dir: 'drawable', width: 480, height: 320 },
    { dir: 'drawable-land-mdpi', width: 480, height: 320 },
    { dir: 'drawable-land-hdpi', width: 800, height: 480 },
    { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
    { dir: 'drawable-port-mdpi', width: 320, height: 480 },
    { dir: 'drawable-port-hdpi', width: 480, height: 800 },
    { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  ];

  for (const s of splashConfigs) {
    const targetDir = path.join(baseDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Logo size: 30% of smaller dimension (clean centered logo)
    const minDim = Math.min(s.width, s.height);
    const logoSplashSize = Math.max(80, Math.min(240, Math.round(minDim * 0.30)));

    const logoSplashBuffer = await sharp(transparentSvg)
      .resize(logoSplashSize, logoSplashSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: s.width,
        height: s.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{ input: logoSplashBuffer, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`Generated ${s.dir}/splash.png (${s.width}x${s.height})`);
  }

  // Remove the old Android Studio template vector foreground if present
  const oldVector = path.join(baseDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(oldVector)) {
    fs.unlinkSync(oldVector);
    console.log('Removed stale drawable-v24/ic_launcher_foreground.xml');
  }

  console.log('All icons and splash screens successfully generated!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
