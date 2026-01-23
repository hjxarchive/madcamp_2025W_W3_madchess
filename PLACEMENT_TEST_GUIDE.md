# 배치 전송 테스트 가이드

## 📋 개요

PlacementPage에서 기물 배치를 WebSocket으로 송수신하는 기능을 테스트하기 위한 가이드입니다.

**중요**: 배치를 완료해도 **상대방의 배치를 받을 때까지** 게임 페이지로 이동하지 않습니다. 이는 실제 멀티플레이어 환경을 시뮬레이션하기 위함입니다.

## 🛠️ 테스트 함수

개발 모드에서 브라우저 콘솔에서 다음 함수들을 사용할 수 있습니다:

### 1. `testAutoPlacement()`
- **기능**: 모든 기물을 자동으로 배치합니다
- **사용 시점**: 수동으로 배치하기 귀찮을 때
- **생성되는 배치**:
  - 킹, 퀸, 룩 2개, 비숍 2개, 나이트 2개, 폰 8개
  - 색상에 맞는 진영(white: 1-2행, black: 7-8행)에 배치

```javascript
testAutoPlacement()
```

### 2. `testSendPlacement()`
- **기능**: 현재 배치된 기물을 서버로 전송하고 **대기 상태**로 전환
- **사용 시점**: "배치 완료" 버튼 대신 콘솔에서 전송하고 싶을 때
- **전송 데이터**:
  ```json
  {
    "color": "white" | "black",
    "placement": [
      { "type": "k", "file": "e", "rank": 1 },
      ...
    ]
  }
  ```
- **결과**: 
  - "배치 완료" 버튼이 "⏳ 상대방 배치 대기 중..."으로 변경
  - 버튼이 비활성화되어 재전송 방지

```javascript
testSendPlacement()
```

### 3. `testSimulateOpponentComplete()` ⭐ **NEW**
- **기능**: 상대방이 배치를 완료한 것처럼 시뮬레이션하여 게임 시작
- **사용 시점**: `testSendPlacement()` 후 상대방의 배치를 시뮬레이션할 때
- **전제조건**: `waitingForOpponent` 상태여야 함 (먼저 `testSendPlacement()` 실행 필요)
- **동작**:
  1. 상대방 색상의 더미 배치 생성
  2. `placement:complete` 이벤트 시뮬레이션
  3. sessionStorage에 저장
  4. 게임 페이지로 자동 이동

```javascript
testSimulateOpponentComplete()
```

### 4. `testReceivePlacement()`
- **기능**: 전체 플로우를 건너뛰고 바로 게임 페이지로 이동 (테스트용)
- **사용 시점**: 빠르게 게임 페이지를 확인하고 싶을 때
- **주의**: 실제 WebSocket 플로우를 테스트하지 않음

```javascript
testReceivePlacement()
```

### 5. `testPlacementWaiting()`
- **기능**: "배치 대기 중" 알림을 시뮬레이션
- **사용 시점**: UI 테스트

```javascript
testPlacementWaiting()
```

## 🧪 테스트 시나리오

### ⭐ 시나리오 1: 정상 플로우 테스트 (권장)

이 시나리오는 **실제 게임 플로우**를 시뮬레이션합니다.

1. PlacementPage 접속
2. 콘솔 열기 (F12)
3. 기물 자동 배치:
   ```javascript
   testAutoPlacement()
   ```
4. 서버로 배치 전송 (대기 상태로 전환):
   ```javascript
   testSendPlacement()
   ```
5. UI 확인:
   - ✅ "배치 완료" 버튼이 "⏳ 상대방 배치 대기 중..."으로 변경
   - ✅ 버튼이 비활성화됨
   - ✅ 취소 버튼도 비활성화됨
6. 상대 배치 완료 시뮬레이션:
   ```javascript
   testSimulateOpponentComplete()
   ```
7. GamePage로 자동 이동 확인
8. 양쪽 기물이 보드에 표시되는지 확인

**전체 명령어 (복사 & 붙여넣기):**
```javascript
testAutoPlacement()
testSendPlacement()
// 대기 상태 확인 후...
testSimulateOpponentComplete()
```

### 시나리오 2: 빠른 확인 (WebSocket 플로우 생략)

