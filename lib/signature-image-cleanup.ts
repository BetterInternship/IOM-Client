const WIDTH = 900;
const HEIGHT = 280;

export async function removeSignatureImageBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1400 / (image.naturalWidth || image.width));
      const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context) return resolve(dataUrl);

      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      const border = Math.max(4, Math.floor(Math.min(width, height) * 0.08));
      const samples: number[][] = [];
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if (x >= border && y >= border && x < width - border && y < height - border) continue;
          const i = (y * width + x) * 4;
          samples.push([data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255]);
        }
      }
      samples.sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
      const paper = samples.slice(Math.floor(samples.length * 0.55));
      const background = paper
        .reduce((sum, sample) => sum.map((value, i) => value + sample[i]), [0, 0, 0])
        .map((value) => value / Math.max(1, paper.length));
      const backgroundBrightness = (background[0] + background[1] + background[2]) / 3;
      const mask = new Uint8Array(width * height);

      for (let pixel = 0; pixel < mask.length; pixel++) {
        const i = pixel * 4;
        const r = data[i] ?? 255;
        const g = data[i + 1] ?? 255;
        const b = data[i + 2] ?? 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const brightness = (r + g + b) / 3;
        const saturation = max === 0 ? 0 : (max - min) / max;
        const distance = Math.sqrt(
          (r - background[0]) ** 2 + (g - background[1]) ** 2 + (b - background[2]) ** 2,
        );
        mask[pixel] =
          (b > r + 12 && saturation > 0.12 && distance > 28) ||
          (brightness < backgroundBrightness - 58 && distance > 42) ||
          (saturation > 0.2 && distance > 40 && brightness < 235)
            ? 1
            : 0;
      }

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let pixel = 0; pixel < mask.length; pixel++) {
        const i = pixel * 4;
        if (!mask[pixel]) {
          data[i + 3] = 0;
          continue;
        }
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        data[i] = Math.round((data[i] ?? 0) * 0.55);
        data[i + 1] = Math.round((data[i + 1] ?? 0) * 0.55);
        data[i + 2] = Math.round((data[i + 2] ?? 0) * 0.6);
        data[i + 3] = 255;
      }
      if (maxX < minX || maxY < minY) return resolve(dataUrl);

      context.putImageData(imageData, 0, 0);
      const padding = 22;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
      const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);
      const target = document.createElement("canvas");
      target.width = WIDTH;
      target.height = HEIGHT;
      const targetContext = target.getContext("2d");
      if (!targetContext) return resolve(dataUrl);
      const targetScale = Math.min(WIDTH / cropWidth, HEIGHT / cropHeight);
      const drawWidth = cropWidth * targetScale;
      const drawHeight = cropHeight * targetScale;
      targetContext.drawImage(
        source,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        (WIDTH - drawWidth) / 2,
        (HEIGHT - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      resolve(target.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Unable to read signature image."));
    image.src = dataUrl;
  });
}
