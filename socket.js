const SocketIO = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cookie = require('cookie-signature');

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });
  app.set('io', io); // 익스프레스 변수 저장 방법
  // req.app.get('io').of('/room').emit 위에서 저장한 변수를 꺼냄
  // 네임스페이스로 실시간 데이터가 전달될 주소를 구별할 수 있다.
  // io.of('/')
  const room = io.of('/room');
  const chat = io.of('/chat');
  // express 미들웨어를 소켓IO에서 쓰는 방법
  io.use((socket, next) => { 
    cookieParser(process.env.COOKIE_SECRET)(socket.request, socket.request.res, next);
  });

  room.on('connection', (socket) => {
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

 chat.on('connection', (socket) => {
   console.log('chat 네임스페이스에 접속');
   const req = socket.request;
   const { headers: { referer } } = req;
   const roomId = referer
     .split('/')[referer.split('/').length - 1]
     .replace(/\?.+/, '');
   // /room/awefadfsf (req.headers.referer)
   socket.join(roomId); // 방에 접속

   //socket.to(roomId).emit('join', { // 메세지 전송
     //user: 'system',
     //chat: `${req.session.color}님이 입장하셨습니다.`,
     //number: socket.adapter.rooms[roomId].length,
   //});
  axios.post(`http://localhost:8005/room/${roomId}/sys`, {
    type: 'join',
  }, {
    headers: { // connect.id가 세션 쿠키, 이게 같으면 같은 사람으로 본다
      Cookie: `connect.sid=${'s%3A' + cookie.sign(req.signedCookies['connect.sid'],  process.env.COOKIE_SECRET)}` 
    },
  });

  socket.on('disconnect', () => {
    console.log('chat 네임스페이스 접속 해제');
    socket.leave(roomId); // 방 나가기
    // 방에 인원이 하나도 없으면 방을 없애기
    // 방장이 나간 경우 방 인원 중 랜덤 한명 골라서 방장 위임
    // 몽고 디비로 room 스키마 owner update
    const currentRoom = socket.adapter.rooms[roomId]; // 현재 방에 대한 정보 받아오기
    const userCount = currentRoom ? currentRoom.length : 0; // currentRoom.length으로 사용자 수를 받아옴
    if (userCount === 0) {
      axios.delete(`http://localhost:8005/room/${roomId}`)
        .then(() => {
          console.log('방 제거 요청 성공');
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      //socket.to(roomId).emit('exit', {
        //user: 'system',
        //chat: `${req.session.color}님이 퇴장하셨습니다.`,
        //number: socket.adapter.rooms[roomId].length,
      axios.post(`http://localhost:8005/room/${roomId}/sys`, {
        type: 'exit',
      }, {
        headers: {
          Cookie: `connect.sid=${'s%3A' + cookie.sign(req.signedCookies['connect.sid'], process.env.COOKIE_SECRET)}`
        },
      });
    }  
  });

  socket.on('dm', (data) => {
    socket.to(data.target).emit('dm', data); // socket.to(개인의 소켓).emit
  });
  socket.on('ban', (data) => {
    socket.to(data.id).emit('ban');
  });
});
};
  

// 클라이언트 -> http -> 서버
// 클라이언트 -> ws -> 서버