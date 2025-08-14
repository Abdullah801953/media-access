import path from "path";
import sharp from "sharp";

export async function addWatermark(inputImage, outputImage) {
  try {
    const absoluteOutputPath = path.resolve(outputImage);

    // Manual dimensions for watermark
    const watermarkWidth = 800; // pixels
    const watermarkHeight = 600; // pixels

    // Load watermark and resize to given pixel dimensions
    const watermark = await sharp(
      path.resolve(__dirname, "watermarks/logo2.png")
    )
      .resize({
        width: watermarkWidth,
        height: watermarkHeight,
        fit: "contain", // keep aspect ratio
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    // Get base image dimensions (only to center the watermark)
    const metadata = await sharp(inputImage).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Center position calculation
    const left = Math.floor((imgWidth - watermarkWidth) / 2);
    const top = Math.floor((imgHeight - watermarkHeight) / 2);

    // Apply watermark
    await sharp(inputImage)
      .composite([
        {
          input: watermark,
          left,
          top,
          blend: "over",
          opacity: 0.3,
        },
      ])
      .toFile(absoluteOutputPath);

    console.log(`Watermark added to ${absoluteOutputPath}`);
  } catch (err) {
    console.error("Error adding watermark:", err);
    throw err;
  }
}
// Apply all watermarks
await sharp(inputImage).composite(watermarks).toFile(absoluteOutputPath);
