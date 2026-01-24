# EC2 네트워크 설정 완벽 가이드 - 덱 빌딩 체스

## 🌐 목차

1. [보안 그룹 (Security Group) 설정](#보안-그룹-설정)
2. [VPC 및 서브넷 설정](#vpc-및-서브넷-설정)
3. [Elastic IP (고정 IP) 설정](#elastic-ip-설정)
4. [서버 내부 방화벽 (UFW) 설정](#서버-내부-방화벽)
5. [포트 포워딩 및 리버스 프록시](#포트-포워딩)
6. [도메인 연결](#도메인-연결)
7. [SSL/TLS 인증서 설정](#ssl-인증서)
8. [네트워크 테스트](#네트워크-테스트)

---

## 🔒 보안 그룹 (Security Group) 설정

보안 그룹 = EC2의 **방화벽** (어떤 포트를 열지 결정)

### 1단계: 보안 그룹 생성

**AWS Console 방법:**
```
1. EC2 Dashboard → 왼쪽 메뉴 → "보안 그룹"
2. "보안 그룹 생성" 클릭
3. 설정 입력:
   - 이름: deck-chess-sg
   - 설명: Security group for deck chess application
   - VPC: 기본 VPC 선택
4. "생성" 클릭
```

### 2단계: 인바운드 규칙 설정

**필수 포트 (덱 빌딩 체스):**

```
┌─────────────────────────────────────────────────────────────┐
│ 포트  │ 프로토콜 │ 소스        │ 용도                       │
├─────────────────────────────────────────────────────────────┤
│ 22    │ SSH      │ 내 IP       │ SSH 접속 (보안!)          │
│ 80    │ HTTP     │ 0.0.0.0/0   │ 웹사이트 (자동 HTTPS 전환)│
│ 443   │ HTTPS    │ 0.0.0.0/0   │ 웹사이트 (SSL)           │
│ 3001  │ TCP      │ 0.0.0.0/0   │ 백엔드 API + WebSocket   │
│ 5432  │ TCP      │ 내 IP       │ PostgreSQL (선택)        │
└─────────────────────────────────────────────────────────────┘
```

**상세 설정:**

#### 규칙 1: SSH (필수, 보안 중요!)
```
유형: SSH
프로토콜: TCP
포트 범위: 22
소스: 내 IP (My IP)  ← 매우 중요! 0.0.0.0/0 절대 금지!
설명: SSH access from my IP only
```

⚠️ **보안 경고:**
```
절대 하지 말 것:
❌ SSH 포트를 0.0.0.0/0으로 열기
   → 전세계에서 접속 시도 가능 (해킹 위험!)

✅ 올바른 방법:
   - 내 IP만 허용
   - IP 변경시 보안 그룹 업데이트
   - 또는 VPN 사용
```

#### 규칙 2: HTTP (자동 HTTPS 리다이렉트용)
```
유형: HTTP
프로토콜: TCP
포트 범위: 80
소스: 0.0.0.0/0 (Anywhere-IPv4)
설명: HTTP traffic (redirects to HTTPS)
```

#### 규칙 3: HTTPS (프론트엔드)
```
유형: HTTPS
프로토콜: TCP
포트 범위: 443
소스: 0.0.0.0/0 (Anywhere-IPv4)
설명: HTTPS traffic for frontend
```

#### 규칙 4: 백엔드 API + WebSocket
```
유형: 사용자 지정 TCP
프로토콜: TCP
포트 범위: 3001
소스: 0.0.0.0/0 (Anywhere-IPv4)
설명: Backend API and WebSocket
```

#### 규칙 5: PostgreSQL (선택)
```
유형: PostgreSQL
프로토콜: TCP
포트 범위: 5432
소스: 내 IP (My IP)
설명: PostgreSQL database access (restricted)
```

⚠️ **PostgreSQL 보안:**
```
프로덕션 환경:
❌ 외부 접속 불허 (보안 그룹에서 제거)
✅ EC2 내부에서만 localhost 접속

개발/디버깅:
✅ 내 IP만 허용
❌ 0.0.0.0/0 절대 금지!
```

### 3단계: 아웃바운드 규칙 (기본값 사용)

```
모든 트래픽 허용 (기본 설정)

유형: 모든 트래픽
프로토콜: 전체
포트 범위: 전체
대상: 0.0.0.0/0

→ EC2에서 외부로 나가는 연결 허용
   (예: npm install, apt update 등)
```

### 4단계: EC2 인스턴스에 보안 그룹 적용

```
방법 1: 인스턴스 생성시 (권장)
- EC2 인스턴스 시작 마법사에서 선택

방법 2: 기존 인스턴스에 적용
1. EC2 Dashboard → 인스턴스 선택
2. 작업 → 보안 → 보안 그룹 변경
3. deck-chess-sg 선택
4. 저장
```

---

## 🏗️ VPC 및 서브넷 설정

### VPC란?
```
VPC (Virtual Private Cloud) = 가상 네트워크

┌─────────────────────────────────────────┐
│           AWS VPC (10.0.0.0/16)        │
│  ┌────────────────────────────────┐    │
│  │  Subnet A (10.0.1.0/24)        │    │
│  │  - EC2 인스턴스                │    │
│  │  - 가용 영역: ap-northeast-2a  │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Subnet B (10.0.2.0/24)        │    │
│  │  - RDS (선택)                  │    │
│  │  - 가용 영역: ap-northeast-2c  │    │
│  └────────────────────────────────┘    │
│                                         │
│  Internet Gateway (외부 연결)          │
└─────────────────────────────────────────┘
```

### MVP 단계: 기본 VPC 사용 (권장)

```
AWS가 자동으로 생성한 기본 VPC 사용

장점:
✅ 설정 불필요
✅ 즉시 사용 가능
✅ 인터넷 연결 자동

설정:
- EC2 인스턴스 생성시 "기본 VPC" 선택
- 서브넷: 아무거나 (자동 할당)
- 퍼블릭 IP 자동 할당: 활성화 ✅
```

### 고급: 커스텀 VPC 생성 (프로덕션)

**1단계: VPC 생성**
```
AWS Console → VPC → VPC 생성

설정:
- 이름: deck-chess-vpc
- IPv4 CIDR 블록: 10.0.0.0/16
- IPv6 CIDR 블록: 없음
- 테넌시: 기본

생성 클릭
```

**2단계: 서브넷 생성**
```
VPC → 서브넷 → 서브넷 생성

퍼블릭 서브넷 (EC2용):
- 이름: deck-chess-public-subnet
- VPC: deck-chess-vpc
- 가용 영역: ap-northeast-2a
- IPv4 CIDR 블록: 10.0.1.0/24

프라이빗 서브넷 (RDS용, 선택):
- 이름: deck-chess-private-subnet
- VPC: deck-chess-vpc
- 가용 영역: ap-northeast-2c
- IPv4 CIDR 블록: 10.0.2.0/24
```

**3단계: 인터넷 게이트웨이 생성**
```
VPC → 인터넷 게이트웨이 → 생성

설정:
- 이름: deck-chess-igw
- VPC에 연결: deck-chess-vpc
```

**4단계: 라우팅 테이블 설정**
```
VPC → 라우팅 테이블 → 라우팅 편집

퍼블릭 서브넷용 라우팅:
- 대상: 0.0.0.0/0
- 타겟: igw-xxxxx (인터넷 게이트웨이)

서브넷 연결:
- deck-chess-public-subnet 연결
```

---

## 📍 Elastic IP (고정 IP) 설정

### Elastic IP란?
```
일반 퍼블릭 IP: 재시작마다 변경 ❌
Elastic IP: 고정 IP (변경 안됨) ✅

사용 이유:
- 도메인 연결시 필수
- 재시작해도 IP 유지
- 사용자 접속 안정성
```

### 설정 방법

**1단계: Elastic IP 할당**
```
EC2 Dashboard → 네트워크 및 보안 → Elastic IP

1. "Elastic IP 주소 할당" 클릭
2. 네트워크 경계 그룹: ap-northeast-2
3. "할당" 클릭

결과:
- 새로운 고정 IP 할당됨 (예: 3.34.123.456)
```

**2단계: EC2 인스턴스에 연결**
```
할당된 Elastic IP 선택

1. 작업 → Elastic IP 주소 연결
2. 인스턴스: 내 EC2 인스턴스 선택
3. 프라이빗 IP: 자동 선택
4. "연결" 클릭

결과:
- EC2 인스턴스가 이제 고정 IP 사용
- 재시작해도 IP 유지
```

⚠️ **비용 주의:**
```
Elastic IP 비용:
- 사용 중: 무료
- 미사용 (할당만 하고 연결 안함): $0.005/시간 (월 ~$3.60)

팁:
✅ 할당 후 즉시 EC2에 연결
❌ 할당만 하고 방치 금지
```

**3단계: DNS 업데이트 (도메인 있으면)**
```
도메인 DNS 설정에서:
- A 레코드 → Elastic IP로 변경

예시:
이름: deck-chess.com
타입: A
값: 3.34.123.456 (Elastic IP)
TTL: 300
```

---

## 🛡️ 서버 내부 방화벽 (UFW)

### UFW란?
```
UFW (Uncomplicated Firewall) = Ubuntu 방화벽

보안 그룹 (AWS) + UFW (서버) = 2중 보안
```

### 설정 방법

**1단계: SSH로 EC2 접속**
```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

**2단계: UFW 설치 및 기본 설정**
```bash
# UFW 설치 (이미 설치되어 있을 수 있음)
sudo apt update
sudo apt install ufw -y

# 기본 정책 설정
sudo ufw default deny incoming   # 들어오는 연결 기본 차단
sudo ufw default allow outgoing  # 나가는 연결 기본 허용
```

**3단계: 필요한 포트 열기**
```bash
# SSH (필수! 먼저 허용해야 lockout 방지)
sudo ufw allow 22/tcp
sudo ufw allow OpenSSH  # 또는 이렇게

# HTTP
sudo ufw allow 80/tcp
sudo ufw allow http  # 또는 이렇게

# HTTPS
sudo ufw allow 443/tcp
sudo ufw allow https  # 또는 이렇게

# 백엔드 API (3001)
sudo ufw allow 3001/tcp

# PostgreSQL (선택, 외부 접속시만)
# sudo ufw allow from YOUR_IP to any port 5432
```

**4단계: UFW 활성화**
```bash
# 활성화
sudo ufw enable

# 확인 메시지
# Command may disrupt existing ssh connections. Proceed with operation (y|n)?
# → y 입력

# 상태 확인
sudo ufw status verbose
```

**출력 예시:**
```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
3001/tcp                   ALLOW IN    Anywhere
```

**5단계: 특정 IP만 허용 (고급)**
```bash
# SSH를 특정 IP에서만 허용
sudo ufw delete allow 22/tcp  # 기존 규칙 삭제
sudo ufw allow from YOUR_HOME_IP to any port 22

# PostgreSQL을 특정 IP에서만 허용
sudo ufw allow from YOUR_IP to any port 5432

# 상태 확인
sudo ufw status numbered
```

---

## 🔄 포트 포워딩 및 리버스 프록시

### 포트 포워딩 구조
```
사용자 브라우저
    ↓
외부: 80 (HTTP), 443 (HTTPS)
    ↓
EC2 인스턴스
    ↓
Nginx (리버스 프록시)
    ↓
내부: 3001 (Node.js 백엔드)
    ↓
내부: 5432 (PostgreSQL)
```

### Nginx 리버스 프록시 설정

**1단계: Nginx 설정 파일 생성**
```bash
sudo vim /etc/nginx/sites-available/deck-chess
```

**2단계: 기본 설정 (HTTP만)**
```nginx
# /etc/nginx/sites-available/deck-chess

server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;  # 예: deck-chess.com 또는 3.34.123.456
    
    # 프론트엔드 (S3 사용시 이 섹션 제거)
    location / {
        root /home/ubuntu/frontend-build/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 백엔드 API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket (Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**3단계: 설정 활성화**
```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/deck-chess /etc/nginx/sites-enabled/

# 기본 설정 비활성화 (선택)
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# 출력:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl status nginx
```

**4단계: 테스트**
```bash
# 로컬에서 테스트
curl http://localhost

# 외부에서 테스트 (로컬 컴퓨터에서)
curl http://YOUR_ELASTIC_IP
curl http://YOUR_ELASTIC_IP/api/health
```

---

## 🌐 도메인 연결

### 도메인 DNS 설정

**1단계: A 레코드 추가**
```
DNS 제공업체 (예: Cloudflare, Route53, GoDaddy)

설정:
타입: A
이름: @ (또는 비워두기)
값: YOUR_ELASTIC_IP (예: 3.34.123.456)
TTL: 300 (5분)

결과:
deck-chess.com → YOUR_ELASTIC_IP
```

**2단계: www 서브도메인 (선택)**
```
타입: CNAME
이름: www
값: deck-chess.com
TTL: 300

결과:
www.deck-chess.com → deck-chess.com → YOUR_ELASTIC_IP
```

**3단계: DNS 전파 확인**
```bash
# 로컬에서 테스트
ping deck-chess.com

# 또는 nslookup
nslookup deck-chess.com

# 또는 온라인 도구
# https://dnschecker.org
```

**DNS 전파 시간:**
```
일반적: 5분 - 1시간
최대: 48시간

빠르게 하려면:
- TTL을 낮게 설정 (300초)
- Cloudflare 같은 CDN 사용
```

---

## 🔐 SSL/TLS 인증서 (HTTPS)

### Let's Encrypt 인증서 (무료)

**1단계: Certbot 설치**
```bash
# Certbot 설치
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

**2단계: 인증서 발급**
```bash
# 자동 설정 (Nginx 설정 자동 변경)
sudo certbot --nginx -d deck-chess.com -d www.deck-chess.com

# 프롬프트 응답:
# 1. 이메일 입력: your@email.com
# 2. 약관 동의: Y
# 3. 뉴스레터: N (선택)
# 4. 리다이렉트 선택: 2 (HTTP → HTTPS 자동 전환)
```

**출력:**
```
Congratulations! You have successfully enabled HTTPS!

- Congratulations! Your certificate and chain have been saved at:
  /etc/letsencrypt/live/deck-chess.com/fullchain.pem
  Your key file has been saved at:
  /etc/letsencrypt/live/deck-chess.com/privkey.pem
  Your cert will expire on 2026-04-23.
```

**3단계: 자동 갱신 설정**
```bash
# 자동 갱신 테스트
sudo certbot renew --dry-run

# 성공하면 Cron이 자동으로 설정됨
# 매일 2번 자동 갱신 체크: /etc/cron.d/certbot
```

**4단계: Nginx 설정 확인**
```bash
# Certbot이 자동으로 수정한 설정 확인
sudo cat /etc/nginx/sites-available/deck-chess
```

**자동 생성된 HTTPS 설정:**
```nginx
server {
    listen 443 ssl http2;
    server_name deck-chess.com www.deck-chess.com;
    
    ssl_certificate /etc/letsencrypt/live/deck-chess.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deck-chess.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # ... 기존 location 블록들 ...
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name deck-chess.com www.deck-chess.com;
    return 301 https://$server_name$request_uri;
}
```

**5단계: HTTPS 테스트**
```bash
# 브라우저에서 접속
https://deck-chess.com

# SSL 등급 확인 (온라인)
# https://www.ssllabs.com/ssltest/
```

---

## 🧪 네트워크 테스트

### 1. 포트 테스트

**서버에서 (내부):**
```bash
# 서비스가 포트를 리스닝하는지 확인
sudo netstat -tulpn | grep LISTEN

# 출력 예시:
# tcp   0   0 0.0.0.0:22      0.0.0.0:*   LISTEN   1234/sshd
# tcp   0   0 0.0.0.0:80      0.0.0.0:*   LISTEN   5678/nginx
# tcp   0   0 0.0.0.0:443     0.0.0.0:*   LISTEN   5678/nginx
# tcp   0   0 127.0.0.1:3001  0.0.0.0:*   LISTEN   9012/node
# tcp   0   0 127.0.0.1:5432  0.0.0.0:*   LISTEN   3456/postgres

# 또는 ss 명령어
sudo ss -tulpn | grep LISTEN
```

**로컬에서 (외부):**
```bash
# 포트가 열려있는지 확인
nc -zv YOUR_ELASTIC_IP 80
nc -zv YOUR_ELASTIC_IP 443
nc -zv YOUR_ELASTIC_IP 3001

# 출력:
# Connection to YOUR_ELASTIC_IP 80 port [tcp/http] succeeded!
```

### 2. 방화벽 테스트

**UFW 상태:**
```bash
sudo ufw status verbose
sudo ufw status numbered
```

**보안 그룹 확인:**
```
AWS Console → EC2 → 인스턴스 선택 → 보안 탭 → 보안 그룹
```

### 3. HTTP/HTTPS 테스트

```bash
# HTTP 테스트
curl http://YOUR_ELASTIC_IP
curl http://deck-chess.com

# HTTPS 테스트
curl https://deck-chess.com

# API 테스트
curl https://deck-chess.com/api/health

# WebSocket 테스트 (간단)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: deck-chess.com" \
  -H "Origin: https://deck-chess.com" \
  https://deck-chess.com/socket.io/?transport=websocket
```

### 4. DNS 테스트

```bash
# 로컬에서
nslookup deck-chess.com

# 또는
dig deck-chess.com

# 출력 확인:
# deck-chess.com. 300 IN A YOUR_ELASTIC_IP
```

### 5. 전체 연결 테스트

```bash
# 프론트엔드
curl -I https://deck-chess.com
# 출력: HTTP/2 200 (성공)

# API
curl https://deck-chess.com/api/health
# 출력: {"status":"ok"}

# WebSocket (브라우저 콘솔)
# const socket = io('https://deck-chess.com');
# socket.on('connect', () => console.log('Connected!'));
```

---

## 🔧 문제 해결

### 문제 1: 포트가 외부에서 접속 안됨

```bash
# 체크리스트:
□ 보안 그룹에서 포트 열림? (AWS Console)
□ UFW에서 포트 허용? (sudo ufw status)
□ 서비스가 실행 중? (sudo systemctl status nginx)
□ 서비스가 포트 리스닝? (sudo netstat -tulpn | grep :80)

# 해결:
1. 보안 그룹 확인
2. UFW 규칙 추가: sudo ufw allow 80/tcp
3. 서비스 재시작: sudo systemctl restart nginx
```

### 문제 2: SSH 접속 안됨

```bash
# 원인 1: 보안 그룹에 내 IP 없음
→ AWS Console에서 보안 그룹에 현재 IP 추가

# 원인 2: UFW로 SSH 차단
→ AWS Console에서 Serial Console로 접속
→ sudo ufw disable (임시)
→ 규칙 재설정 후 sudo ufw enable

# 원인 3: 키 파일 권한 문제
chmod 400 your-key.pem
```

### 문제 3: HTTPS 인증서 발급 실패

```bash
# 원인 1: 도메인 DNS 설정 안됨
→ nslookup으로 확인
→ DNS 전파 대기 (1-24시간)

# 원인 2: 80 포트 열려있지 않음
→ 보안 그룹 + UFW에서 80 포트 허용
→ Nginx 실행 중 확인

# 원인 3: Nginx 설정 오류
sudo nginx -t  # 문법 확인
sudo nginx -s reload  # 재시작
```

### 문제 4: WebSocket 연결 안됨

```bash
# Nginx 설정 확인
# Upgrade 헤더 설정되어 있는지 확인

location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ...
}

# Node.js CORS 설정 확인
const io = new Server(server, {
  cors: {
    origin: 'https://deck-chess.com',
    methods: ['GET', 'POST']
  }
});
```

---

## ✅ 네트워크 설정 체크리스트

```bash
보안 그룹 (AWS):
□ SSH (22) - 내 IP만
□ HTTP (80) - 전체
□ HTTPS (443) - 전체
□ 백엔드 (3001) - 전체
□ PostgreSQL (5432) - 내 IP만 (선택)

Elastic IP:
□ 할당 완료
□ EC2에 연결
□ DNS A 레코드 업데이트

UFW (서버):
□ UFW 활성화
□ SSH 허용
□ HTTP/HTTPS 허용
□ 백엔드 포트 허용

Nginx:
□ 설치 및 실행
□ 리버스 프록시 설정
□ WebSocket 설정
□ 설정 테스트 (nginx -t)

SSL/TLS:
□ Certbot 설치
□ 인증서 발급
□ HTTPS 리다이렉트
□ 자동 갱신 설정

테스트:
□ HTTP 접속 테스트
□ HTTPS 접속 테스트
□ API 엔드포인트 테스트
□ WebSocket 연결 테스트
□ DNS 전파 확인
```

---

## 📊 네트워크 구조 요약

```
인터넷
    ↓
AWS 보안 그룹 (1차 방화벽)
    ↓ 80, 443, 3001 허용
Elastic IP (고정 IP)
    ↓
EC2 인스턴스
    ↓
UFW (2차 방화벽)
    ↓
Nginx (리버스 프록시)
    ├─ / → 프론트엔드 (포트 80/443)
    ├─ /api → 백엔드 (포트 3001)
    └─ /socket.io → WebSocket (포트 3001)
    ↓
Node.js (localhost:3001)
    ↓
PostgreSQL (localhost:5432)
```

---

**네트워크 설정 완료! 🎉**

이제 안전하고 빠른 네트워크 환경이 구축되었습니다!

---

_Last Updated: 2026-01-23_
_Version: 1.0.0 - EC2 Network Configuration Guide_
