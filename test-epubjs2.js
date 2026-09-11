import epubjs from 'epubjs';
const Section = epubjs.default ? epubjs.default.Book.prototype.constructor : epubjs.Book;
console.log(Object.keys(epubjs));
