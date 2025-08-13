import path from "path";
import sharp from "sharp";

export async function addWatermark(inputImage, outputImage) {
  try {
    const absoluteOutputPath = path.resolve(outputImage);

    // Original image size
    const metadata = await sharp(inputImage).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Watermark resize (~10% of width)
    const watermark = await sharp(
      path.resolve(__dirname, "watermarks/logo.png")
    )
      .resize(100)
      .toBuffer();

    // Generate 100 random positions
    const watermarks = [];
    for (let i = 0; i < 100; i++) {
      const left = Math.floor(
        Math.random() * (imgWidth - Math.floor(imgWidth * 0.1))
      );
      const top = Math.floor(
        Math.random() * (imgHeight - Math.floor(imgWidth * 0.1))
      );
      watermarks.push({
        input: watermark,
        left,
        top,
        blend: "over",
        opacity: 0.3,
      });
    }

    // Apply all watermarks
    await sharp(inputImage).composite(watermarks).toFile(absoluteOutputPath);

    console.log(`100 watermarks added to ${absoluteOutputPath}`);
  } catch (err) {
    console.error("Error adding watermark:", err);
    throw err;
  }
}
