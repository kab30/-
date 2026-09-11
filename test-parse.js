import epubjs from 'epubjs';
import fs from 'fs';
const ePub = epubjs.default || epubjs;

async function run() {
  const buf = fs.readFileSync('mobydick.epub');
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const book = ePub(buffer);
  await book.ready;
  
  const spineItems = book.spine.spineItems;
  console.log("Spine items count:", spineItems.length);
  
  if (spineItems.length > 0) {
    const item = spineItems[0];
    try {
      const content = await item.load(book.load.bind(book));
      console.log("Content type:", typeof content);
      if (typeof content === 'object' && content.body) {
        console.log("Body text length:", content.body.textContent.length);
      } else {
        console.log("Content string length:", content.length);
      }
    } catch (e) {
      console.log("Error loading item:", e);
    }
  }
}
run();
