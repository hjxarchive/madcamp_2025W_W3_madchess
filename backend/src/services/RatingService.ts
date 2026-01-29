/**
 * Rating Service
 * 
 * Integrates Glicko-2 rating system with game logic.
 * Handles rating updates after matches and RD increases for inactive players.
 */

import prisma from '../utils/prisma.js';
import {
  GlickoPlayer,
  createDefaultPlayer,
  updateRdForInactivity,
} from './rating/Glicko2';
import {
  calculateHandicapRatingChange,
  HandicapMatchResult,
  calculateTotalPieceScore,
} from './rating/Glicko2Handicap';

// ===========================
// Interfaces
// ===========================

/**
 * Player information for rating update
 */
interface PlayerMatchInfo {
  userId: number;
  pieceScore: number;
  deckId: number;
}

/**
 * Rating update result
 */
export interface RatingUpdateResult {
  success: boolean;
  gameId?: number;
  white: {
    userId: number;
    oldRating: number;
    newRating: number;
    ratingDelta: number;
    oldRd: number;
    newRd: number;
    oldVolatility: number;
    newVolatility: number;
  };
  black: {
    userId: number;
    oldRating: number;
    newRating: number;
    ratingDelta: number;
    oldRd: number;
    newRd: number;
    oldVolatility: number;
    newVolatility: number;
  };
  error?: string;
}

// ===========================
// RatingService Class
// ===========================

