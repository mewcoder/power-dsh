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
  let now = 0;
  const sources = [];
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
    get src() { return this.url; }
    set src(value) { this.url = value; if (value) sources.push(value); }
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
    performance: { now: () => now },
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
  return { canvas, document, media, images, frames, listeners, observers, sources, dots: () => dots,
    setTime(time) { now = time; },
    draw(time) {
      now = time;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(time);
    },
  };
}

test('draws the bundled frames and releases frames, images, observers and event listeners', testContext => {
  const app = browser(testContext);
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('valid fixture'));
  whale.play();
  assert.match(app.images[0].src, /^data:/);
  app.images[0].onload();
  app.draw(0);
  app.draw(1000);
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

test('replays after ten seconds from the first drawn frame without reloading or overlapping', testContext => {
  const app = browser(testContext);
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('valid fixture'));
  whale.play();
  whale.play();
  assert.equal(app.sources.length, 1);
  app.setTime(5000);
  app.images[0].onload();
  whale.play();
  assert.equal(app.frames.size, 1);
  app.draw(6000);
  app.setTime(11_000);
  whale.play();
  assert.equal(app.frames.size, 1);
  app.draw(11_700);
  assert.equal(app.frames.size, 0);
  app.setTime(15_999);
  whale.play();
  assert.equal(app.frames.size, 0);
  app.setTime(16_000);
  whale.play();
  assert.equal(app.frames.size, 1);
  const previousDots = app.dots();
  app.draw(16_000);
  assert.ok(app.dots() > previousDots);
  assert.equal(app.sources.length, 1);
  whale.dispose();
});

test('an unavailable canvas or visibility loss during loading does not consume the cooldown', testContext => {
  const app = browser(testContext);
  app.canvas.clientWidth = 0;
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('valid fixture'));
  whale.play();
  assert.equal(app.sources.length, 0);
  app.canvas.clientWidth = 800;
  app.observers[0].callback();
  app.observers[1].callback([{ isIntersecting: false }]);
  whale.play();
  assert.equal(app.sources.length, 0);
  app.observers[1].callback([{ isIntersecting: true }]);
  whale.play();
  assert.equal(app.sources.length, 1);
  app.observers[1].callback([{ isIntersecting: false }]);
  app.images[0].onload();
  assert.equal(app.frames.size, 0);
  app.observers[1].callback([{ isIntersecting: true }]);
  assert.equal(app.frames.size, 0);
  whale.play();
  assert.equal(app.frames.size, 1);
  app.draw(0);
  assert.ok(app.dots() > 0);
  assert.equal(app.sources.length, 1);
  whale.dispose();
});

test('interruption before the first frame can retry immediately; drawn playback retains its cooldown', testContext => {
  const app = browser(testContext);
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => assert.fail('valid fixture'));
  whale.play();
  app.images[0].onload();
  app.document.hidden = true;
  app.listeners.get('visibilitychange')();
  assert.equal(app.frames.size, 0);
  app.document.hidden = false;
  whale.play();
  assert.equal(app.frames.size, 1);
  app.draw(0);
  app.document.hidden = true;
  app.listeners.get('visibilitychange')();
  app.document.hidden = false;
  app.listeners.get('visibilitychange')();
  assert.equal(app.frames.size, 0);
  app.setTime(9999);
  whale.play();
  assert.equal(app.frames.size, 0);
  app.setTime(10_000);
  whale.play();
  assert.equal(app.frames.size, 1);
  whale.dispose();
});

test('a failed atlas load can retry immediately without consuming the cooldown', testContext => {
  const app = browser(testContext);
  let failures = 0;
  const whale = attachWhale(app.canvas, 'data:image/webp;base64,test', () => failures++);
  whale.play();
  app.images[0].onerror();
  assert.equal(failures, 1);
  assert.equal(app.frames.size, 0);
  whale.play();
  assert.equal(app.sources.length, 2);
  app.images[0].onload();
  app.draw(0);
  assert.ok(app.dots() > 0);
  whale.dispose();
});
