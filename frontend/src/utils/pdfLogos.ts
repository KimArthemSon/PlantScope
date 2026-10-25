import plantscopeLogoSrc from "../assets/logo2.png";
import enroLogoSrc from "../assets/enro_logo.png";

export interface PdfLogos {
  enro: string | null;
  plantscope: string | null;
}

/** Load an image and crop its white margins into a square PNG data URL. */
function loadTrimmedLogo(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(src);
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const isInk = data[i + 3] > 20 && (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235);
          if (isInk) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return resolve(src);
      const size = Math.max(maxX - minX, maxY - minY) * 1.04;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const out = document.createElement("canvas");
      out.width = out.height = 400;
      const octx = out.getContext("2d");
      if (!octx) return resolve(src);
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, 400, 400);
      octx.drawImage(img, cx - size / 2, cy - size / 2, size, size, 0, 0, 400, 400);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

let cached: Promise<PdfLogos> | null = null;

/** ENRO and PlantScope logos ready for jsPDF.addImage (loaded once, then cached). */
export function getPdfLogos(): Promise<PdfLogos> {
  if (!cached) {
    cached = Promise.all([
      loadTrimmedLogo(enroLogoSrc).catch(() => null),
      loadTrimmedLogo(plantscopeLogoSrc).catch(() => null),
    ]).then(([enro, plantscope]) => ({ enro, plantscope }));
  }
  return cached;
}
