/**
 * Glicko-2 Rating System Implementation
 * Based on: http://www.glicko.net/glicko/glicko2.pdf
 * 
 * The Glicko-2 system is an improvement over the original Glicko system,
 * adding a volatility parameter to track rating reliability changes over time.
 */

// ===========================
// Constants
// ===========================

/** System constant (constraint for volatility change) */
const TAU = 0.5;

/** Conversion scale between Glicko and Glicko-2 scales */
const GLICKO2_SCALE = 173.7178;

/** Default initial rating (Glicko scale) */
const DEFAULT_RATING = 1500.0;

/** Default initial rating deviation (Glicko scale) */
const DEFAULT_RD = 350.0;

/** Default initial volatility */
const DEFAULT_VOLATILITY = 0.06;

/** Maximum RD value (Glicko scale) */
const MAX_RD = 350.0;

/** RD increase per day of inactivity (approximation) */
const RD_INCREASE_PER_DAY = 0.5;

// ===========================
// Interfaces
// ===========================

/**
 * Represents a player in the Glicko-2 system
 */
export interface GlickoPlayer {
  /** Player's rating (μ) on Glicko scale (1500 default) */
  rating: number;
  /** Player's rating deviation (φ) on Glicko scale (350 default) */
  rd: number;
  /** Player's volatility (σ) - measure of rating consistency */
  volatility: number;
}

/**
 * Represents a match result for rating calculation
 */
export interface MatchResult {
  /** Opponent player */
  opponent: GlickoPlayer;
  /** Match score: 1 = win, 0.5 = draw, 0 = loss */
  score: number;
  /** Optional: piece score used by player (1-30) */
  playerPieceScore?: number;
  /** Optional: piece score used by opponent (1-30) */
  opponentPieceScore?: number;
}

/**
 * Represents the change in rating after a match
 */
export interface RatingChange {
  /** Rating before update */
  oldRating: number;
  /** Rating after update */
  newRating: number;
  /** RD before update */
  oldRd: number;
  /** RD after update */
  newRd: number;
  /** Volatility before update */
  oldVolatility: number;
  /** Volatility after update */
  newVolatility: number;
  /** Rating change (delta) */
  ratingDelta: number;
}

// ===========================
// Core Functions
// ===========================

/**
 * Creates a default player with initial Glicko-2 values
 */
export function createDefaultPlayer(): GlickoPlayer {
  return {
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    volatility: DEFAULT_VOLATILITY,
  };
}

/**
 * Converts rating from Glicko scale to Glicko-2 scale
 */
function toGlicko2Rating(rating: number): number {
  return (rating - 1500) / GLICKO2_SCALE;
}

/**
 * Converts rating from Glicko-2 scale to Glicko scale
 */
function toGlickoRating(mu: number): number {
  return mu * GLICKO2_SCALE + 1500;
}

/**
 * Converts RD from Glicko scale to Glicko-2 scale
 */
function toGlicko2RD(rd: number): number {
  return rd / GLICKO2_SCALE;
}

/**
 * Converts RD from Glicko-2 scale to Glicko scale
 */
function toGlickoRD(phi: number): number {
  return phi * GLICKO2_SCALE;
}

/**
 * The g function: measures the impact of opponent's RD on rating change
 * g(φ) = 1 / √(1 + 3φ²/π²)
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * The E function: calculates expected score against an opponent
 * E(μ, μⱼ, φⱼ) = 1 / (1 + exp(-g(φⱼ)(μ - μⱼ)))
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Calculates expected score (win probability) against an opponent
 * @returns Value between 0 and 1 representing expected score
 */
export function expectedScore(player: GlickoPlayer, opponent: GlickoPlayer): number {
  const mu = toGlicko2Rating(player.rating);
  const muJ = toGlicko2Rating(opponent.rating);
  const phiJ = toGlicko2RD(opponent.rd);
  
  return E(mu, muJ, phiJ);
}

/**
 * Step 3: Compute the quantity v (estimated variance of rating based on game outcomes)
 * v⁻¹ = Σⱼ g(φⱼ)² E(μ, μⱼ, φⱼ)(1 - E(μ, μⱼ, φⱼ))
 */
