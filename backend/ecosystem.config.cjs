module.exports = {
  apps: [{
    name: "deck-chess-backend",
    script: "./dist/server.js",   // 빌드된 파일 경로 확인
    instances: 1,
    exec_mode: "fork",            // 또는 "cluster"
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 3001
    }
  }]
};
