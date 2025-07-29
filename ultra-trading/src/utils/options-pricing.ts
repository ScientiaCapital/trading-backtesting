/**
 * Options Mathematics Utilities
 * TypeScript implementations of mathematical functions for options pricing
 * Replaces scipy.stats and scipy.optimize functionality
 */

/**
 * Normal distribution functions (replaces scipy.stats.norm)
 */
export class NormalDistribution {
  /**
   * Cumulative distribution function (CDF) for standard normal distribution
   * Uses Abramowitz and Stegun approximation
   */
  static cdf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Probability density function (PDF) for standard normal distribution
   */
  static pdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Inverse CDF (quantile function) using rational approximation
   */
  static inverseCdf(p: number): number {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }

    // Coefficients for rational approximation
    const a = [
      -3.969683028665376e1,
      2.209460984245205e2,
      -2.759285104469687e2,
      1.383577518672690e2,
      -3.066479806614716e1,
      2.506628277459239e0
    ];

    const b = [
      -5.447609879822406e1,
      1.615858368580409e2,
      -1.556989798598866e2,
      6.680131188771972e1,
      -1.328068155288572e1
    ];

    const c = [
      -7.784894002430293e-3,
      -3.223964580411365e-1,
      -2.400758277161838e0,
      -2.549732539343734e0,
      4.374664141464968e0,
      2.938163982698783e0
    ];

    const d = [
      7.784695709041462e-3,
      3.224671290700398e-1,
      2.445134137142996e0,
      3.754408661907416e0
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number, r: number;

    if (p < pLow) {
      // Rational approximation for lower region
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    } else if (p <= pHigh) {
      // Rational approximation for central region
      q = p - 0.5;
      r = q * q;
      return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
        (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
    } else {
      // Rational approximation for upper region
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    }
  }
}

/**
 * Root finding algorithms (replaces scipy.optimize)
 */
export class Optimization {
  /**
   * Brent's method for finding roots of a function
   * Replaces scipy.optimize.brentq
   */
  static brentq(
    func: (x: number) => number,
    a: number,
    b: number,
    options: {
      tolerance?: number;
      maxIterations?: number;
    } = {}
  ): number {
    const { tolerance = 1e-6, maxIterations = 100 } = options;

    let fa = func(a);
    let fb = func(b);

    if (fa * fb > 0) {
      throw new Error('Root is not bracketed');
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }

    let c = a;
    let fc = fa;
    let s = 0;
    let d = 0;
    let flag = true;

    for (let i = 0; i < maxIterations; i++) {
      if (Math.abs(b - a) < tolerance) {
        return b;
      }

      if (fa !== fc && fb !== fc) {
        // Inverse quadratic interpolation
        s = (a * fb * fc) / ((fa - fb) * (fa - fc)) +
            (b * fa * fc) / ((fb - fa) * (fb - fc)) +
            (c * fa * fb) / ((fc - fa) * (fc - fb));
      } else {
        // Secant method
        s = b - fb * (b - a) / (fb - fa);
      }

      // Conditions for accepting interpolation
      const tmp = (3 * a + b) / 4;
      if (
        !(((s > tmp) && (s < b)) || ((s < tmp) && (s > b))) ||
        (flag && Math.abs(s - b) >= Math.abs(b - c) / 2) ||
        (!flag && Math.abs(s - b) >= Math.abs(c - d) / 2) ||
        (flag && Math.abs(b - c) < tolerance) ||
        (!flag && Math.abs(c - d) < tolerance)
      ) {
        // Bisection method
        s = (a + b) / 2;
        flag = true;
      } else {
        flag = false;
      }

      const fs = func(s);
      d = c;
      c = b;
      fc = fb;

      if (fa * fs < 0) {
        b = s;
        fb = fs;
      } else {
        a = s;
        fa = fs;
      }

      if (Math.abs(fa) < Math.abs(fb)) {
        [a, b] = [b, a];
        [fa, fb] = [fb, fa];
      }
    }

    throw new Error('Maximum iterations reached');
  }

  /**
   * Newton-Raphson method for finding roots
   * Useful when derivative is available
   */
  static newtonRaphson(
    func: (x: number) => number,
    derivative: (x: number) => number,
    initialGuess: number,
    options: {
      tolerance?: number;
      maxIterations?: number;
    } = {}
  ): number {
    const { tolerance = 1e-6, maxIterations = 50 } = options;
    
    let x = initialGuess;
    
    for (let i = 0; i < maxIterations; i++) {
      const fx = func(x);
      
      if (Math.abs(fx) < tolerance) {
        return x;
      }
      
      const fpx = derivative(x);
      
      if (Math.abs(fpx) < 1e-10) {
        throw new Error('Derivative too small, cannot continue');
      }
      
      const xNew = x - fx / fpx;
      
      if (Math.abs(xNew - x) < tolerance) {
        return xNew;
      }
      
      x = xNew;
    }
    
    throw new Error('Maximum iterations reached');
  }

