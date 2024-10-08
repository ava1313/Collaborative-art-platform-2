// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// In-memory storage for room elements
const rooms = {};

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected');

    const { roomId, isPublic } = socket.handshake.query;
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
        rooms[roomId] = [];
    }

    // Send existing elements to the newly connected user
    socket.emit('updateElements', rooms[roomId]);

    // Listen for drawing events
    socket.on('addElement', (element) => {
        rooms[roomId].push(element);
        socket.to(roomId).emit('addElement', element);
    });

    socket.on('clearCanvas', () => {
        rooms[roomId] = [];
        io.to(roomId).emit('clearCanvas');
    });

    socket.on('undo', () => {
        if (rooms[roomId].length > 0) {
            const element = rooms[roomId].pop();
            socket.to(roomId).emit('undo', element);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