export class RatingService {
  /**
   * Update ratings after a match ends
   * 
   * @param matchId Match ID (used for logging, not DB lookup)
   * @param winnerId Winner's user ID, or null for draw
   * @param whitePlayer White player information
   * @param blackPlayer Black player information
   * @param pgn Game PGN (optional)
   * @returns Rating update result
   */
  async updateRatingsAfterMatch(
    matchId: string,
    winnerId: number | null,
    whitePlayer: PlayerMatchInfo,
    blackPlayer: PlayerMatchInfo,
    pgn?: string
  ): Promise<RatingUpdateResult> {
    try {
      console.log(`📊 Calculating ratings for match ${matchId}...`);
      console.log(`   White: User ${whitePlayer.userId} (${whitePlayer.pieceScore} pts)`);
      console.log(`   Black: User ${blackPlayer.userId} (${blackPlayer.pieceScore} pts)`);
      console.log(`   Winner: ${winnerId === null ? 'Draw' : `User ${winnerId}`}`);

      // 1. Fetch current ratings from database
      const [whiteUser, blackUser] = await Promise.all([
        this.getPlayerRating(whitePlayer.userId),
        this.getPlayerRating(blackPlayer.userId),
      ]);

      // 2. Determine match scores
      let whiteScore: number;
      let blackScore: number;

      if (winnerId === null) {
        // Draw
        whiteScore = 0.5;
        blackScore = 0.5;
      } else if (winnerId === whitePlayer.userId) {
        // White wins
        whiteScore = 1.0;
        blackScore = 0.0;
      } else {
        // Black wins
        whiteScore = 0.0;
        blackScore = 1.0;
      }

      // 3. Calculate rating changes with handicap
      const whiteMatch: HandicapMatchResult = {
        opponent: blackUser,
        score: whiteScore,
        playerPieceScore: whitePlayer.pieceScore,
        opponentPieceScore: blackPlayer.pieceScore,
      };

      const blackMatch: HandicapMatchResult = {
        opponent: whiteUser,
        score: blackScore,
        playerPieceScore: blackPlayer.pieceScore,
        opponentPieceScore: whitePlayer.pieceScore,
      };

      const whiteChange = calculateHandicapRatingChange(whiteUser, whiteMatch);
      const blackChange = calculateHandicapRatingChange(blackUser, blackMatch);

      console.log(`   White rating: ${whiteChange.oldRating.toFixed(1)} → ${whiteChange.newRating.toFixed(1)} (${whiteChange.ratingDelta >= 0 ? '+' : ''}${whiteChange.ratingDelta.toFixed(1)})`);
      console.log(`   Black rating: ${blackChange.oldRating.toFixed(1)} → ${blackChange.newRating.toFixed(1)} (${blackChange.ratingDelta >= 0 ? '+' : ''}${blackChange.ratingDelta.toFixed(1)})`);

      // 4. Update database
      const now = new Date();

      const game = await prisma.$transaction(async (tx: any) => {
        // Update white player
        await tx.user.update({
          where: { id: whitePlayer.userId },
          data: {
            rating: Math.round(whiteChange.newRating),
            rd: Math.round(whiteChange.newRd),
            volatility: whiteChange.newVolatility,
            last_game_at: now,
          },
        });

        // Update black player
        await tx.user.update({
          where: { id: blackPlayer.userId },
          data: {
            rating: Math.round(blackChange.newRating),
            rd: Math.round(blackChange.newRd),
            volatility: blackChange.newVolatility,
            last_game_at: now,
          },
        });

        // Determine game result string
        let gameResult: string;
        if (winnerId === null) {
          gameResult = 'draw';
        } else if (winnerId === whitePlayer.userId) {
          gameResult = 'white_win';
        } else {
          gameResult = 'black_win';
        }

        // Create game record
        const game = await tx.game.create({
          data: {
            user_game_white_player_idTouser: { connect: { id: whitePlayer.userId } },
            user_game_black_player_idTouser: { connect: { id: blackPlayer.userId } },
            deck_game_white_deck_idTodeck: { connect: { id: whitePlayer.deckId } },
            deck_game_black_deck_idTodeck: { connect: { id: blackPlayer.deckId } },
            result: gameResult,
            pgn: pgn || null,
            rating_changes: {
              white: {
                userId: whitePlayer.userId,
                before: {
                  rating: whiteChange.oldRating,
                  ratingDeviation: whiteChange.oldRd,
                  volatility: whiteChange.oldVolatility,
                },
                after: {
                  rating: whiteChange.newRating,
                  ratingDeviation: whiteChange.newRd,
                  volatility: whiteChange.newVolatility,
                },
                change: whiteChange.ratingDelta,
              },
              black: {
                userId: blackPlayer.userId,
                before: {
                  rating: blackChange.oldRating,
                  ratingDeviation: blackChange.oldRd,
                  volatility: blackChange.oldVolatility,
                },
                after: {
                  rating: blackChange.newRating,
                  ratingDeviation: blackChange.newRd,
                  volatility: blackChange.newVolatility,
                },
                change: blackChange.ratingDelta,
              },
            },
          },
        });

        // Create game history records
        const whiteResult = winnerId === null ? 'draw' : winnerId === whitePlayer.userId ? 'win' : 'lose';
        const blackResult = winnerId === null ? 'draw' : winnerId === blackPlayer.userId ? 'win' : 'lose';

        await tx.game_history.create({
          data: {
            user_id: whitePlayer.userId,
            game_id: game.id,
            role: 'white',
            result: whiteResult,
            rating_change: whiteChange.ratingDelta,
            piece_score: whitePlayer.pieceScore,
          },
        });

        await tx.game_history.create({
          data: {
            user_id: blackPlayer.userId,
            game_id: game.id,
            role: 'black',
            result: blackResult,
            rating_change: blackChange.ratingDelta,
            piece_score: blackPlayer.pieceScore,
          },
        });

        console.log(`✅ Game ${game.id} saved with rating updates`);
        return game;
      });

      return {
        success: true,
        gameId: game.id,
        white: {
          userId: whitePlayer.userId,
          oldRating: whiteChange.oldRating,
          newRating: whiteChange.newRating,
          ratingDelta: whiteChange.ratingDelta,
          oldRd: whiteChange.oldRd,
          newRd: whiteChange.newRd,
          oldVolatility: whiteChange.oldVolatility,
          newVolatility: whiteChange.newVolatility,
        },
        black: {
          userId: blackPlayer.userId,
          oldRating: blackChange.oldRating,
          newRating: blackChange.newRating,
          ratingDelta: blackChange.ratingDelta,
          oldRd: blackChange.oldRd,
          newRd: blackChange.newRd,
          oldVolatility: blackChange.oldVolatility,
          newVolatility: blackChange.newVolatility,
        },
      };
    } catch (error) {
      console.error('❌ Error updating ratings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        white: {
          userId: whitePlayer.userId,
          oldRating: 0,
          newRating: 0,
          ratingDelta: 0,
          oldRd: 0,
          newRd: 0,
          oldVolatility: 0,
          newVolatility: 0,
        },
        black: {
          userId: blackPlayer.userId,
          oldRating: 0,
          newRating: 0,
          ratingDelta: 0,
          oldRd: 0,
          newRd: 0,
          oldVolatility: 0,
          newVolatility: 0,
        },
      };
    }
  }

  /**
   * Get player's current rating from database
   * 
   * @param userId User ID
   * @returns Player's Glicko-2 ratings
   */
  async getPlayerRating(userId: number): Promise<GlickoPlayer> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          rating: true,
          rd: true,
          volatility: true,
          last_game_at: true,
        },
      });

      if (!user) {
        console.warn(`⚠️ User ${userId} not found, using default rating`);
        return createDefaultPlayer();
      }

      // Handle RD increase for inactivity
      let currentRating = user.rating;
      let currentRd = user.rd;
      let currentVolatility = user.volatility;

      if (user.last_game_at) {
        const daysSinceLastGame = Math.floor(
          (Date.now() - user.last_game_at.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastGame > 0) {
          const player: GlickoPlayer = {
            rating: currentRating,
            rd: currentRd,
            volatility: currentVolatility,
          };

          const updatedPlayer = updateRdForInactivity(player, daysSinceLastGame);
          currentRd = updatedPlayer.rd;

          console.log(`   User ${userId} inactive for ${daysSinceLastGame} days, RD: ${user.rd.toFixed(1)} → ${currentRd.toFixed(1)}`);
        }
      }

      return {
        rating: currentRating,
        rd: currentRd,
        volatility: currentVolatility,
      };
    } catch (error) {
      console.error(`❌ Error fetching rating for user ${userId}:`, error);
      return createDefaultPlayer();
    }
  }

  /**
   * Calculate piece score from deck composition
   * 
   * @param deckId Deck ID
   * @returns Total piece score
   */
  async calculateDeckPieceScore(deckId: number): Promise<number> {
    try {
      const deck = await prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          deck_composition: {
            include: {
              piece: true,
            },
          },
        },
      });

      if (!deck) {
        console.warn(`⚠️ Deck ${deckId} not found, using default piece score 30`);
        return 30;
      }

      const pieceValues = deck.deck_composition.map((comp: any) => comp.piece.value);
      const totalScore = calculateTotalPieceScore(pieceValues);

      console.log(`   Deck ${deckId} piece score: ${totalScore}`);
      return totalScore;
    } catch (error) {
      console.error(`❌ Error calculating piece score for deck ${deckId}:`, error);
      return 30; // Default to max score on error
    }
  }

  /**
   * Update RD for inactive players (batch job)
   * 
   * This should be run periodically (e.g., daily) to update RD for players
   * who haven't played in a while.
   */
  async updateInactivePlayersRd(): Promise<void> {
    try {
      console.log('🔄 Updating RD for inactive players...');

      // Find players who haven't played in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const inactivePlayers = await prisma.user.findMany({
        where: {
          OR: [
            { last_game_at: { lt: thirtyDaysAgo } },
            { last_game_at: null },
          ],
        },
        select: {
          id: true,
          rating: true,
          rd: true,
          volatility: true,
          last_game_at: true,
        },
      });

      console.log(`   Found ${inactivePlayers.length} inactive players`);

      let updatedCount = 0;

      for (const user of inactivePlayers) {
        const daysSinceLastGame = user.last_game_at
          ? Math.floor((Date.now() - user.last_game_at.getTime()) / (1000 * 60 * 60 * 24))
          : 365; // Default to 1 year for new players

        const player: GlickoPlayer = {
          rating: user.rating,
          rd: user.rd,
          volatility: user.volatility,
        };

        const updatedPlayer = updateRdForInactivity(player, daysSinceLastGame);

        // Only update if RD has changed significantly
        if (Math.abs(updatedPlayer.rd - user.rd) > 0.5) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              rd: updatedPlayer.rd,
            },
          });

          updatedCount++;
        }
      }

      console.log(`✅ Updated RD for ${updatedCount} players`);
    } catch (error) {
      console.error('❌ Error updating inactive players RD:', error);
    }
  }
}

// Export singleton instance
export const ratingService = new RatingService();
