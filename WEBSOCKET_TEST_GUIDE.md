# WebSocket 상대 수신 테스트 가이드

## 개요
WebSocket으로 상대의 수를 받아서 보드를 업데이트하는 기능을 구현했습니다. 백엔드가 준비될 때까지 브라우저 콘솔에서 테스트할 수 있습니다.

## 구현된 함수

### 1. `applyOpponentMove()` - gameStore에서 상대의 수 적용
**위치**: `frontend/src/stores/gameStore.ts`

**기능**:
- 상대의 이동을 보드에 반영
- 캡처된 기물을 기록
- 턴을 내 차례로 변경
- lastMove 업데이트

**함수 시그니처**:
```typescript
applyOpponentMove: (move: Move) => void
```

### 2. `simulateOpponentMove()` - 테스트용 헬퍼 함수
**위치**: `frontend/src/stores/gameStore.ts`

**기능**: 
- 콘솔에서 상대의 수를 시뮬레이션
- 간단한 테스트를 위한 래퍼 함수

**함수 시그니처**:
```typescript
export const simulateOpponentMove = (move: Move) => void
```

### 3. WebSocket 리스너 - GamePage에서 자동 처리
**위치**: `frontend/src/pages/GamePage.tsx`

**기능**:
- 'opponent:move' 이벤트를 수신
- 자동으로 `applyOpponentMove()` 호출
- 보드 및 게임 상태 업데이트

## Move 타입 정의

```typescript
interface Move {
  uci: string  // UCI 표기법: "e2e4", "e7e8q" (프로모션 포함)
  piece: PieceType  // 움직이는 기물 타입
  captured?: PieceType  // 캡처된 기물 타입 (선택사항)
}

type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
```

### UCI (Universal Chess Interface) 표기법

UCI는 체스 이동을 표현하는 국제 표준 형식입니다:
- **기본 이동**: `시작위치끝위치` (예: `e2e4`, `b1c3`)
- **프로모션**: `시작위치끝위치승격기물` (예: `e7e8q`)
- **캐슬링**: `킹이동` (예: `e1g1` - 킹사이드, `e1c1` - 퀸사이드)
- **앙파상**: 일반 이동과 동일 (예: `e5d6`)

## 테스트 방법

### 방법 1: 콘솔에서 직접 테스트 (권장)

1. **게임 페이지 접속**
   - 매칭 화면에서 선공/후공 선택
   - 배치 화면에서 기물 배치
   - 게임 화면 진입

2. **브라우저 개발자 도구 열기** (F12 또는 우클릭 > 검사)

3. **콘솔 탭에서 다음 명령어 실행**

게임 화면에 접속하면 콘솔에 다음 메시지가 표시됩니다:
```
🎮 테스트 함수 사용 가능: testMove("e2e4", "p")
```

#### 예시 1: 폰 이동 (e2 → e4)
```javascript
testMove('e2e4', 'p')
```

#### 예시 2: 나이트 이동 (b1 → c3)
```javascript
testMove('b1c3', 'n')
```

#### 예시 3: 캡처를 포함한 이동 (e4 × d5 폰)
```javascript
testMove('e4d5', 'p', 'p')  // 세 번째 인자는 캡처된 기물
```

#### 예시 4: 룩 이동 (a1 → a4)
```javascript
testMove('a1a4', 'r')
```

#### 예시 5: 폰 프로모션 (e7 → e8, 퀸으로 승격)
```javascript
testMove('e7e8q', 'p')
```

#### 예시 6: 킹사이드 캐슬링 (백)
```javascript
testMove('e1g1', 'k')
```

### 함수 시그니처
```typescript
testMove(uci: string, piece: string, captured?: string)
```
- **uci**: UCI 표기법 문자열 (예: "e2e4", "e7e8q")
- **piece**: 기물 타입 ('p', 'n', 'b', 'r', 'q', 'k')
- **captured**: (선택) 캡처된 기물 타입

### 방법 2: 게임 화면 테스트 시나리오

**테스트 시나리오**:
1. 당신의 수를 먼저 한 번 두기 (예: e2-e4)
2. F12를 눌러 콘솔 열기
3. 콘솔에서 상대의 수 시뮬레이션: `testMove('d7d5', 'p')`
4. 보드가 업데이트되고 턴이 변경되는지 확인
5. 당신의 다음 수를 두기
6. 반복

**빠른 테스트 예시**:
```javascript
// 백 e2-e4
testMove('e2e4', 'p')

// 흑 d7-d5 응수
testMove('d7d5', 'p')

// 백 나이트 f3
testMove('g1f3', 'n')
```

## UCI 표기법 가이드

UCI(Universal Chess Interface)는 체스 엔진과 GUI 간의 표준 통신 프로토콜입니다.

