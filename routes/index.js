const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
      console.log(rooms);
      // 해당 방에 대한 채팅 내용을 넣어줌
      const chats = await Chat.find({ room: room._id }).sort('createdAt');
      return res.render('chat', {
        room,
        title: room.title,
        chats,
        number: (rooms && rooms[req.params.id] && rooms[req.params.id].length + 1) || 1,
        user: req.session.color, // 세션에 저장된 컬러를 사용
      });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/room/:id', async (req, res, next) => {
  try {
    await Room.remove({ _id: req.params.id });
    await Chat.remove({ room: req.params.id });
    res.send('ok');
    setTimeout(() => {
      // socket을 라우터에서는 req.app.get('io').of(네임스페이스).emit(이벤트, 데이터)
      req.app.get('io').of('/room').emit('removeRoom', req.params.id);
    }, 2000);
  } catch (error) {
    console.error(error);
    next(error);
  }
})

router.post('/room/:id/chat', async (req, res, next) => {
  try {
    const chat = new Chat({
      room: req.params.id,
      user: req.session.color,
      chat: req.body.chat,
    }) 
    await chat.save();
    res.send('ok');
  //  req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', {
      socket: req.body.sid,
      room: req.params.id,
      user: req.session.color,
      chat: req.body.chat,
    });
  } catch(error) {
    console.error(error);
    next(error);
  }
})

fs.readdir('uploads', (error) => { 
  if (error) {
    console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
    fs.mkdirSync('uploads');
  }
});
const uploads = multer({ // multer 설정
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, 'uploads/');
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname); // .extname() 파일의 확장자 이름
      cb(null, path.basename(file.originalname, ext) + new Date().valueOf() + ext); // .basename() 파일의 기본 이름
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, //10MB로 용량 제한
})

router.post('/room/:id/gif', uploads.single('gif'), async (req, res, next) => {
  try {
    const chat = new Chat({
      room: req.params.id,
      user: req.session.color,
      gif: req.body.filename,
    }) 
    await chat.save();
    res.send('ok');
  //  req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', {
      socket: req.body.sid,
      room: req.params.id,
      user: req.session.color,
      gif: req.file.filename,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
})

router.post('/room/:id/sys', async (req, res, next) => { // 시스템 메시지를 저장하는 라우터
  try {
    const chat = req.body.type === 'join'
    ? `${req.session.color}님이 입장하셨습니다.`
    : `${req.session.color}님이 퇴장하셨습니다.`
    const sys = new Chat({
      room: req.params.id,
      user: 'system',
      chat,
    });
    await sys.save(); // 몽고 디비에 저장
    req.app.get('io').of('/chat').to(req.params.id).emit(req.body.type, {
      user: 'system',
      chat,
      number: req.app.get('io').of('/chat').adapter.rooms[req.params.id].length,
    });
    res.send('ok');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

module.exports = router;