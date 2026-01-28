import { 
  calculateRatingChange, 
  updateRdForInactivity,
  GLICKO2_SCALE,
  DEFAULT_RATING,
  DEFAULT_RD,
  GlickoPlayer,
  MatchResult
} from './Glicko2';

describe('Glicko2 Rating System', () => {
  describe('동일 레이팅 플레이어 대결', () => {
    test('1500 vs 1500: 승자 +25, 패자 -25', () => {
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
        score: 1.0 // 승리
      };

      const result = calculateRatingChange(player, [match]);

      expect(result.newRating).toBeCloseTo(1525, 0);
      expect(result.newRd).toBeLessThan(200);
      expect(result.newVolatility).toBeCloseTo(0.06, 2);
    });

    test('1500 vs 1500: 무승부는 레이팅 변화 없음', () => {
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
        score: 0.5 // 무승부
      };

      const result = calculateRatingChange(player, [match]);

      expect(result.newRating).toBeCloseTo(1500, 1);
      expect(result.newRd).toBeLessThan(200);
    });

    test('1500 vs 1500: 패자 -25', () => {
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
        score: 0.0 // 패배
      };

      const result = calculateRatingChange(player, [match]);

      expect(result.newRating).toBeCloseTo(1475, 0);
      expect(result.newRd).toBeLessThan(200);
    });
  });

  describe('레이팅 차이 500점 대결 (Upset)', () => {
    test('2000 vs 1500: 강자 승리 시 적은 점수 획득', () => {
      const strongPlayer: GlickoPlayer = {
        rating: 2000,
        rd: 100,
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

      const result = calculateRatingChange(strongPlayer, [match]);

      // 기댓값이 높았으므로 획득 점수 적음
      expect(result.newRating).toBeGreaterThan(2000);
      expect(result.newRating).toBeLessThan(2010);
    });

    test('1500 vs 2000: 약자 승리 시 큰 점수 획득 (Upset)', () => {
      const weakPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 2000,
          rd: 100,
          volatility: 0.06
        },
        score: 1.0 // Upset!
      };

      const result = calculateRatingChange(weakPlayer, [match]);

      // 기댓값이 낮았으므로 큰 점수 획득
      expect(result.newRating).toBeGreaterThan(1540);
      expect(result.newRating).toBeLessThan(1570);
    });

    test('2000 vs 1500: 강자 패배 시 큰 손실', () => {
      const strongPlayer: GlickoPlayer = {
        rating: 2000,
        rd: 100,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 200,
          volatility: 0.06
        },
        score: 0.0 // 패배
      };

      const result = calculateRatingChange(strongPlayer, [match]);

      expect(result.newRating).toBeLessThan(1990);
      expect(result.newRating).toBeGreaterThan(1960);
    });
  });

  describe('RD (Rating Deviation) 변화', () => {
    test('게임 후 RD는 항상 감소한다', () => {
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

      const result = calculateRatingChange(player, [match]);

      expect(result.newRd).toBeLessThan(player.rd);
    });

    test('높은 RD 플레이어는 더 큰 레이팅 변화', () => {
      const highRdPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 300,
        volatility: 0.06
      };

      const lowRdPlayer: GlickoPlayer = {
        rating: 1500,
        rd: 50,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1600,
          rd: 100,
          volatility: 0.06
        },
        score: 1.0
      };

      const highRdResult = calculateRatingChange(highRdPlayer, [match]);
      const lowRdResult = calculateRatingChange(lowRdPlayer, [match]);

      const highRdChange = Math.abs(highRdResult.newRating - highRdPlayer.rating);
      const lowRdChange = Math.abs(lowRdResult.newRating - lowRdPlayer.rating);

      expect(highRdChange).toBeGreaterThan(lowRdChange);
    });
  });

  describe('비활동 기간 RD 증가', () => {
    test('30일 비활동 후 RD 증가', () => {
      const player: GlickoPlayer = {
        rating: 1600,
        rd: 80,
        volatility: 0.06
      };

      const daysSinceLastGame = 30;
      const updatedPlayer = updateRdForInactivity(player, daysSinceLastGame);

      expect(updatedPlayer.rd).toBeGreaterThan(player.rd);
      expect(updatedPlayer.rd).toBeLessThan(350); // 최대값
    });

    test('180일 비활동 후 RD는 최대값에 근접', () => {
      const player: GlickoPlayer = {
        rating: 1600,
        rd: 50,
        volatility: 0.06
      };

      const daysSinceLastGame = 180;
      const updatedPlayer = updateRdForInactivity(player, daysSinceLastGame);

      expect(updatedPlayer.rd).toBeGreaterThan(200);
      expect(updatedPlayer.rd).toBeLessThanOrEqual(350);
    });

    test('1일 비활동은 미미한 변화', () => {
      const player: GlickoPlayer = {
        rating: 1600,
        rd: 80,
        volatility: 0.06
      };

      const daysSinceLastGame = 1;
      const updatedPlayer = updateRdForInactivity(player, daysSinceLastGame);

      expect(updatedPlayer.rd).toBeGreaterThan(player.rd);
      expect(updatedPlayer.rd).toBeLessThan(player.rd + 5);
    });
  });

  describe('연승 시나리오', () => {
    test('10연승 시 레이팅 상승 및 RD 감소', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const opponentRating = 1500;

      // 10연승
      for (let i = 0; i < 10; i++) {
        const match: MatchResult = {
          opponent: {
            rating: opponentRating + (i * 10), // 점점 강한 상대
            rd: 150,
            volatility: 0.06
          },
          score: 1.0
        };

        const result = calculateRatingChange(player, [match]);
        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      expect(player.rating).toBeGreaterThan(1700);
      expect(player.rd).toBeLessThan(100);
    });

    test('5승 5패는 원점 복귀에 가까움', () => {
      let player: GlickoPlayer = {
        rating: 1500,
        rd: 200,
        volatility: 0.06
      };

      const opponentRating = 1500;

      // 5승 5패 반복
      for (let i = 0; i < 10; i++) {
        const match: MatchResult = {
          opponent: {
            rating: opponentRating,
            rd: 150,
            volatility: 0.06
          },
          score: i % 2 === 0 ? 1.0 : 0.0 // 승패 반복
        };

        const result = calculateRatingChange(player, [match]);
        player = {
          rating: result.newRating,
          rd: result.newRd,
          volatility: result.newVolatility
        };
      }

      expect(player.rating).toBeCloseTo(1500, -1); // 10의 자리까지 유사
      expect(player.rd).toBeLessThan(200); // RD는 감소
    });
  });

  describe('극단적 케이스', () => {
    test('신규 플레이어 (RD 350) vs 베테랑 (RD 50)', () => {
      const newbie: GlickoPlayer = {
        rating: 1500,
        rd: 350,
        volatility: 0.06
      };

      const veteran: GlickoPlayer = {
        rating: 1500,
        rd: 50,
        volatility: 0.06
      };

      const match: MatchResult = {
        opponent: {
          rating: 1500,
          rd: 100,
          volatility: 0.06
        },
        score: 1.0
      };

      const newbieResult = calculateRatingChange(newbie, [match]);
      const veteranResult = calculateRatingChange(veteran, [match]);

      // 신규 플레이어는 더 큰 변화
      expect(Math.abs(newbieResult.newRating - newbie.rating))
        .toBeGreaterThan(Math.abs(veteranResult.newRating - veteran.rating));
    });

    test('최소 RD 하한선 테스트', () => {
      const player: GlickoPlayer = {
        rating: 2000,
        rd: 40, // 이미 매우 낮음
        volatility: 0.06
      };

      const matches: MatchResult[] = Array(5).fill(null).map(() => ({
        opponent: {
          rating: 2000,
          rd: 50,
          volatility: 0.06
        },
        score: 1.0
      }));

      const result = calculateRatingChange(player, matches);

      // RD는 30 이하로 떨어지지 않음
      expect(result.newRd).toBeGreaterThanOrEqual(30);
    });
  });
});
