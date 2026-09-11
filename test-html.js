import { DOMParser } from 'jsdom';
const doc = new DOMParser().parseFromString('<html><body><h1>Test</h1><p>Body text</p></body></html>', 'text/html');
const content = doc.documentElement; // This is an Element
console.log(content.body);
console.log(content.querySelector('body').textContent);