### 시나리오 2: 빠른 확인 (WebSocket 플로우 생략)

빠르게 게임 페이지를 확인하고 싶을 때 사용합니다.

1. PlacementPage 접속
2. 콘솔 열기 (F12)
3. 함수 실행:
   ```javascript
   testAutoPlacement()     // 자동 배치
   testReceivePlacement()  // 바로 게임 페이지로 이동
   ```
4. GamePage에서 양쪽 배치가 제대로 표시되는지 확인

### 시나리오 3: 수동 배치 테스트

1. PlacementPage 접속
2. 기물을 수동으로 드래그 앤 드롭으로 배치
3. 콘솔에서 전송:
   ```javascript
   testSendPlacement()
   ```
4. 대기 상태 UI 확인
5. 상대 완료 시뮬레이션:
   ```javascript
   testSimulateOpponentComplete()
   ```

### 시나리오 4: 멀티 브라우저 테스트 (실제 WebSocket 통신)

**브라우저 1 (백 플레이어):**
1. `/placement/test-game` 접속
2. sessionStorage 설정:
   ```javascript
   sessionStorage.setItem('selectedColor', 'white')
   ```
3. 페이지 새로고침
4. 배치 및 전송:
   ```javascript
   testAutoPlacement()
   testSendPlacement()
   ```
5. "⏳ 상대방 배치 대기 중..." 상태 확인

**브라우저 2 (흑 플레이어):**
1. `/placement/test-game` 접속
2. sessionStorage 설정:
   ```javascript
   sessionStorage.setItem('selectedColor', 'black')
   ```
3. 페이지 새로고침
4. 배치 및 전송:
   ```javascript
   testAutoPlacement()
   testSendPlacement()
   ```
5. 양쪽 브라우저가 자동으로 GamePage로 이동

**확인 사항:**
- ✅ 양쪽 모두 게임 페이지로 이동했는가?
- ✅ 각 플레이어에게 상대방의 배치가 보이는가?
- ✅ 보드에 총 32개 기물(또는 배치한 만큼)이 표시되는가?

## 🎯 예상되는 WebSocket 플로우

### 단일 브라우저 시뮬레이션:
```
[Player] testAutoPlacement()
    ↓
[Player] testSendPlacement()
    ↓
[UI] "⏳ 상대방 배치 대기 중..." 표시
    ↓
[Player] testSimulateOpponentComplete()
    ↓
[UI] placement:complete 이벤트 시뮬레이션
    ↓
[Player] GamePage로 자동 이동
```

### 실제 멀티플레이어:
```
[Player 1] testSendPlacement()
    ↓
[Server] placement:waiting → [Player 1]
    ↓
[Player 1] "⏳ 대기 중..." UI 표시
    ↓
[Player 2] testSendPlacement()
    ↓
[Server] placement:complete → [Player 1]
[Server] placement:complete → [Player 2]
    ↓
[Both] GamePage로 자동 이동
```

## 🔍 디버깅 팁

### 콘솔 메시지 확인

배치 전송 시:
```
📤 배치 전송: { color: "white", placement: [...] }
```

대기 상태로 전환:
```
⏳ waitingForOpponent = true
```

상대 배치 수신 시:
```
✅ 상대가 배치 완료! placement:complete 이벤트 시뮬레이션
📥 상대 배치: [...]
🎮 게임 시작! 페이지 이동: /game/...
```

### 상태 확인

브라우저 콘솔에서 컴포넌트 상태 확인:
```javascript
// 대기 상태 확인 (React DevTools 필요)
// 또는 UI에서 버튼 텍스트로 확인
```

### WebSocket 이벤트 확인

브라우저 콘솔에서:
```javascript
// 현재 WebSocket 상태 확인
socketService.getSocket()?.connected

// 수동으로 이벤트 리스닝
socketService.getSocket()?.on('placement:complete', (data) => {
  console.log('✅ placement:complete 수신:', data)
})

socketService.getSocket()?.on('placement:waiting', () => {
  console.log('⏳ placement:waiting 수신')
})
```

### SessionStorage 확인

