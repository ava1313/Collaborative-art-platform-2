// public/canvas.js

// 1. Variable Declarations
let elements = [];
let undoneElements = [];
let drawing = false;
let currentTool = 'pen';
let current = {
    color: '#000000',
    fillColor: '#ffffff',
    lineWidth: 2,
};
let polygonSides = 5;

// Zoom variables
let zoomLevel = 1;
const minZoom = 0.5;
const maxZoom = 3;
const zoomStep = 0.1;

// 2. Socket.IO Setup
const params = new URLSearchParams(window.location.search);
const roomId = params.get('room') || '00000';
const isPublic = params.get('isPublic') === 'true';

document.getElementById('roomIdText').textContent = roomId;

const socket = io('/', { query: { roomId, isPublic } });

// 3. Canvas Setup
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

const tempCanvas = document.getElementById('tempCanvas');
const tempContext = tempCanvas.getContext('2d');

// Adjust for device pixel ratio for better rendering on high-DPI displays
function setCanvasDimensions() {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    // Calculate the display size of the canvas in CSS pixels
    const width = rect.width;
    const height = rect.height;

    // Set the internal dimensions of the canvas in device pixels
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    tempCanvas.width = width * ratio;
    tempCanvas.height = height * ratio;

    // Set the CSS dimensions of the canvas
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    tempCanvas.style.width = width + 'px';
    tempCanvas.style.height = height + 'px';

    // Scale the drawing contexts to match the device pixel ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    tempContext.setTransform(ratio, 0, 0, ratio, 0, 0);

    applyZoom(); // Apply zoom after setting dimensions
}

setCanvasDimensions();

window.addEventListener('resize', () => {
    setCanvasDimensions();
});

// 4. Event Listeners for UI Controls
document.getElementById('colorPicker').addEventListener('change', (e) => {
    current.color = e.target.value;
});

document.getElementById('fillColorPicker').addEventListener('change', (e) => {
    current.fillColor = e.target.value;
});

document.getElementById('lineWidthPicker').addEventListener('change', (e) => {
    current.lineWidth = e.target.value;
});

document.getElementById('gradientPalette').addEventListener('change', (e) => {
    const selected = e.target.value;
    if (selected === 'custom') {
        const color1 = prompt('Enter the first gradient color (hex code, e.g., #ff0000):', '#ff0000');
        const color2 = prompt('Enter the second gradient color (hex code, e.g., #0000ff):', '#0000ff');
        if (color1 && color2) {
            current.gradient = { color1, color2 };
        } else {
            alert('Invalid colors entered. Gradient Tool disabled.');
            current.gradient = null;
        }
    } else {
        // Predefined gradients
        switch (selected) {
            case 'rainbow':
                current.gradient = { color1: '#ff0000', color2: '#ff00ff' };
                break;
            case 'sunset':
                current.gradient = { color1: '#ff7e5f', color2: '#feb47b' };
                break;
            case 'ocean':
                current.gradient = { color1: '#2193b0', color2: '#6dd5ed' };
                break;
            case 'forest':
                current.gradient = { color1: '#5A3F37', color2: '#2C7744' };
                break;
            default:
                current.gradient = null;
        }
    }
});

// Tool buttons
const toolButtons = document.querySelectorAll('#sidebar .tool-button');
toolButtons.forEach((button) => {
    button.addEventListener('click', () => {
        toolButtons.forEach((btn) => btn.classList.remove('active-tool'));
        button.classList.add('active-tool');
        currentTool = button.id.replace('Button', '');

        // If Gradient Tool is selected, reset gradient palette
        if (currentTool === 'gradient') {
            document.getElementById('gradientPalette').selectedIndex = 0;
        } else {
            current.gradient = null; // Reset gradient if another tool is selected
        }
    });
});

// Undo and Redo
document.getElementById('undoButton').addEventListener('click', () => {
    if (elements.length > 0) {
        const element = elements.pop();
        undoneElements.push(element);
        redraw();
        socket.emit('undo');
    }
});

document.getElementById('redoButton').addEventListener('click', () => {
    if (undoneElements.length > 0) {
        const element = undoneElements.pop();
        elements.push(element);
        redraw();
        socket.emit('addElement', element);
    }
});

// Clear canvas button
document.getElementById('clearButton').addEventListener('click', () => {
    elements = [];
    undoneElements = [];
    context.clearRect(0, 0, canvas.width, canvas.height);
    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    socket.emit('clearCanvas');
});