  /**
   * Golden section search for finding minimum of unimodal function
   */
  static goldenSectionSearch(
    func: (x: number) => number,
    a: number,
    b: number,
    tolerance = 1e-5
  ): { x: number; value: number } {
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const resphi = 2 - phi;

    // To ensure that the tolerance is not exceeded
    const tol = tolerance * Math.abs(b - a);

    let x1 = a + resphi * (b - a);
    let x2 = b - resphi * (b - a);
    let f1 = func(x1);
    let f2 = func(x2);

    while (Math.abs(b - a) > tol) {
      if (f1 < f2) {
        b = x2;
        x2 = x1;
        f2 = f1;
        x1 = a + resphi * (b - a);
        f1 = func(x1);
      } else {
        a = x1;
        x1 = x2;
        f1 = f2;
        x2 = b - resphi * (b - a);
        f2 = func(x2);
      }
    }

    const x = (a + b) / 2;
    return { x, value: func(x) };
  }
}

/**
 * Black-Scholes Options Pricing Engine
 */
export class BlackScholesEngine {
  constructor(private riskFreeRate: number) {}

  /**
   * Calculate option price using Black-Scholes formula
   */
  calculatePrice(params: {
    underlyingPrice: number;
    strikePrice: number;
    timeToExpiry: number;
    volatility: number;
    optionType: 'call' | 'put';
  }): number {
    const { underlyingPrice: S, strikePrice: K, timeToExpiry: T, volatility: sigma, optionType } = params;
    
    if (T <= 0) return Math.max(0, optionType === 'call' ? S - K : K - S);
    
    const d1 = this.calculateD1(S, K, T, sigma);
    const d2 = d1 - sigma * Math.sqrt(T);
    
    if (optionType === 'call') {
      return S * NormalDistribution.cdf(d1) - K * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(d2);
    } else {
      return K * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(-d2) - S * NormalDistribution.cdf(-d1);
    }
  }

  /**
   * Calculate all Greeks
   */
  calculateGreeks(params: {
    underlyingPrice: number;
    strikePrice: number;
    timeToExpiry: number;
    volatility: number;
    optionType: 'call' | 'put';
  }): Greeks {
    const { underlyingPrice: S, strikePrice: K, timeToExpiry: T, volatility: sigma, optionType } = params;
    
    if (T <= 0) {
      return {
        delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      };
    }
    
    const d1 = this.calculateD1(S, K, T, sigma);
    const d2 = d1 - sigma * Math.sqrt(T);
    const sqrtT = Math.sqrt(T);
    
    // Delta
    const delta = optionType === 'call' ? NormalDistribution.cdf(d1) : -NormalDistribution.cdf(-d1);
    
    // Gamma (same for calls and puts)
    const gamma = NormalDistribution.pdf(d1) / (S * sigma * sqrtT);
    
    // Theta
    const theta = this.calculateTheta(S, K, T, sigma, d1, d2, optionType);
    
    // Vega (same for calls and puts)
    const vega = S * NormalDistribution.pdf(d1) * sqrtT / 100; // Divided by 100 for 1% volatility change
    
    // Rho
    const rho = this.calculateRho(K, T, d2, optionType) / 100; // Divided by 100 for 1% rate change
    
    return { delta, gamma, theta, vega, rho };
  }

