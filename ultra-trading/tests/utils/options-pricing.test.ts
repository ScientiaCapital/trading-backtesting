/**
 * Options Pricing Engine Tests
 * Validates mathematical functions against known values
 */

import { describe, it, expect } from 'vitest';
import {
  NormalDistribution,
  Optimization,
  BlackScholesEngine,
  calculateImpliedVolatility,
  Statistics,
  Matrix
} from '@/utils/options-pricing';

describe('NormalDistribution', () => {
  describe('cdf', () => {
    it('should calculate correct CDF values', () => {
      // Test against known values
      expect(NormalDistribution.cdf(0)).toBeCloseTo(0.5, 6);
      expect(NormalDistribution.cdf(1)).toBeCloseTo(0.8413447, 6);
      expect(NormalDistribution.cdf(-1)).toBeCloseTo(0.1586553, 6);
      expect(NormalDistribution.cdf(2)).toBeCloseTo(0.9772499, 6);
      expect(NormalDistribution.cdf(-2)).toBeCloseTo(0.0227501, 6);
      expect(NormalDistribution.cdf(3)).toBeCloseTo(0.9986501, 6);
    });
  });

  describe('pdf', () => {
    it('should calculate correct PDF values', () => {
      expect(NormalDistribution.pdf(0)).toBeCloseTo(0.3989423, 6);
      expect(NormalDistribution.pdf(1)).toBeCloseTo(0.2419707, 6);
      expect(NormalDistribution.pdf(-1)).toBeCloseTo(0.2419707, 6);
      expect(NormalDistribution.pdf(2)).toBeCloseTo(0.0539910, 6);
    });
  });

  describe('inverseCdf', () => {
    it('should calculate correct inverse CDF values', () => {
      expect(NormalDistribution.inverseCdf(0.5)).toBeCloseTo(0, 6);
      expect(NormalDistribution.inverseCdf(0.8413447)).toBeCloseTo(1, 3);
      expect(NormalDistribution.inverseCdf(0.1586553)).toBeCloseTo(-1, 3);
      expect(NormalDistribution.inverseCdf(0.9772499)).toBeCloseTo(2, 3);
      expect(NormalDistribution.inverseCdf(0.0227501)).toBeCloseTo(-2, 3);
    });

    it('should throw error for invalid probabilities', () => {
      expect(() => NormalDistribution.inverseCdf(0)).toThrow();
      expect(() => NormalDistribution.inverseCdf(1)).toThrow();
      expect(() => NormalDistribution.inverseCdf(-0.1)).toThrow();
      expect(() => NormalDistribution.inverseCdf(1.1)).toThrow();
    });
  });
});

describe('Optimization', () => {
  describe('brentq', () => {
    it('should find roots of simple functions', () => {
      // f(x) = x^2 - 4, roots at x = ±2
      const f = (x: number) => x * x - 4;
      const root = Optimization.brentq(f, 0, 3);
      expect(root).toBeCloseTo(2, 6);
    });

    it('should find roots of complex functions', () => {
      // f(x) = sin(x) - 0.5, root near x = π/6
      const f = (x: number) => Math.sin(x) - 0.5;
      const root = Optimization.brentq(f, 0, Math.PI/2);
      expect(root).toBeCloseTo(Math.PI/6, 6);
    });

    it('should throw error if root is not bracketed', () => {
      const f = (x: number) => x * x + 1; // No real roots
      expect(() => Optimization.brentq(f, -1, 1)).toThrow('Root is not bracketed');
    });
  });

  describe('newtonRaphson', () => {
    it('should find roots using Newton-Raphson method', () => {
      // f(x) = x^2 - 4, f'(x) = 2x
      const f = (x: number) => x * x - 4;
      const df = (x: number) => 2 * x;
      const root = Optimization.newtonRaphson(f, df, 3);
      expect(root).toBeCloseTo(2, 6);
    });
  });
});