function computeV(mu: number, matches: MatchResult[]): number {
  let vInverse = 0;
  
  for (const match of matches) {
    const muJ = toGlicko2Rating(match.opponent.rating);
    const phiJ = toGlicko2RD(match.opponent.rd);
    const gPhiJ = g(phiJ);
    const eValue = E(mu, muJ, phiJ);
    
    vInverse += gPhiJ * gPhiJ * eValue * (1 - eValue);
  }
  
  return 1 / vInverse;
}

/**
 * Step 4: Compute the quantity Δ (estimated improvement in rating)
 * Δ = v Σⱼ g(φⱼ)(sⱼ - E(μ, μⱼ, φⱼ))
 */
function computeDelta(mu: number, v: number, matches: MatchResult[]): number {
  let sum = 0;
  
  for (const match of matches) {
    const muJ = toGlicko2Rating(match.opponent.rating);
    const phiJ = toGlicko2RD(match.opponent.rd);
    const gPhiJ = g(phiJ);
    const eValue = E(mu, muJ, phiJ);
    
    sum += gPhiJ * (match.score - eValue);
  }
  
  return v * sum;
}

/**
 * Step 5: Determine new volatility σ'
 * This is the most complex step, using iterative convergence
 */
function computeNewVolatility(
  phi: number,
  sigma: number,
  delta: number,
  v: number
): number {
  const a = Math.log(sigma * sigma);
  const deltaSq = delta * delta;
  const phiSq = phi * phi;
  
  // Define the f function for convergence
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num1 = ex * (deltaSq - phiSq - v - ex);
    const den1 = 2 * Math.pow(phiSq + v + ex, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  };
  
  // Initialize iteration
  let A = a;
  let B: number;
  
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k++;
    }
    B = a - k * TAU;
  }
  
  // Iterative algorithm to find the new volatility
  let fA = f(A);
  let fB = f(B);
  
  const epsilon = 0.000001;
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    
    B = C;
    fB = fC;
  }
  
  return Math.exp(A / 2);
}

/**
 * Step 6: Update rating deviation to new pre-rating period value
 * φ* = √(φ² + σ'²)
 */
function computeNewPhiStar(phi: number, newSigma: number): number {
  return Math.sqrt(phi * phi + newSigma * newSigma);
}

/**
 * Step 7: Update rating and RD based on competition outcomes
 * φ' = 1 / √(1/φ*² + 1/v)
 * μ' = μ + φ'² Σⱼ g(φⱼ)(sⱼ - E(μ, μⱼ, φⱼ))
 */
function computeNewRatingAndRD(
  mu: number,
  phiStar: number,
  v: number,
  matches: MatchResult[]
): { newMu: number; newPhi: number } {
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  
  let sum = 0;
  for (const match of matches) {
    const muJ = toGlicko2Rating(match.opponent.rating);
    const phiJ = toGlicko2RD(match.opponent.rd);
    const gPhiJ = g(phiJ);
    const eValue = E(mu, muJ, phiJ);
    
    sum += gPhiJ * (match.score - eValue);
  }
  
  const newMu = mu + newPhi * newPhi * sum;
  
  return { newMu, newPhi };
}

/**
 * Main function: Calculate rating change after a match or rating period
 * @param player Current player's Glicko-2 ratings
 * @param matches Array of match results in the rating period
 * @returns Updated ratings and change information
 */
export function calculateRatingChange(
  player: GlickoPlayer,
  matches: MatchResult[]
): RatingChange {
  const oldRating = player.rating;
  const oldRd = player.rd;
  const oldVolatility = player.volatility;
  
  // If no matches, just increase RD (inactivity)
  if (matches.length === 0) {
    const phiStar = computeNewPhiStar(toGlicko2RD(oldRd), oldVolatility);
    const newRd = Math.min(toGlickoRD(phiStar), MAX_RD);
    
    return {
      oldRating,
      newRating: oldRating,
      oldRd,
      newRd,
      oldVolatility,
      newVolatility: oldVolatility,
      ratingDelta: 0,
    };
  }
  
  // Convert to Glicko-2 scale
  const mu = toGlicko2Rating(player.rating);
  const phi = toGlicko2RD(player.rd);
  const sigma = player.volatility;
  
  // Step 3: Compute v
  const v = computeV(mu, matches);
  
  // Step 4: Compute delta
  const delta = computeDelta(mu, v, matches);
  
  // Step 5: Compute new volatility
  const newSigma = computeNewVolatility(phi, sigma, delta, v);
  
  // Step 6: Compute new phi*
  const phiStar = computeNewPhiStar(phi, newSigma);
  
  // Step 7: Compute new rating and RD
  const { newMu, newPhi } = computeNewRatingAndRD(mu, phiStar, v, matches);
  
  // Convert back to Glicko scale
  const newRating = toGlickoRating(newMu);
  const newRd = toGlickoRD(newPhi);
  
  return {
    oldRating,
    newRating,
    oldRd,
    newRd,
    oldVolatility,
    newVolatility: newSigma,
    ratingDelta: newRating - oldRating,
  };
}

