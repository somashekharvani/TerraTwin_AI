import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Extend Jest matchers for typescript compilation safety
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}

// Mock browser API methods not supported in jsdom, cast to any to bypass strict TS MediaQueryList signature checking
(window as any).matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

// Mock HTMLCanvasElement.prototype.getContext to avoid console warnings about canvas not implemented in jsdom
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  createRadialGradient: jest.fn().mockReturnValue({
    addColorStop: jest.fn(),
  }),
  fill: jest.fn(),
  ellipse: jest.fn(),
  stroke: jest.fn(),
});

// Global mock for fetch to avoid ReferenceError: fetch is not defined in JSDOM
(window as any).fetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ totalEmitted: 438, monthlyForecast: 320, goal: 600, carbonSaved: 162 }),
  } as any);
});


