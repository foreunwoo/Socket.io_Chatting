const express = require('express');

const Room = require('../schemas/room');
const Chat = require('../schemas/chat');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const rooms = await Room.find({});
        res.render('main', {
          rooms,
          title: 'GIF 채팅방',
          error: req.flash('roomError'),
      });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/room', (req, res) => { // 방 화면을 만드는 라우터
    res.render('room', { title: 'GIF 채팅방 생성' });
});

router.post('/room', async (req, res, next) => {
    try {
    const room = new Room({ 
        title: req.body.title,
        max: req.body.max,
        owner: req.session.color,
        password: req.body.password,
    });
    const newRoom = await room.save(); // 방 생성
    const io = req.app.get('io');
    io.of('/room',).emit('newRoom', newRoom); // room 네임스페이스로 새로운 방이 생겼다고 알려줌
    res.redirect(`/room/${newRoom._id}?password=${req.body.password}`); // 방에 접속하는 라우터
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/room/:id', async (req, res, next) => {
    try {
      const room = await Room.findOne({ _id: req.params.id });
      const io = req.app.get('io');
      if (!room) { // 없는 방에 들어갔을 경우
        req.flash('roomError', '존재하지 않는 방입니다.');
        return res.redirect('/');
      }
      // 방에 비밀번호가 존재하고, 입력한 비밀번호가 불일치할 경우
      if (room.password && room.password !== req.query.password) { 
        req.flash('roomError', '비밀번호가 틀렸습니다.');
        return res.redirect('/');
      }
      const { rooms } = io.of('chat').adapter;
      // 방 정원이 초과됐을 때
      if (rooms && rooms[req.params.id] && room.max <= rooms[req.params.id].length) {
        req.flash('roomError', '허용 인원 초과.');
        return res.redirect('/');
      }
      return res.render('chat', {
        room,
        title: room.title,
        chats: [],
        user: req.session.color, // 세션에 저장된 컬러를 사용
      });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;