```javascript
// 저장된 배치 정보 확인
JSON.parse(sessionStorage.getItem('placedPieces'))
sessionStorage.getItem('myColor')
JSON.parse(sessionStorage.getItem('opponentPlacement'))
```

## ⚠️ 주의사항

1. **gameId 필수**: gameId가 없으면 전송이 실패합니다
   - URL에 gameId가 있는지 확인: `/placement/:gameId`

2. **WebSocket 연결**: 서버가 실행 중이어야 합니다
   - 백엔드: `npm run dev` (포트 5000)
   - 프론트엔드: `npm run dev` (포트 5173)

3. **색상 설정**: myColor가 설정되어 있어야 합니다
   - sessionStorage에 'selectedColor' 또는 'myColor' 필요

4. **킹 필수**: 킹이 없으면 전송이 거부됩니다

5. **대기 상태**: `testSendPlacement()` 후에는 `waitingForOpponent` 상태가 됩니다
   - 이 상태에서는 "배치 완료" 버튼이 비활성화됩니다
   - `testSimulateOpponentComplete()`를 실행하거나 실제 상대가 배치를 완료해야 게임이 시작됩니다

6. **플로우 순서**: 정상 플로우를 따르세요
   - ✅ 올바름: `testAutoPlacement()` → `testSendPlacement()` → `testSimulateOpponentComplete()`
   - ❌ 잘못됨: `testSimulateOpponentComplete()`를 먼저 실행 (경고 메시지 표시)

## 📊 테스트 체크리스트

### 기본 기능
- [ ] testAutoPlacement로 기물이 올바른 위치에 배치되는가?
- [ ] testSendPlacement가 서버로 데이터를 전송하는가?
- [ ] testSimulateOpponentComplete가 게임 페이지로 이동시키는가?

### UI 상태
- [ ] testSendPlacement 후 버튼이 "⏳ 상대방 배치 대기 중..."으로 변경되는가?
- [ ] 대기 상태에서 버튼이 비활성화되는가?
- [ ] 대기 상태에서 취소 버튼도 비활성화되는가?
- [ ] testSimulateOpponentComplete 후 대기 상태가 해제되는가?

### WebSocket (멀티 브라우저)
- [ ] 서버가 placement:waiting 이벤트를 보내는가?
- [ ] 양쪽 배치 완료 시 placement:complete 이벤트가 오는가?
- [ ] 상대방의 배치가 올바르게 수신되는가?

### 게임 페이지
- [ ] GamePage에서 양쪽 기물이 모두 표시되는가?
- [ ] 기물 가치가 올바르게 계산되는가?
- [ ] 내 색상과 상대 색상이 올바르게 표시되는가?

## 🔧 문제 해결

### "gameId가 없습니다" 오류
- URL 확인: `/placement/test-game`처럼 gameId 포함 필요

### "배치된 기물이 없습니다" 오류
- `testAutoPlacement()` 먼저 실행

### "먼저 testSendPlacement()로 내 배치를 보내세요" 경고
- `testSimulateOpponentComplete()`를 실행하기 전에 `testSendPlacement()` 실행 필요
- 정상 플로우: `testAutoPlacement()` → `testSendPlacement()` → `testSimulateOpponentComplete()`

### "Socket not connected" 오류
- 백엔드 서버 실행 확인
- 콘솔에서 WebSocket 연결 확인:
  ```javascript
  socketService.getSocket()?.connected
  ```

### 게임 페이지로 이동하지 않음
- placement:complete 이벤트가 수신되었는지 확인
- sessionStorage에 데이터가 저장되었는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 버튼이 계속 대기 상태로 표시됨
- 페이지 새로고침
- 또는 콘솔에서 강제로 상태 초기화 후 재시도

## 💡 팁

1. **빠른 테스트**: `testReceivePlacement()`를 사용하면 대기 없이 바로 게임 페이지로 이동
2. **정상 플로우 테스트**: `testAutoPlacement()` → `testSendPlacement()` → `testSimulateOpponentComplete()` 순서로 실행
3. **멀티 브라우저**: 두 개의 시크릿 창을 사용하면 sessionStorage 충돌 방지
4. **콘솔 명령어 복사**: 자주 사용하는 명령어는 텍스트 파일에 저장해두고 복사 & 붙여넣기