// Export to PNG button
document.getElementById('exportButton').addEventListener('click', () => {
    // Create a temporary canvas for exporting
    const exportCanvas = document.createElement('canvas');
    const exportContext = exportCanvas.getContext('2d');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    // Draw the main canvas onto the export canvas
    exportContext.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `ArtCollab_${roomId}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});

// Zoom In and Zoom Out buttons
document.getElementById('zoomInButton').addEventListener('click', () => {
    if (zoomLevel < maxZoom) {
        zoomLevel += zoomStep;
        applyZoom();
    }
});

document.getElementById('zoomOutButton').addEventListener('click', () => {
    if (zoomLevel > minZoom) {
        zoomLevel -= zoomStep;
        applyZoom();
    }
});

// Function to apply zoom
function applyZoom() {
    // Reset transforms
    context.setTransform(1, 0, 0, 1, 0, 0);
    tempContext.setTransform(1, 0, 0, 1, 0, 0);

    const ratio = window.devicePixelRatio || 1;
    const scale = ratio * zoomLevel;

    // Apply scaling
    context.scale(scale, scale);
    tempContext.scale(scale, scale);

    // Redraw all elements after scaling
    redraw();
}

// 5. Helper Function
function getPointerPosition(e) {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    // Adjust x and y to account for the device pixel ratio and zoom level
    const ratio = window.devicePixelRatio || 1;
    const scale = ratio * zoomLevel;
    x *= ratio / scale;
    y *= ratio / scale;

    return { x, y };
}

// 6. Mouse and Touch Event Handlers
let startX = 0;
let startY = 0;

canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mousemove', onMouseMove, false);

// Touch events for mobile devices
canvas.addEventListener('touchstart', onMouseDown, false);
canvas.addEventListener('touchend', onMouseUp, false);
canvas.addEventListener('touchmove', onMouseMove, false);

// 7. Socket.IO Event Handlers
socket.on('updateElements', (serverElements) => {
    elements = serverElements;
    redraw();
});

socket.on('addElement', (element) => {
    elements.push(element);
    redraw();
});

socket.on('undo', () => {
    if (elements.length > 0) {
        const element = elements.pop();
        undoneElements.push(element);
        redraw();
    }
});

socket.on('clearCanvas', () => {
    elements = [];
    undoneElements = [];
    context.clearRect(0, 0, canvas.width, canvas.height);
    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
});

// 8. Drawing Functions
function onMouseDown(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPointerPosition(e);
    startX = pos.x;
    startY = pos.y;
}

function onMouseUp(e) {
    e.preventDefault();
    if (!drawing) return;
    drawing = false;
    const pos = getPointerPosition(e);

    if (['line', 'rectangle', 'circle', 'ellipse', 'polygon', 'gradient', 'marker', 'spray'].includes(currentTool)) {
        tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        let element = {
            tool: currentTool,
            x0: startX,
            y0: startY,
            x1: pos.x,
            y1: pos.y,
            color: current.color,
            fillColor: current.fillColor,
            lineWidth: current.lineWidth,
        };

        if (currentTool === 'polygon') {
            element.sides = polygonSides;
        }

        if (currentTool === 'gradient' && current.gradient) {
            element.gradient = current.gradient;
        }

        elements.push(element);
        undoneElements = [];
        redraw();
        socket.emit('addElement', element);
    }
}

function onMouseMove(e) {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPointerPosition(e);

    if (currentTool === 'pen' || currentTool === 'eraser') {
        const element = {
            tool: currentTool,
            x0: startX,
            y0: startY,
            x1: pos.x,
            y1: pos.y,
            color: currentTool === 'eraser' ? '#ffffff' : current.color,
            lineWidth: current.lineWidth,
        };

        elements.push(element);
        redraw();
        socket.emit('addElement', element);

        startX = pos.x;
        startY = pos.y;
    } else if (['line', 'rectangle', 'circle', 'ellipse', 'polygon', 'gradient', 'marker', 'spray'].includes(currentTool)) {
        // Live preview using temporary canvas
        tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        let element = {
            tool: currentTool,
            x0: startX,
            y0: startY,
            x1: pos.x,
            y1: pos.y,
            color: current.color,
            fillColor: current.fillColor,
            lineWidth: current.lineWidth,
        };

        if (currentTool === 'polygon') {
            element.sides = polygonSides;
        }

        if (currentTool === 'gradient' && current.gradient) {
            element.gradient = current.gradient;
        }

        drawElement(tempContext, element);
    }
}

function redraw() {
    // Clear main canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw all elements
    elements.forEach((element) => {
        drawElement(context, element);
    });

    // Clear temp canvas
    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
}

function drawElement(ctx, element) {
    ctx.beginPath();
    ctx.lineWidth = element.lineWidth;
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.fillColor || '#ffffff';
    ctx.lineCap = 'round';

    // Handle gradient fill if applicable
    if (element.tool === 'gradient' && element.gradient) {
        const gradient = ctx.createLinearGradient(element.x0, element.y0, element.x1, element.y1);
        gradient.addColorStop(0, element.gradient.color1);
        gradient.addColorStop(1, element.gradient.color2);
        ctx.fillStyle = gradient;
    }

    switch (element.tool) {
        case 'pen':
        case 'eraser':
            ctx.moveTo(element.x0, element.y0);
            ctx.lineTo(element.x1, element.y1);
            ctx.stroke();
            break;
        case 'marker':
            drawMarker(ctx, element);
            break;
        case 'spray':
            drawSpray(ctx, element);
            break;
        case 'line':
            ctx.moveTo(element.x0, element.y0);
            ctx.lineTo(element.x1, element.y1);
            ctx.stroke();
            break;
        case 'rectangle':
            const rectWidth = element.x1 - element.x0;
            const rectHeight = element.y1 - element.y0;
            if (element.fillColor && element.fillColor !== '#ffffff') {
                ctx.fillRect(element.x0, element.y0, rectWidth, rectHeight);
            }
            ctx.strokeRect(element.x0, element.y0, rectWidth, rectHeight);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(element.x1 - element.x0, 2) + Math.pow(element.y1 - element.y0, 2));
            ctx.arc(element.x0, element.y0, radius, 0, 2 * Math.PI);
            if (element.fillColor && element.fillColor !== '#ffffff') {
                ctx.fill();
            }
            ctx.stroke();
            break;
        case 'ellipse':
            const radiusX = Math.abs((element.x1 - element.x0) / 2);
            const radiusY = Math.abs((element.y1 - element.y0) / 2);
            const centerX = element.x0 + (element.x1 - element.x0) / 2;
            const centerY = element.y0 + (element.y1 - element.y0) / 2;
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            if (element.fillColor && element.fillColor !== '#ffffff') {
                ctx.fill();
            }
            ctx.stroke();
            break;
        case 'polygon':
            const sides = element.sides || 5;
            const angle = (2 * Math.PI) / sides;
            const centerPX = element.x0;
            const centerPY = element.y0;
            const radiusP = Math.sqrt(Math.pow(element.x1 - centerPX, 2) + Math.pow(element.y1 - centerPY, 2));

            ctx.moveTo(centerPX + radiusP * Math.cos(0), centerPY + radiusP * Math.sin(0));
            for (let i = 1; i <= sides; i++) {
                ctx.lineTo(centerPX + radiusP * Math.cos(i * angle), centerPY + radiusP * Math.sin(i * angle));
            }
            if (element.fillColor && element.fillColor !== '#ffffff') {
                ctx.fill();
            }
            ctx.stroke();
            break;
        case 'gradient':
            const rectWidthG = element.x1 - element.x0;
            const rectHeightG = element.y1 - element.y0;
            if (element.fillColor || element.gradient) {
                ctx.fillRect(element.x0, element.y0, rectWidthG, rectHeightG);
            }
            ctx.strokeRect(element.x0, element.y0, rectWidthG, rectHeightG);
            break;
        default:
            break;
    }
    ctx.closePath();
}

// 9. Additional Brush Functions
function drawMarker(ctx, element) {
    ctx.beginPath();
    ctx.lineWidth = element.lineWidth;
    ctx.strokeStyle = element.color;
    ctx.globalAlpha = 0.5; // Semi-transparent
    ctx.moveTo(element.x0, element.y0);
    ctx.lineTo(element.x1, element.y1);
    ctx.stroke();
    ctx.globalAlpha = 1.0; // Reset alpha
    ctx.closePath();
}

function drawSpray(ctx, element) {
    const density = 50; // Number of particles
    const radius = element.lineWidth;
    const densityFactor = density * (radius / 50); // Adjust density based on radius

    for (let i = 0; i < densityFactor; i++) {
        const offsetX = Math.random() * radius * 2 - radius;
        const offsetY = Math.random() * radius * 2 - radius;
        const distance = Math.sqrt(offsetX ** 2 + offsetY ** 2);

        if (distance < radius) {
            ctx.fillStyle = element.color;
            ctx.beginPath();
            ctx.arc(element.x1 + offsetX, element.y1 + offsetY, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
    }
}
