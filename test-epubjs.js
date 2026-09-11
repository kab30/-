import epubjs from 'epubjs';
const ePub = epubjs.default || epubjs;

async function test() {
  const book = ePub();
  console.log(book.spine);
}
test();
