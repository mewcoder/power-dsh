import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachWhale } from '../renderer.ts';

function browser(testContext, reduced = false) {
  const original = new Map();
  const frames = new Map();
  const listeners = new Map();
  const observers = [];
  const images = [];
  let frameId = 0;
  let dots = 0;
  const pixels = new Uint8ClampedArray(2304 * 1296 * 4).fill(128);
  const context = { clearRect() {}, setTransform() {}, beginPath() {}, arc() { dots++; }, fill() {}, drawImage() {},
    getImageData: () => ({ data: pixels }) };
  const document = { hidden: false,
    createElement: () => ({ getContext: () => context }),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
  };
  const media = { matches: reduced, addEventListener: (name, listener) => listeners.set(`media:${name}`, listener),
    removeEventListener: name => listeners.delete(`media:${name}`) };
  class ImageFixture {
    naturalWidth = 2304; naturalHeight = 1296;
    constructor() { images.push(this); }
    removeAttribute() { this.src = ''; }
  }
  class Observer {
    disconnected = false;
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  for (const [name, value] of Object.entries({ document, Image: ImageFixture, matchMedia: () => media,
    ResizeObserver: Observer, IntersectionObserver: Observer, devicePixelRatio: 1,
    getComputedStyle: () => ({ color: '#555' }),
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  })) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  testContext.after(() => {
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  const canvas = { clientWidth: 800, clientHeight: 600, getContext: () => context };
  return { canvas, document, media, images, frames, listeners, observers, dots: () => dots };
}

test('draws the bundled frame once and releases frames, images, observers and event listeners', testContext => {
  const app = browser(testContext);
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('valid fixture'));
  whale.play();
  assert.match(app.images[0].src, /^data:/);
  app.images[0].onload();
  const [frameId, draw] = app.frames.entries().next().value;
  app.frames.delete(frameId);
  draw(performance.now() + 1000);
  assert.ok(app.dots() > 0);
  whale.dispose();
  assert.equal(app.frames.size, 0);
  assert.equal(app.listeners.size, 0);
  assert.ok(app.observers.every(observer => observer.disconnected));
  assert.equal(app.images[0].onload, null);
  assert.equal(app.canvas.width, 0);
});

test('reduced motion and hidden documents do not load the animation', testContext => {
  const app = browser(testContext, true);
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('no rendering needed'));
  whale.play();
  assert.equal(app.images[0].src, undefined);
  app.media.matches = false;
  app.document.hidden = true;
  whale.play();
  assert.equal(app.images[0].src, undefined);
  whale.dispose();
});
