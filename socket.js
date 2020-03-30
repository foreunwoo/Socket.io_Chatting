const SocketIO = require('socket.io');

module.exports = (server) => {
  const io = SocketIO(server, { path: '/socket.io' });

// 네임스페이스로 실시간 데이터가 전달될 주소를 구별할 수 있다.
// io.of('/')
const room = io.of('/room');
const chat = io.of('/chat');

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
  socket.to(roomId).emit('join', { // 메세지 전송
    user: 'system',
    chat: `${req.session.color}님이 입장하셨습니다.`,
  });
  socket.on('disconnect', () => {
    console.log('chat 네임스페이스 접속 해제');
    socket.leave(roomId); // 방 나가기
    const currentRoom = socket.adapter.rooms[roomId];
    const userCount = currentRoom ? currentRoom.length : 0;
    if (userCount === 0) {
      axios.delete(`http://localhost:8005/room/${roomId}`)
        .then(() => {
          console.log('방 제거 요청 성공');
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      socket.to(roomId).emit('exit', {
        user: 'system',
        chat: `${req.session.color}님이 퇴장하셨습니다.`,
      });
    }
  });
});
};
  

// 클라이언트 -> http -> 서버
// 클라이언트 -> ws -> 서버