/**
 * Update RD for player inactivity
 * The RD increases over time when a player doesn't play
 * @param player Current player ratings
 * @param daysSinceLastGame Number of days since last game
 * @returns Updated player with increased RD
 */
export function updateRdForInactivity(
  player: GlickoPlayer,
  daysSinceLastGame: number
): GlickoPlayer {
  if (daysSinceLastGame <= 0) {
    return { ...player };
  }
  
  // Calculate RD increase
  // More sophisticated approach: use the Glicko-2 formula for RD increase
  const phi = toGlicko2RD(player.rd);
  const sigma = player.volatility;
  
  // Approximate RD increase over time using rating period concept
  // Each rating period (e.g., 30 days) increases RD
  const ratingPeriods = daysSinceLastGame / 30; // Assume 30 days per rating period
  
  let newPhi = phi;
  for (let i = 0; i < Math.floor(ratingPeriods); i++) {
    newPhi = Math.sqrt(newPhi * newPhi + sigma * sigma);
  }
  
  // Add partial period if any
  const partialPeriod = ratingPeriods - Math.floor(ratingPeriods);
  if (partialPeriod > 0) {
    const partialIncrease = sigma * sigma * partialPeriod;
    newPhi = Math.sqrt(newPhi * newPhi + partialIncrease);
  }
  
  // Cap at maximum RD
  const newRd = Math.min(toGlickoRD(newPhi), MAX_RD);
  
  return {
    ...player,
    rd: newRd,
  };
}

/**
 * Calculate rating change with piece score adjustment
 * Higher piece score (stronger deck) reduces rating gain and increases rating loss
 * @param baseChange Base rating change from Glicko-2
 * @param playerPieceScore Player's piece score (1-30)
 * @param opponentPieceScore Opponent's piece score (1-30)
 * @returns Adjusted rating delta
 */
export function adjustRatingForPieceScore(
  baseChange: number,
  playerPieceScore?: number,
  opponentPieceScore?: number
): number {
  if (!playerPieceScore || !opponentPieceScore) {
    return baseChange;
  }
  
  // Calculate piece score difference (-29 to +29)
  const pieceScoreDiff = playerPieceScore - opponentPieceScore;
  
  // Adjustment factor: ranges from ~0.7 to ~1.3
  // If you have stronger pieces (+10 diff), your gain is reduced by ~15%
  // If you have weaker pieces (-10 diff), your gain is increased by ~15%
  const adjustmentFactor = 1 - (pieceScoreDiff / 100);
  
  // Apply adjustment (more pronounced for wins, less for losses)
  if (baseChange > 0) {
    // Winning with stronger pieces gives less rating
    return baseChange * adjustmentFactor;
  } else {
    // Losing with weaker pieces loses less rating
    return baseChange * (2 - adjustmentFactor);
  }
}

/**
 * Get rating tier/rank based on rating value
 */
export function getRatingTier(rating: number): string {
  if (rating >= 2400) return 'Grandmaster';
  if (rating >= 2200) return 'Master';
  if (rating >= 2000) return 'Expert';
  if (rating >= 1800) return 'Class A';
  if (rating >= 1600) return 'Class B';
  if (rating >= 1400) return 'Class C';
  if (rating >= 1200) return 'Class D';
  return 'Beginner';
}

/**
 * Export constants for use in other modules
 */
export const GLICKO_CONSTANTS = {
  TAU,
  GLICKO2_SCALE,
  DEFAULT_RATING,
  DEFAULT_RD,
  DEFAULT_VOLATILITY,
  MAX_RD,
  RD_INCREASE_PER_DAY,
};
