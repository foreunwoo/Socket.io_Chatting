const WebSocket = require('ws');

module.exports = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => { //접속할 때마다 커넥션이 맺어짐 
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // req.headers['x-forwarded-for'] 프록시 거치기 전의 아이피
    // req.connection.remoteAddress 최종 아이피
    console.log('클라이언트 접속', ip);
    ws.on('message', (message) => { //메시지 보낼 때 메시지 이벤트
      console.log(message);
    });
    ws.on('error', (error) => { //에러 이벤트
      console.error(error);
    });
    ws.on('close', () => {
      console.log('클라이언트 접속 해제', ip);
      clearInterval(ws.interval); // 접속 종료시 클라이언트로 메시지를 보내는 것도 종료함
    });
    const interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) { // ws.CONNECTING, ws.CLOSING, ws.CLOSED
        ws.send('서버에서 클라이언트로 메시지를 보냅니다.');
      }
    }, 3001);
    ws.interval = interval;
  });
};

// 클라이언트 -> http -> 서버
// 클라이언트 -> ws -> 서버