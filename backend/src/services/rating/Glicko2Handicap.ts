/**
 * Glicko-2 Handicap System for MadChess
 * 
 * This module implements a handicap system based on piece scores.
 * Players can use up to 30 points worth of pieces, and using fewer
 * pieces provides a rating advantage.
 * 
 * Piece Values:
 * - King: 0 (required)
 * - Queen: 9
 * - Rook: 5
 * - Bishop: 3
 * - Knight: 3
 * - Pawn: 1
 */

import {
  GlickoPlayer,
  MatchResult,
  RatingChange,
  calculateRatingChange,
  expectedScore,
} from './Glicko2';

// ===========================
// Constants
// ===========================

/** Maximum piece score allowed */
export const MAX_PIECE_SCORE = 30;

/** Minimum practical piece score (King + minimal pieces) */
export const MIN_PIECE_SCORE = 1;

/** 
 * Handicap weight factor (0-1)
 * Higher values = stronger handicap effect
 * 0.3 means piece score difference has moderate impact
 */
export const HANDICAP_WEIGHT = 0.3;

// ===========================
// Interfaces
// ===========================

/**
 * Extended match result with piece scores
 */
export interface HandicapMatchResult extends MatchResult {
  playerPieceScore: number;
  opponentPieceScore: number;
}

/**
 * Handicap calculation details
 */
export interface HandicapInfo {
  /** Player's piece score */
  playerPieceScore: number;
  /** Opponent's piece score */
  opponentPieceScore: number;
  /** Piece score difference (positive = player has more) */
  pieceScoreDiff: number;
  /** Handicap modifier applied to score */
  handicapModifier: number;
  /** Base expected score without handicap */
  baseExpectedScore: number;
  /** Adjusted expected score with handicap */
  adjustedExpectedScore: number;
}

// ===========================
// Core Functions
// ===========================

/**
 * Calculate handicap modifier based on piece score difference
 * 
 * The modifier adjusts the expected score based on piece advantage:
 * - Positive diff (more pieces) = negative modifier (harder to gain rating)
 * - Negative diff (fewer pieces) = positive modifier (easier to gain rating)
 * 
 * @param playerPieceScore Player's total piece value (1-30)
 * @param opponentPieceScore Opponent's total piece value (1-30)
 * @returns Modifier value to adjust expected score (-0.3 to +0.3 with default weight)
 */
export function calculateHandicapModifier(
  playerPieceScore: number,
  opponentPieceScore: number
): number {
  // Validate inputs
  if (playerPieceScore < MIN_PIECE_SCORE || playerPieceScore > MAX_PIECE_SCORE) {
    throw new Error(`Player piece score must be between ${MIN_PIECE_SCORE} and ${MAX_PIECE_SCORE}`);
  }
  if (opponentPieceScore < MIN_PIECE_SCORE || opponentPieceScore > MAX_PIECE_SCORE) {
    throw new Error(`Opponent piece score must be between ${MIN_PIECE_SCORE} and ${MAX_PIECE_SCORE}`);
  }
  
  // Calculate normalized difference (-1 to +1)
  // Positive = player has advantage (more pieces)
  // Negative = player has disadvantage (fewer pieces)
  const maxDiff = MAX_PIECE_SCORE - MIN_PIECE_SCORE;
  const pieceScoreDiff = (playerPieceScore - opponentPieceScore) / maxDiff;
  
  // Apply handicap weight
  // The modifier is inverted: having more pieces (advantage) gives negative modifier
  // This makes it harder to gain rating when you have stronger pieces
  const modifier = -pieceScoreDiff * HANDICAP_WEIGHT;
  
  return modifier;
}

/**
 * Get adjusted score for Glicko-2 calculation with handicap
 * 
 * This adjusts the actual game outcome (0, 0.5, 1) based on piece handicap.
 * The adjustment makes outcomes "more expected" when you have piece advantage,
 * and "less expected" when you have piece disadvantage.
 * 
 * @param baseScore Actual game score (1 = win, 0.5 = draw, 0 = loss)
 * @param playerPieceScore Player's piece score
 * @param opponentPieceScore Opponent's piece score
 * @returns Adjusted score for rating calculation (still in 0-1 range)
 */
export function getAdjustedScore(
  baseScore: number,
  playerPieceScore: number,
  opponentPieceScore: number
): number {
  // Get handicap modifier
  const modifier = calculateHandicapModifier(playerPieceScore, opponentPieceScore);
  
  // Adjust the score based on handicap
  // The logic:
  // - If you have more pieces (modifier < 0), your effective score decreases
  //   (win counts less, loss counts more)
  // - If you have fewer pieces (modifier > 0), your effective score increases
  //   (win counts more, loss counts less)
  let adjustedScore = baseScore + modifier;
  
  // Clamp to valid range [0, 1]
  adjustedScore = Math.max(0, Math.min(1, adjustedScore));
  
  return adjustedScore;
}

/**
 * Calculate rating change with handicap applied
 * 
 * This is the main function that combines Glicko-2 rating calculation
 * with piece score handicap adjustments.
 * 
 * @param player Current player's Glicko ratings
 * @param match Match result with piece scores
 * @returns Rating change with handicap applied
 */
