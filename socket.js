const WebSocket = require('ws');

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => { //접속할 때마다 커넥션이 맺어짐
    ws.on('message', (message) => { //메시지 보낼 때 메시지 이벤트

    });
    ws.on('error', (error) => { //에러 이벤트

    });
    ws.on('close', () => {

    });
  });
};

// 클라이언트 -> http -> 서버
// 클라이언트 -> ws -> 서버