describe('BlackScholesEngine', () => {
  const engine = new BlackScholesEngine(0.05); // 5% risk-free rate

  describe('calculatePrice', () => {
    it('should calculate correct call option prices', () => {
      // Test case: S=100, K=100, T=1, σ=0.2, r=0.05
      const price = engine.calculatePrice({
        underlyingPrice: 100,
        strikePrice: 100,
        timeToExpiry: 1,
        volatility: 0.2,
        optionType: 'call'
      });
      expect(price).toBeCloseTo(10.4506, 2);
    });

    it('should calculate correct put option prices', () => {
      // Test case: S=100, K=100, T=1, σ=0.2, r=0.05
      const price = engine.calculatePrice({
        underlyingPrice: 100,
        strikePrice: 100,
        timeToExpiry: 1,
        volatility: 0.2,
        optionType: 'put'
      });
      expect(price).toBeCloseTo(5.5735, 2);
    });

    it('should handle expired options', () => {
      // Call option expired ITM
      expect(engine.calculatePrice({
        underlyingPrice: 110,
        strikePrice: 100,
        timeToExpiry: 0,
        volatility: 0.2,
        optionType: 'call'
      })).toBe(10);

      // Put option expired ITM
      expect(engine.calculatePrice({
        underlyingPrice: 90,
        strikePrice: 100,
        timeToExpiry: 0,
        volatility: 0.2,
        optionType: 'put'
      })).toBe(10);
    });
  });

  describe('calculateGreeks', () => {
    it('should calculate correct Greeks for call options', () => {
      const greeks = engine.calculateGreeks({
        underlyingPrice: 100,
        strikePrice: 100,
        timeToExpiry: 1,
        volatility: 0.2,
        optionType: 'call'
      });

      expect(greeks.delta).toBeCloseTo(0.6368, 3);
      expect(greeks.gamma).toBeCloseTo(0.0188, 4);
      expect(greeks.theta).toBeCloseTo(-0.0137, 4); // Daily theta
      expect(greeks.vega).toBeCloseTo(0.3755, 3); // Per 1% vol change
      expect(greeks.rho).toBeCloseTo(0.5323, 3); // Per 1% rate change
    });

    it('should calculate correct Greeks for put options', () => {
      const greeks = engine.calculateGreeks({
        underlyingPrice: 100,
        strikePrice: 100,
        timeToExpiry: 1,
        volatility: 0.2,
        optionType: 'put'
      });

      expect(greeks.delta).toBeCloseTo(-0.3632, 3);
      expect(greeks.gamma).toBeCloseTo(0.0188, 4); // Same as call
      expect(greeks.theta).toBeCloseTo(-0.0003, 4); // Daily theta
      expect(greeks.vega).toBeCloseTo(0.3755, 3); // Same as call
      expect(greeks.rho).toBeCloseTo(-0.4265, 3); // Per 1% rate change
    });
  });
});

describe('calculateImpliedVolatility', () => {
  it('should calculate correct implied volatility', () => {
    // Known case: if option price = BS price with σ=0.3, then IV should be 0.3
    const engine = new BlackScholesEngine(0.05);
    const targetVol = 0.3;
    
    // Calculate option price with known volatility
    const optionPrice = engine.calculatePrice({
      underlyingPrice: 100,
      strikePrice: 100,
      timeToExpiry: 0.25,
      volatility: targetVol,
      optionType: 'call'
    });

    // Calculate implied volatility from that price
    const iv = calculateImpliedVolatility({
      optionPrice,
      underlyingPrice: 100,
      strikePrice: 100,
      timeToExpiry: 0.25,
      riskFreeRate: 0.05,
      optionType: 'call'
    });

    expect(iv).toBeCloseTo(targetVol, 6);
  });

  it('should handle edge cases', () => {
    // At-the-money with zero time
    expect(calculateImpliedVolatility({
      optionPrice: 0,
      underlyingPrice: 100,
      strikePrice: 100,
      timeToExpiry: 0,
      riskFreeRate: 0.05,
      optionType: 'call'
    })).toBe(0);

    // Deep out-of-the-money
    expect(calculateImpliedVolatility({
      optionPrice: 0.01,
      underlyingPrice: 100,
      strikePrice: 200,
      timeToExpiry: 0.1,
      riskFreeRate: 0.05,
      optionType: 'call'
    })).toBeCloseTo(0, 2);
  });
});