### 기본 형식
- **4자리**: `시작칸끝칸` (예: `e2e4`, `g1f3`)
- **5자리**: `시작칸끝칸승격` (예: `e7e8q` - 폰이 퀸으로 승격)

### 좌표 시스템
- **파일(가로)**: a, b, c, d, e, f, g, h (왼쪽에서 오른쪽)
- **랭크(세로)**: 1, 2, 3, 4, 5, 6, 7, 8 (아래에서 위)

### UCI 예시
| 이동 | UCI | 설명 |
|------|-----|------|
| e2-e4 | `e2e4` | 백 폰 전진 |
| Nf3 | `g1f3` | 백 나이트 |
| O-O | `e1g1` | 백 킹사이드 캐슬링 |
| O-O-O | `e1c1` | 백 퀸사이드 캐슬링 |
| e7-e8=Q | `e7e8q` | 폰 프로모션 (퀸) |
| exd5 | `e4d5` | 폰 캡처 |

## 보드 좌표 시스템

체스 보드는 표준 UCI 좌표를 사용합니다:

```
8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜
7 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟
6 · · · · · · · ·
5 · · · · · · · ·
4 · · · · · · · ·
3 · · · · · · · ·
2 ♙ ♙ ♙ ♙ ♙ ♙ ♙ ♙
1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖
  a b c d e f g h
```

### 좌표 예시

| 위치 | UCI | 설명 |
|------|-----|------|
| 백 킹 시작 위치 | `e1` | 1행 e파일 |
| 백 퀸 시작 위치 | `d1` | 1행 d파일 |
| 흑 킹 시작 위치 | `e8` | 8행 e파일 |
| 백 폰 (e파일) | `e2` | 2행 e파일 |
| 흑 폰 (d파일) | `d7` | 7행 d파일 |
| 중앙 칸 | `d4`, `e4`, `d5`, `e5` | 중앙 4칸 |

## 실시간 확인

### 콘솔 로그 확인
```
🎮 테스트 함수 사용 가능: testMove("e2e4", "p")
[LOG] Opponent move applied: {uci: 'e2e4', piece: 'p', captured: undefined}
```

### 게임 화면 확인
- ✅ 기물이 올바른 위치로 이동
- ✅ 마지막 이동이 노란색으로 표시됨
- ✅ 턴 표시가 "당신의 차례입니다"로 변경
- ✅ 캡처된 기물이 있으면 사라짐
- ✅ moveCount가 증가

## 백엔드 연동 시 (향후)

WebSocket 이벤트 'opponent:move'로 다음 형식의 데이터를 보내면 자동으로 처리됩니다:

```json
{
  "uci": "e2e4",
  "piece": "p",
  "captured": null
}
```

### 예시

**일반 이동**:
```json
{
  "uci": "g1f3",
  "piece": "n"
}
```

**캡처**:
```json
{
  "uci": "e4d5",
  "piece": "p",
  "captured": "p"
}
```

**프로모션**:
```json
{
  "uci": "e7e8q",
  "piece": "p"
}
```

**캐슬링**:
```json
{
  "uci": "e1g1",
  "piece": "k"
}
```

## 문제 해결

### ✅ 해결됨: testMove 함수 사용

게임 페이지(GamePage)에 접속하면 개발 모드에서 자동으로 `testMove` 함수가 전역에 노출됩니다.

**사용법**:
```javascript
// 간단한 형식
testMove('e2e4', 'p')

// 캡처 포함
testMove('e4d5', 'p', 'p')

// 프로모션
testMove('e7e8q', 'p')
```

### 문제: testMove가 정의되지 않음

**원인**: 게임 페이지가 아닌 다른 페이지에 있거나 페이지가 로드되지 않음

**해결**: 
1. 매칭 → 배치 → 게임 화면 순서로 이동
2. F12를 눌러 콘솔 확인
3. 🎮 메시지가 표시되는지 확인

### 대안: UI 테스트 버튼 추가 (선택사항)

### 대안: UI 테스트 버튼 추가 (선택사항)

원하는 경우 GamePage.tsx에 시각적 테스트 버튼을 추가할 수 있습니다:
```tsx
// 게임 컨트롤 섹션에 추가
{import.meta.env.DEV && (
  <button 
    onClick={() => applyOpponentMove({
      uci: 'e2e4',
      piece: 'p'
    })}
    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
  >
    🧪 테스트: e2-e4
  </button>
)}
```

## 다음 단계

1. **백엔드 구현**
   - Socket.io 서버에서 'opponent:move' 이벤트 발송
   - 유효한 이동인지 검증

2. **추가 기능**
   - 체크/체크메이트 감지
   - en passant (지나가기) 캡처
   - 캐슬링 이동
   - 폰 프로모션

3. **네트워크 최적화**
   - 이동 히스토리 동기화
   - 연결 끊김 시 복구 로직
   - 이동 확인 응답(ACK)

