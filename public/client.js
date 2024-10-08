// public/client.js
const socket = io();

// Canvas setup
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Drawing settings
let drawing = false;
let current = {
    color: document.getElementById('colorPicker').value,
    lineWidth: document.getElementById('lineWidthPicker').value,
};

// Update current settings when controls change
document.getElementById('colorPicker').addEventListener('change', (e) => {
    current.color = e.target.value;
});

document.getElementById('lineWidthPicker').addEventListener('change', (e) => {
    current.lineWidth = e.target.value;
});

// Clear canvas button
document.getElementById('clearButton').addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
});

// Mouse events
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

// Touch events for mobile devices
canvas.addEventListener('touchstart', onMouseDown, false);
canvas.addEventListener('touchend', onMouseUp, false);
canvas.addEventListener('touchcancel', onMouseUp, false);
canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false);

// Window resize
window.addEventListener('resize', onResize, false);

// Socket events
socket.on('drawing', onDrawingEvent);
socket.on('clearCanvas', clearCanvas);

function drawLine(x0, y0, x1, y1, color, lineWidth, emit) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
    context.closePath();

    if (!emit) return;
    const w = canvas.width;
    const h = canvas.height;

    socket.emit('drawing', {
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color,
        lineWidth: lineWidth,
    });
}

function onMouseDown(e) {
    drawing = true;
    current.x = e.clientX || e.touches[0].clientX;
    current.y = e.clientY || e.touches[0].clientY;
}

function onMouseUp(e) {
    if (!drawing) return;
    drawing = false;
    drawLine(
        current.x,
        current.y,
        e.clientX || e.changedTouches[0].clientX,
        e.clientY || e.changedTouches[0].clientY,
        current.color,
        current.lineWidth,
        true
    );
}

function onMouseMove(e) {
    if (!drawing) return;
    drawLine(
        current.x,
        current.y,
        e.clientX || e.touches[0].clientX,
        e.clientY || e.touches[0].clientY,
        current.color,
        current.lineWidth,
        true
    );
    current.x = e.clientX || e.touches[0].clientX;
    current.y = e.clientY || e.touches[0].clientY;
}

function onDrawingEvent(data) {
    const w = canvas.width;
    const h = canvas.height;
    drawLine(
        data.x0 * w,
        data.y0 * h,
        data.x1 * w,
        data.y1 * h,
        data.color,
        data.lineWidth,
        false
    );
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function onResize() {
    // Save the current content
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Resize the canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Restore the content
    context.putImageData(imgData, 0, 0);
}

// Throttle function to limit the number of events per second
function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function() {
        const time = new Date().getTime();

        if (time - previousCall >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}
