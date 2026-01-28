/**
 * Integration tests for RatingService
 * 
 * Tests cover:
 * - Inactive player RD increase
 * - 10-win streak rating progression
 * - Real-world match scenarios
 * - Edge cases and error handling
 */

import {
  GlickoPlayer,
  calculateRatingChange,
  updateRdForInactivity,
} from './rating/Glicko2';

import {
  calculateHandicapRatingChange,
  getExpectedRatingChanges,
} from './rating/Glicko2Handicap';

describe('RatingService Integration Tests', () => {
  describe('비활동 플레이어 RD 증가', () => {
    test('30일 비활동 후 RD 증가', () => {
      const player: GlickoPlayer = {
        rating: 1600,
        rd: 80,
        volatility: 0.06
      };

      const updatedPlayer = updateRdForInactivity(player, 30);

      expect(updatedPlayer.rd).toBeGreaterThan(player.rd);
      expect(updatedPlayer.rd).toBeLessThan(150);
    });

    test('180일 비활동 후 RD 대폭 증가', () => {
      const player: GlickoPlayer = {
        rating: 1600,
        rd: 50,
        volatility: 0.06
      };

      const updatedPlayer = updateRdForInactivity(player, 180);

      expect(updatedPlayer.rd).toBeGreaterThan(200);
      expect(updatedPlayer.rd).toBeLessThanOrEqual(350);
    });

    test('365일 비활동 후 RD 최대값', () => {
      const player: GlickoPlayer = {
        rating: 1800,
        rd: 40,
        volatility: 0.06
      };

      const updatedPlayer = updateRdForInactivity(player, 365);

      expect(updatedPlayer.rd).toBeGreaterThan(300);
      expect(updatedPlayer.rd).toBeLessThanOrEqual(350);
    });
  });

  describe('10연승 시나리오', () => {
    test('동일 레이팅 상대로 10연승', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const ratingHistory: number[] = [player.rating];
      const rdHistory: number[] = [player.rd];

      // 10연승 시뮬레이션
      for (let i = 0; i < 10; i++) {
        const result = calculateRatingChange(
          player,
          [{
            opponent: {
              rating: 1500 + (i * 10),
              rd: 150,
              volatility: 0.06
            },
            score: 1.0
          }]
        );

        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };

        ratingHistory.push(player.rating);
        rdHistory.push(player.rd);
      }

      expect(player.rating).toBeGreaterThan(1700);
      expect(player.rd).toBeLessThan(100);
    });

    test('10연승 후 1패의 영향', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      // 10연승
      for (let i = 0; i < 10; i++) {
        const result = calculateRatingChange(
          player,
          [{
            opponent: {
              rating: 1500,
              rd: 150,
              volatility: 0.06
            },
            score: 1.0
          }]
        );

        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      const ratingAfterWins = player.rating;

      // 1패
      const lossResult = calculateRatingChange(
        player,
        [{
          opponent: {
            rating: 1500,
            rd: 150,
            volatility: 0.06
          },
          score: 0.0
        }]
      );

      // RD가 낮아진 상태에서 지면 큰 손실 없음
      expect(lossResult.newRating).toBeGreaterThan(ratingAfterWins - 30);
    });
  });

  describe('핸디캡이 포함된 실전 시나리오', () => {
    test('약한 덱(20)으로 5연승', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      for (let i = 0; i < 5; i++) {
        const result = calculateHandicapRatingChange(
          player,
          {
            opponent: {
              rating: 1500,
              rd: 150,
              volatility: 0.06
            },
            score: 1.0
          },
          20,
          30
        );

        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      expect(player.rating).toBeGreaterThan(1630);
    });

    test('강한 덱(30)으로 약한 상대(20) 5연승', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      for (let i = 0; i < 5; i++) {
        const result = calculateHandicapRatingChange(
          player,
          {
            opponent: {
              rating: 1500,
              rd: 150,
              volatility: 0.06
            },
            score: 1.0
          },
          30,
          20
        );

        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      expect(player.rating).toBeLessThan(1620);
    });
  });

  describe('레이팅 차이가 큰 매치', () => {
    test('1200 vs 1800: 약자 승리 (Upset)', () => {
      const weakPlayer: GlickoPlayer = {
        rating: 1200,
        rd: 150,
        volatility: 0.06
      };

      const result = calculateRatingChange(
        weakPlayer,
        [{
          opponent: {
            rating: 1800,
            rd: 80,
            volatility: 0.06
          },
          score: 1.0
        }]
      );

      expect(result.newRating).toBeGreaterThan(1270);
      expect(result.ratingDelta).toBeGreaterThan(70);
    });

    test('1800 vs 1200: 강자 패배 (대참사)', () => {
      const strongPlayer: GlickoPlayer = {
        rating: 1800,
        rd: 80,
        volatility: 0.06
      };

      const result = calculateRatingChange(
        strongPlayer,
        [{
          opponent: {
            rating: 1200,
            rd: 150,
            volatility: 0.06
          },
          score: 0.0
        }]
      );

      expect(result.newRating).toBeLessThan(1730);
      expect(result.ratingDelta).toBeLessThan(-70);
    });
  });

  describe('극단적 RD 시나리오', () => {
    test('신규 플레이어 (RD 350) 첫 게임', () => {
      const newbie: GlickoPlayer = {
        rating: 1500,
        rd: 350,
        volatility: 0.06
      };

      const result = calculateRatingChange(
        newbie,
        [{
          opponent: {
            rating: 1600,
            rd: 100,
            volatility: 0.06
          },
          score: 1.0
        }]
      );

      expect(Math.abs(result.ratingDelta)).toBeGreaterThan(40);
      expect(result.newRd).toBeLessThan(300);
    });

    test('베테랑 (RD 40) 안정적 레이팅', () => {
      const veteran: GlickoPlayer = {
        rating: 2000,
        rd: 40,
        volatility: 0.06
      };

      const result = calculateRatingChange(
        veteran,
        [{
          opponent: {
            rating: 2000,
            rd: 50,
            volatility: 0.06
          },
          score: 1.0
        }]
      );

      expect(Math.abs(result.ratingDelta)).toBeLessThan(15);
    });
  });

  describe('무승부 연속', () => {
    test('5무 시 레이팅 유지, RD 감소', () => {
      let player: GlickoPlayer = {
        rating: 1600,
        rd: 200,
        volatility: 0.06
      };

      const initialRating = player.rating;

      for (let i = 0; i < 5; i++) {
        const result = calculateRatingChange(
          player,
          [{
            opponent: {
              rating: 1600,
              rd: 150,
              volatility: 0.06
            },
            score: 0.5
          }]
        );

        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      expect(player.rating).toBeCloseTo(initialRating, 0);
      expect(player.rd).toBeLessThan(200);
    });
  });

  describe('예상 레이팅 변화', () => {
    test('핸디캡 20:30 예상 결과', () => {
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

      expect(expected.win).toBeGreaterThan(25);
      expect(Math.abs(expected.loss)).toBeLessThan(25);
      expect(expected.draw).toBeGreaterThan(0);
    });
  });
});