describe('Statistics', () => {
  describe('mean', () => {
    it('should calculate correct mean', () => {
      expect(Statistics.mean([1, 2, 3, 4, 5])).toBe(3);
      expect(Statistics.mean([10, 20, 30])).toBe(20);
      expect(Statistics.mean([])).toBe(0);
    });
  });

  describe('standardDeviation', () => {
    it('should calculate correct sample standard deviation', () => {
      expect(Statistics.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.0, 1);
    });

    it('should calculate correct population standard deviation', () => {
      expect(Statistics.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], false)).toBeCloseTo(1.87, 2);
    });
  });

  describe('correlation', () => {
    it('should calculate correct correlation coefficient', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(Statistics.correlation(x, y)).toBeCloseTo(1.0, 6); // Perfect positive correlation

      const z = [5, 4, 3, 2, 1];
      expect(Statistics.correlation(x, z)).toBeCloseTo(-1.0, 6); // Perfect negative correlation
    });
  });

  describe('percentile', () => {
    it('should calculate correct percentiles', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(Statistics.percentile(data, 50)).toBe(5.5); // Median
      expect(Statistics.percentile(data, 25)).toBe(3.25); // Q1
      expect(Statistics.percentile(data, 75)).toBe(7.75); // Q3
      expect(Statistics.percentile(data, 0)).toBe(1); // Min
      expect(Statistics.percentile(data, 100)).toBe(10); // Max
    });
  });
});

describe('Matrix', () => {
  describe('multiply', () => {
    it('should multiply matrices correctly', () => {
      const a = [[1, 2], [3, 4]];
      const b = [[5, 6], [7, 8]];
      const result = Matrix.multiply(a, b);
      expect(result).toEqual([[19, 22], [43, 50]]);
    });

    it('should throw error for incompatible dimensions', () => {
      const a = [[1, 2, 3]];
      const b = [[1], [2]];
      expect(() => Matrix.multiply(a, b)).toThrow('Invalid matrix dimensions');
    });
  });

  describe('covariance', () => {
    it('should calculate covariance matrix', () => {
      const data = [
        [1, 2],
        [2, 4],
        [3, 6],
        [4, 8],
        [5, 10]
      ];
      const cov = Matrix.covariance(data);
      expect(cov[0][0]).toBeCloseTo(2.5, 6); // Variance of first variable
      expect(cov[1][1]).toBeCloseTo(10, 6); // Variance of second variable
      expect(cov[0][1]).toBeCloseTo(5, 6); // Covariance
      expect(cov[1][0]).toBeCloseTo(5, 6); // Symmetric
    });
  });
});

// Integration test
describe('Options Pricing Integration', () => {
  it('should maintain put-call parity', () => {
    const engine = new BlackScholesEngine(0.05);
    const S = 100, K = 100, T = 1, sigma = 0.2, r = 0.05;

    const callPrice = engine.calculatePrice({
      underlyingPrice: S,
      strikePrice: K,
      timeToExpiry: T,
      volatility: sigma,
      optionType: 'call'
    });

    const putPrice = engine.calculatePrice({
      underlyingPrice: S,
      strikePrice: K,
      timeToExpiry: T,
      volatility: sigma,
      optionType: 'put'
    });

    // Put-Call Parity: C - P = S - K*e^(-rT)
    const parity = callPrice - putPrice;
    const expected = S - K * Math.exp(-r * T);
    expect(parity).toBeCloseTo(expected, 6);
  });
});