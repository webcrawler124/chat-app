const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, getUser, getUsersInRoom, removeUser } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 5000;
const publicDir = path.join(__dirname, '../public');

app.use(express.static(publicDir));

io.on('connection', (socket) => {
    console.log('New Websocket connection');

    socket.on('join', ({ username, room }, callback) => {
        const { user, error } = addUser({ id: socket.id, username, room });

        if (error) {
            return callback(error)
        }

        socket.join(user.room);

        socket.emit('message', generateMessage(0, 'Admin', 'Welcome'));
        socket.broadcast.to(user.room).emit('message', generateMessage(0, 'Admin', `${user.username} has joined!`));

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (newMessage, callback) => {
        const user = getUser(socket.id);

        const filter = new Filter()

        if (filter.isProfane(newMessage)) {
            return callback('Profanity is not allowed')
        }

        io.to(user.room).emit('message', generateMessage(user.id, user.username, newMessage))
        callback();
    })

    socket.on('sendLocation', ({ latitude, longitude }, callback) => {
        const user = getUser(socket.id);
        if (user) {
            io.to(user.room).emit('locationMessage', generateLocationMessage(user.id, user.username, `https://google.com/maps?q=${latitude},${longitude}`))
            callback('Location sent')
        }
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        console.log(user)
        if (user) {
            io.to(user.room).emit('message', generateMessage(0, 'Admin', `${user.username} has left`));

            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.rrom)
            })
        }
    })
})

server.listen(PORT, () => console.log("Server is up on port " + PORT));