export function calculateHandicapRatingChange(
  player: GlickoPlayer,
  match: HandicapMatchResult
): RatingChange {
  // Validate piece scores
  if (!match.playerPieceScore || !match.opponentPieceScore) {
    throw new Error('Piece scores are required for handicap calculation');
  }
  
  // Calculate base expected score (without handicap)
  const baseExpectedScore = expectedScore(player, match.opponent);
  
  // Get adjusted score with handicap
  const adjustedScore = getAdjustedScore(
    match.score,
    match.playerPieceScore,
    match.opponentPieceScore
  );
  
  // Create adjusted match result for Glicko-2 calculation
  const adjustedMatch: MatchResult = {
    opponent: match.opponent,
    score: adjustedScore,
    playerPieceScore: match.playerPieceScore,
    opponentPieceScore: match.opponentPieceScore,
  };
  
  // Calculate rating change using adjusted score
  const ratingChange = calculateRatingChange(player, [adjustedMatch]);
  
  return ratingChange;
}

/**
 * Get detailed handicap information for a match
 * 
 * Useful for debugging and displaying handicap effects to users
 * 
 * @param player Player's ratings
 * @param opponent Opponent's ratings
 * @param playerPieceScore Player's piece score
 * @param opponentPieceScore Opponent's piece score
 * @returns Detailed handicap calculation info
 */
export function getHandicapInfo(
  player: GlickoPlayer,
  opponent: GlickoPlayer,
  playerPieceScore: number,
  opponentPieceScore: number
): HandicapInfo {
  const pieceScoreDiff = playerPieceScore - opponentPieceScore;
  const handicapModifier = calculateHandicapModifier(playerPieceScore, opponentPieceScore);
  const baseExpectedScore = expectedScore(player, opponent);
  
  // Calculate adjusted expected score
  // This shows what the "break-even" point is with handicap
  let adjustedExpectedScore = baseExpectedScore + handicapModifier;
  adjustedExpectedScore = Math.max(0, Math.min(1, adjustedExpectedScore));
  
  return {
    playerPieceScore,
    opponentPieceScore,
    pieceScoreDiff,
    handicapModifier,
    baseExpectedScore,
    adjustedExpectedScore,
  };
}

/**
 * Calculate expected rating changes for different outcomes
 * 
 * This is useful for showing players what they can gain/lose
 * before a match starts.
 * 
 * @param player Player's current ratings
 * @param opponent Opponent's ratings
 * @param playerPieceScore Player's piece score
 * @param opponentPieceScore Opponent's piece score
 * @returns Expected rating changes for win/draw/loss
 */
export function getExpectedRatingChanges(
  player: GlickoPlayer,
  opponent: GlickoPlayer,
  playerPieceScore: number,
  opponentPieceScore: number
): {
  win: number;
  draw: number;
  loss: number;
  handicapInfo: HandicapInfo;
} {
  // Calculate for win
  const winMatch: HandicapMatchResult = {
    opponent,
    score: 1.0,
    playerPieceScore,
    opponentPieceScore,
  };
  const winChange = calculateHandicapRatingChange(player, winMatch);
  
  // Calculate for draw
  const drawMatch: HandicapMatchResult = {
    opponent,
    score: 0.5,
    playerPieceScore,
    opponentPieceScore,
  };
  const drawChange = calculateHandicapRatingChange(player, drawMatch);
  
  // Calculate for loss
  const lossMatch: HandicapMatchResult = {
    opponent,
    score: 0.0,
    playerPieceScore,
    opponentPieceScore,
  };
  const lossChange = calculateHandicapRatingChange(player, lossMatch);
  
  // Get handicap info
  const handicapInfo = getHandicapInfo(player, opponent, playerPieceScore, opponentPieceScore);
  
  return {
    win: winChange.ratingDelta,
    draw: drawChange.ratingDelta,
    loss: lossChange.ratingDelta,
    handicapInfo,
  };
}

/**
 * Validate piece score against game rules
 * 
 * @param pieceScore Total piece value
 * @returns true if valid, false otherwise
 */
export function isValidPieceScore(pieceScore: number): boolean {
  return pieceScore >= MIN_PIECE_SCORE && pieceScore <= MAX_PIECE_SCORE;
}

/**
 * Calculate piece score from deck composition
 * 
 * This helper function calculates total piece value from a deck.
 * Piece values should come from the database.
 * 
 * @param pieces Array of piece values
 * @returns Total piece score
 */
export function calculateTotalPieceScore(pieces: number[]): number {
  return pieces.reduce((sum, value) => sum + value, 0);
}

/**
 * Get handicap advantage description for UI
 * 
 * @param pieceScoreDiff Piece score difference (player - opponent)
 * @returns Human-readable description
 */
export function getHandicapDescription(pieceScoreDiff: number): string {
  if (pieceScoreDiff === 0) {
    return 'Equal material';
  }
  
  const absDiff = Math.abs(pieceScoreDiff);
  const advantage = pieceScoreDiff > 0 ? 'advantage' : 'disadvantage';
  
  if (absDiff <= 3) {
    return `Slight ${advantage} (${absDiff} points)`;
  } else if (absDiff <= 7) {
    return `Moderate ${advantage} (${absDiff} points)`;
  } else if (absDiff <= 12) {
    return `Significant ${advantage} (${absDiff} points)`;
  } else {
    return `Large ${advantage} (${absDiff} points)`;
  }
}

/**
 * Piece value constants for reference
 */
export const PIECE_VALUES = {
  KING: 0,
  QUEEN: 9,
  ROOK: 5,
  BISHOP: 3,
  KNIGHT: 3,
  PAWN: 1,
} as const;

/**
 * Export configuration for external adjustment
 */
export const HANDICAP_CONFIG = {
  MAX_PIECE_SCORE,
  MIN_PIECE_SCORE,
  HANDICAP_WEIGHT,
  PIECE_VALUES,
} as const;