  private calculateD1(S: number, K: number, T: number, sigma: number): number {
    return (Math.log(S / K) + (this.riskFreeRate + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  }

  private calculateTheta(
    S: number,
    K: number,
    T: number,
    sigma: number,
    d1: number,
    d2: number,
    optionType: 'call' | 'put'
  ): number {
    const term1 = -(S * NormalDistribution.pdf(d1) * sigma) / (2 * Math.sqrt(T));
    
    if (optionType === 'call') {
      const term2 = this.riskFreeRate * K * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(d2);
      return (term1 - term2) / 365; // Daily theta
    } else {
      const term2 = this.riskFreeRate * K * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(-d2);
      return (term1 + term2) / 365; // Daily theta
    }
  }

  private calculateRho(K: number, T: number, d2: number, optionType: 'call' | 'put'): number {
    if (optionType === 'call') {
      return K * T * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(d2);
    } else {
      return -K * T * Math.exp(-this.riskFreeRate * T) * NormalDistribution.cdf(-d2);
    }
  }
}

/**
 * Calculate implied volatility using Newton-Raphson method
 */
export function calculateImpliedVolatility(params: {
  optionPrice: number;
  underlyingPrice: number;
  strikePrice: number;
  timeToExpiry: number;
  riskFreeRate: number;
  optionType: 'call' | 'put';
  initialGuess?: number;
}): number {
  const { optionPrice, underlyingPrice, strikePrice, timeToExpiry, riskFreeRate, optionType, initialGuess = 0.3 } = params;
  
  // Handle edge cases
  if (timeToExpiry <= 0) return 0;
  
  const intrinsicValue = optionType === 'call' 
    ? Math.max(0, underlyingPrice - strikePrice)
    : Math.max(0, strikePrice - underlyingPrice);
    
  if (optionPrice <= intrinsicValue) return 0;
  
  const bsEngine = new BlackScholesEngine(riskFreeRate);
  
  // Function to find root of
  const priceError = (sigma: number): number => {
    const theoreticalPrice = bsEngine.calculatePrice({
      underlyingPrice,
      strikePrice,
      timeToExpiry,
      volatility: sigma,
      optionType
    });
    return theoreticalPrice - optionPrice;
  };
  
  // Vega for Newton-Raphson
  const vega = (sigma: number): number => {
    const d1 = (Math.log(underlyingPrice / strikePrice) + (riskFreeRate + 0.5 * sigma * sigma) * timeToExpiry) / 
                (sigma * Math.sqrt(timeToExpiry));
    return underlyingPrice * NormalDistribution.pdf(d1) * Math.sqrt(timeToExpiry);
  };
  
  try {
    // Try Newton-Raphson first (faster)
    return Optimization.newtonRaphson(priceError, vega, initialGuess, {
      tolerance: 1e-6,
      maxIterations: 50
    });
  } catch {
    // Fall back to Brent's method (more robust)
    return Optimization.brentq(priceError, 0.001, 5.0, {
      tolerance: 1e-6,
      maxIterations: 100
    });
  }
}

/**
 * Greeks interface
 */
export interface Greeks {
  delta: number;  // Rate of change of option price with respect to underlying price
  gamma: number;  // Rate of change of delta with respect to underlying price
  theta: number;  // Rate of change of option price with respect to time (per day)
  vega: number;   // Rate of change of option price with respect to volatility (per 1% change)
  rho: number;    // Rate of change of option price with respect to interest rate (per 1% change)
}

/**
 * Statistical utilities
 */
export class Statistics {
  /**
   * Calculate mean of an array
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[], sample = true): number {
    if (values.length === 0) return 0;
    
    const avg = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / 
                          (sample ? values.length - 1 : values.length);
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate correlation coefficient
   */
  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      throw new Error('Arrays must have same non-zero length');
    }

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = (x[i] || 0) - meanX;
      const dy = (y[i] || 0) - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    if (p <= 0) return Math.min(...values);
    if (p >= 100) return Math.max(...values);

    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sorted[lower]!;
    }

    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }
}

/**
 * Matrix operations for portfolio calculations
 */
export class Matrix {
  /**
   * Matrix multiplication
   */
  static multiply(a: number[][], b: number[][]): number[][] {
    const rowsA = a.length;
    const colsA = a[0]!.length;
    const colsB = b[0]!.length;

    if (colsA !== b.length) {
      throw new Error('Invalid matrix dimensions for multiplication');
    }

    const result: number[][] = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));

    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i]![j]! += a[i]![k]! * b[k]![j]!;
        }
      }
    }

    return result;
  }

  /**
   * Calculate covariance matrix
   */
  static covariance(data: number[][]): number[][] {
    const n = data.length;
    const m = data[0]!.length;
    
    // Calculate means
    const means = Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        means[j]! += data[i]![j]!;
      }
      means[j]! /= n;
    }

    // Calculate covariance matrix
    const cov: number[][] = Array(m).fill(null).map(() => Array(m).fill(0));
    
    for (let i = 0; i < m; i++) {
      for (let j = i; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += (data[k]![i]! - means[i]!) * (data[k]![j]! - means[j]!);
        }
        cov[i]![j] = cov[j]![i] = sum / (n - 1);
      }
    }

    return cov;
  }
}