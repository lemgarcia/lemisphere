const { Jimp } = require('jimp');

async function removeWhiteBg() {
  const imagePath = 'C:\\Users\\PC\\Downloads\\lemisphere.png';
  const outPath = 'C:\\Users\\PC\\Downloads\\lemisphere\\public\\logo.png';
  
  const image = await Jimp.read(imagePath);
  
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // Make white pixels transparent
  image.scan(0, 0, width, height, function (x, y, idx) {
    const red   = this.bitmap.data[idx + 0];
    const green = this.bitmap.data[idx + 1];
    const blue  = this.bitmap.data[idx + 2];
    
    // If pixel is white or very close to white, make transparent
    if (red > 240 && green > 240 && blue > 240) {
      this.bitmap.data[idx + 3] = 0; // alpha to 0
    }
  });

  // Autocrop to remove transparent borders
  image.autocrop();
  
  // Also resize slightly if it's huge
  if (image.bitmap.width > 512) {
    image.resize({ w: 512 });
  }
  
  await image.write(outPath);
  console.log('Processed image saved to', outPath);
}

removeWhiteBg().catch(console.error);
