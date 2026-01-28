/**
 * Comprehensive tests for Glicko-2 Handicap System
 * 
 * Tests cover:
 * - Equal piece scores (30:30)
 * - Unequal piece scores (20:30, 30:20)
 * - Extreme handicaps (0:30, 30:0)
 * - Expected rating changes
 * - Boundary conditions
 */

import {
  calculateHandicapRatingChange,
  getExpectedRatingChanges,
  calculateHandicapModifier,
  MAX_PIECE_SCORE
} from './Glicko2Handicap';
import { GlickoPlayer, MatchResult } from './Glicko2';

describe('Glicko2 Handicap System', () => {
  describe('동일 기물 점수 (30:30)', () => {
    test('핸디캡 없이 정상 레이팅 계산', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 200,
          volatility: 0.06
        },
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        player,
        match,
        30, // 내 기물 점수
        30  // 상대 기물 점수
      );

      // 핸디캡 없으므로 일반 계산과 동일
      expect(result.newRating).toBeCloseTo(1525, 0);
      expect(result.ratingDelta).toBeCloseTo(25, 0);
    });

    test('무승부 시 레이팅 변화 없음', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 200,
          volatility: 0.06
        },
        score: 0.5
      };

      const result = calculateHandicapRatingChange(player, match, 30, 30);

      expect(result.newRating).toBeCloseTo(1500, 1);
    });
  });

  describe('기물 점수 차이 10점 (20:30)', () => {
    test('약자(20) 승리 시 보상', () => {
      const weakPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 200,
          volatility: 0.06
        },
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        weakPlayer,
        match,
        20, // 내가 불리 (20점)
        30  // 상대 유리 (30점)
      );

      // 불리한 상황에서 이겼으므로 보너스
      expect(result.newRating).toBeGreaterThan(1525);
      expect(result.ratingDelta).toBeGreaterThan(25);
    });

    test('약자(20) 패배 시 손실 완화', () => {
      const weakPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 200,
          volatility: 0.06
        },
        score: 0.0
      };

      const result = calculateHandicapRatingChange(
        weakPlayer,
        match,
        20, // 내가 불리
        30  // 상대 유리
      );

      // 불리한 상황이었으므로 손실 완화
      expect(result.newRating).toBeGreaterThan(1475);
      expect(result.ratingDelta).toBeGreaterThan(-25);
    });

    test('강자(30) 승리 시 보상 감소', () => {
      const strongPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        strongPlayer,
        match,
        30, // 내가 유리
        20  // 상대 불리
      );

      // 유리한 상황이었으므로 보상 감소
      expect(result.newRating).toBeLessThan(1525);
      expect(result.ratingDelta).toBeLessThan(25);
    });

    test('강자(30) 패배 시 손실 증가', () => {
      const strongPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 0.0
      };

      const result = calculateHandicapRatingChange(
        strongPlayer,
        match,
        30, // 내가 유리
        20  // 상대 불리
      );

      // 유리했는데 졌으므로 손실 증가
      expect(result.newRating).toBeLessThan(1475);
      expect(result.ratingDelta).toBeLessThan(-25);
    });
  });

  describe('기물 점수 차이 최대 (0:30)', () => {
    test('최약자(0) 승리 시 최대 보상', () => {
      const weakest: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        weakest,
        match,
        0,  // 최악의 덱
        30  // 최고의 덱
      );

      // 엄청난 보상
      expect(result.newRating).toBeGreaterThan(1540);
      expect(result.ratingDelta).toBeGreaterThan(35);
    });

    test('최약자(0) 패배 시 최소 손실', () => {
      const weakest: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 0.0
      };

      const result = calculateHandicapRatingChange(
        weakest,
        match,
        0,  // 최악의 덱
        30  // 최고의 덱
      );

      // 당연한 결과이므로 손실 최소화
      expect(result.newRating).toBeGreaterThan(1485);
      expect(result.ratingDelta).toBeGreaterThan(-15);
    });

    test('최강자(30) 승리 시 최소 보상', () => {
      const strongest: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        strongest,
        match,
        30, // 최고의 덱
        0   // 최악의 덱
      );

      // 당연한 승리이므로 보상 최소
      expect(result.newRating).toBeLessThan(1520);
      expect(result.ratingDelta).toBeLessThan(20);
    });

    test('최강자(30) 패배 시 최대 손실', () => {
      const strongest: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 0.0
      };

      const result = calculateHandicapRatingChange(
        strongest,
        match,
        30, // 최고의 덱
        0   // 최악의 덱
      );

      // 있을 수 없는 패배이므로 손실 최대
      expect(result.newRating).toBeLessThan(1465);
      expect(result.ratingDelta).toBeLessThan(-35);
    });
  });

  describe('핸디캡 모디파이어 계산', () => {
    test('동일 기물 점수는 0 모디파이어', () => {
      const modifier = calculateHandicapModifier(30, 30);
      expect(modifier).toBe(0);
    });

    test('10점 차이는 ±0.1 모디파이어', () => {
      const modifier = calculateHandicapModifier(20, 30);
      expect(modifier).toBeCloseTo(-0.1, 2);

      const reverseModifier = calculateHandicapModifier(30, 20);
      expect(reverseModifier).toBeCloseTo(0.1, 2);
    });

    test('최대 차이는 ±0.3 모디파이어', () => {
      const modifier = calculateHandicapModifier(0, 30);
      expect(modifier).toBeCloseTo(-0.3, 2);

      const reverseModifier = calculateHandicapModifier(30, 0);
      expect(reverseModifier).toBeCloseTo(0.3, 2);
    });
  });

  describe('예상 레이팅 변화', () => {
    test('20:30 매치업 예상 결과', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const opponent: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const expected = getExpectedRatingChanges(player, opponent, 20, 30);

      // 약자가 이기면 더 많이 받음
      expect(expected.playerWin).toBeGreaterThan(25);
      // 약자가 지면 덜 잃음
      expect(Math.abs(expected.playerLoss)).toBeLessThan(25);
      // 무승부는 약간 이득
      expect(expected.draw).toBeGreaterThan(0);
    });

    test('30:20 매치업 예상 결과', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const opponent: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const expected = getExpectedRatingChanges(player, opponent, 30, 20);

      // 강자가 이기면 덜 받음
      expect(expected.playerWin).toBeLessThan(25);
      // 강자가 지면 더 많이 잃음
      expect(Math.abs(expected.playerLoss)).toBeGreaterThan(25);
      // 무승부는 약간 손해
      expect(expected.draw).toBeLessThan(0);
    });
  });

  describe('실전 시나리오', () => {
    test('1500 vs 1600: 약자(20)가 강자(30)를 이김', () => {
      const weakPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 150,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1600,
        opponentRd: 120,
        score: 1.0
      };

      const result = calculateHandicapRatingChange(
        weakPlayer,
        match,
        20, // 약한 덱
        30  // 강한 덱
      );

      // 레이팅도 낮고 덱도 약한데 이김 → 큰 보상
      expect(result.newRating).toBeGreaterThan(1550);
    });

    test('여러 게임 후 핸디캡 누적 효과', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      // 5연승 (모두 약한 덱으로)
      for (let i = 0; i < 5; i++) {
        const match: GlickoMatch = {
          opponentRating: 1500,
          opponentRd: 150,
          score: 1.0
        };

        const result = calculateHandicapRatingChange(player, match, 20, 30);
        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      // 약한 덱으로 5연승했으므로 보너스 누적
      expect(player.rating).toBeGreaterThan(1630);
    });
  });

  describe('경계값 테스트', () => {
    test('음수 기물 점수는 0으로 처리', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 1.0
      };

      const result = calculateHandicapRatingChange(player, match, -5, 30);

      // -5는 0으로 처리됨
      expect(result.newRating).toBeGreaterThan(1520);
    });

    test('30 초과 기물 점수는 30으로 제한', () => {
      const player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: GlickoMatch = {
        opponentRating: 1500,
        opponentRd: 200,
        score: 1.0
      };

      const result1 = calculateHandicapRatingChange(player, match, 35, 30);
      const result2 = calculateHandicapRatingChange(player, match, 30, 30);

      // 35는 30으로 제한되어 동일 결과
      expect(result1.newRating).toBeCloseTo(result2.newRating, 1);
    });
  });
});
