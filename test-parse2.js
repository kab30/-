import epubjs from 'epubjs';
const ePub = epubjs.default || epubjs;
const book = ePub();
console.log(Object.keys(book));
