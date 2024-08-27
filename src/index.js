import { getCatenaryCurve, drawResult } from 'catenary-curve';
import { SVG } from '@svgdotjs/svg.js';

const canvas = document.getElementById('catenaryCanvas');
const context = canvas.getContext('2d');
const svgContainer = document.getElementById('catenarySvg');
const drawSvg = SVG().addTo(svgContainer).size('100%', '100%'); // Use svg.js to create the SVG drawing context

const [svgWidth, svgHeight] = [svgContainer.getAttribute('width'), svgContainer.getAttribute('height')];

let points = [];
let catenaries = [];
let draggingPoint = null;
const gridLines = []; // To store references to grid lines for easy access later
const GRID_SIZE = 20;

const cableColors = [
    "#FF4136",  // Red
    "#FF851B",  // Orange
    "#FFDC00",  // Yellow
    "#2ECC40",  // Green
    "#0074D9",  // Blue
    "#B10DC9",  // Purple
    "#F012BE",  // Pink
    "#111111",  // Black
    "#FFFFFF",  // White
    "#AAAAAA"   // Gray
];

const plugRegistry = [];

// Function to generate a random color from the cableColors array
function getRandomCableColor() {
    const randomIndex = Math.floor(Math.random() * cableColors.length);
    return cableColors[randomIndex];
}

// Function to generate a random alphanumeric string
function getRandomAlphanumericString() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = Math.floor(Math.random() * 6) + 4; // Random length between 8 and 16
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }

    return result;
}

// Snap to the nearest grid or plug
function snapToGrid(x, y, gridSize = GRID_SIZE, snapThreshold = gridSize * 0.5) {
    let nearestPlug = null;
    let minDistance = snapThreshold;

    plugRegistry.forEach(plug => {
        const distance = Math.hypot(plug.x - x, plug.y - y);
        if (distance <= minDistance) {
            nearestPlug = plug;
            minDistance = distance;
        }
    });

    if (nearestPlug) {
        return { x: nearestPlug.x, y: nearestPlug.y };
    }

    const nearestX = Math.round(x / gridSize) * gridSize;
    const nearestY = Math.round(y / gridSize) * gridSize;

    const gridDistance = Math.hypot(nearestX - x, nearestY - y);

    if (gridDistance <= snapThreshold) {
        highlightGridLines(nearestX, nearestY, 0.05);
        return { x: nearestX, y: nearestY };
    }

    return { x, y };
}

// Highlight grid lines corresponding to a specific grid intersection
function highlightGridLines(x, y, strokeWidth = 0.1) {
    gridLines.forEach(lineObj => {
        if (lineObj.type === 'vertical' && lineObj.x === x) {
            lineObj.line.stroke({ width: strokeWidth });
        }
        if (lineObj.type === 'horizontal' && lineObj.y === y) {
            lineObj.line.stroke({ width: strokeWidth });
        }
    });
}

// Event listeners for drawing catenaries and interacting with the canvas
canvas.addEventListener('mousedown', (event) => {
    let { offsetX: x, offsetY: y } = event;

    ({ x, y } = snapToGrid(x, y));

    if (points.length < 2) {
        points.push({ x, y });
    }

    points.forEach(point => {
        if (Math.hypot(point.x - x, point.y - y) < 10) {
            draggingPoint = point;
        }
    });

    draw();
});

canvas.addEventListener('mousemove', (event) => {
    let { offsetX: x, offsetY: y } = event;

    if (draggingPoint) {
        ({ x, y } = snapToGrid(x, y));
        draggingPoint.x = x;
        draggingPoint.y = y;
        draw();
    } else if (points.length === 1) {
        drawTemporaryCatenary(x, y);
    }
});

canvas.addEventListener('mouseup', () => {
    if (points.length === 2) {
        const catenary = getCatenaryCurve(points[0], points[1], 500);
        catenaries.push({ points: [...points], catenary });

        plugRegistry.forEach(plug => {
            if (
                (plug.x === points[0].x && plug.y === points[0].y) ||
                (plug.x === points[1].x && plug.y === points[1].y)
            ) {
                if (plug.rect) {
                    console.log("GOT RECT: ")
                    plug.rect.fill('#FF4136'); // Change rectangle color to red
                }

                // Make associated text bold & colored
                if (plug.text) {
                    // plug.text.font({ weight: '700' });  // Set the font weight to bold
                    plug.text.fill('#ffd300');              // Set the font color to red
                }
            }
        });

        points = [];
        draw();
    }
    draggingPoint = null;
});

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    catenaries.forEach(({ points: catenaryPoints, catenary }) => {
        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = 'white';
        context.lineJoin = 'round';
        context.lineCap = 'round';

        drawResult(catenary, context);
        context.stroke();

        context.fillStyle = 'white';
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    if (points.length > 0) {
        context.fillStyle = 'white';
        points.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    }

    if (points.length === 2) {
        const tempCatenary = getCatenaryCurve(points[0], points[1], 500);
        context.beginPath();
        context.lineWidth = 2;
        context.strokeStyle = '#ffd300';
        drawResult(tempCatenary, context);
        context.stroke();
    }
}

function drawTemporaryCatenary(x, y) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    catenaries.forEach(({ points: catenaryPoints, catenary }) => {
        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = 'white';
        drawResult(catenary, context);
        context.stroke();

        context.fillStyle = 'white';
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    const tempCatenary = getCatenaryCurve(points[0], { x, y }, 500);
    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = '#ffd300';
    drawResult(tempCatenary, context);
    context.stroke();

    context.fillStyle = 'white';
    context.beginPath();
    context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    context.fill();
}

// Helper functions to draw basic SVG shapes
function drawRectangle(x, y, width, height, lineColor = 'white', lineWidth = 1, cornerRadius = 0) {
    return drawSvg.rect(width, height)
        .move(x, y)
        .fill('none')
        .stroke({ color: lineColor, width: lineWidth })
        .radius(cornerRadius);
}

function drawText(textContent, x, y, fontSize = 16, fontColor = '#ffffff', letterSpacing = 0) {
    return drawSvg.text(textContent)
        .move(x, y)
        .font({
            size: fontSize,
            fill: fontColor,
            family: 'Roboto Mono',
            weight: 100,
            letterSpacing: letterSpacing
        });
}

function drawPlug(cx, cy, r = 4, associatedRect = null, associatedText = null) {
    drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: '#fff', width: 2 });
    const plugElement = drawSvg.circle(r * 2).center(cx, cy).fill('rgba(0, 0, 0, 0)').stroke({ color: '#fff', width: 1 });

    // Register the plug along with its associated rectangle and text
    plugRegistry.push({ x: cx, y: cy, rect: associatedRect, text: associatedText });

}

function drawButtons(cx, cy) {
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            drawSvg.rect(3, 3).move(cx - 8 + x * 4, cy - 5 + y * 4).fill('#fff');
        }
    }
}

function drawPot(cx, cy, r = GRID_SIZE / 2) {
    drawSvg.circle(r * 2 - 2).center(cx, cy).fill('#fff');
    drawSvg.circle(4).center(cx + GRID_SIZE / 4, cy - GRID_SIZE / 4 + 1).fill('#201E1F');
}

function drawKnob(cx, cy, r = GRID_SIZE / 2) {
    drawSvg.circle(r * 2 - 4).center(cx + 2, cy).fill('none').stroke({ color: '#fff', width: 1 });
    drawSvg.line(cx + 2, cy, cx + 2, cy - GRID_SIZE / 2 + 4).stroke({ color: '#fff', width: 1 });
}

function drawSwitch(cx, cy, state = 'on') {
    drawSvg.rect(GRID_SIZE / 2, GRID_SIZE)
        .move(cx, cy - GRID_SIZE / 2)
        .fill('none')
        .stroke({ color: '#fff', width: 1 });

    drawSvg.rect(GRID_SIZE / 2 - 4, GRID_SIZE / 2 - 2)
        .move(cx + 2, cy + (state === 'on' ? -GRID_SIZE / 2 + 2 : 0))
        .fill('#fff');
}

// Example of how to draw and associate elements
let increment = 12;
for (let y = GRID_SIZE * 2; y < svgHeight; y += GRID_SIZE * 3) {
    for (let x = GRID_SIZE * 2; x < svgWidth - 6 * GRID_SIZE; x += GRID_SIZE * increment) {
        if (Math.random() < 0.6) {
            increment = 2;
            const textElement = drawText(getRandomAlphanumericString(), x - GRID_SIZE / 2, y - GRID_SIZE * 2, 8, 'rgba(255,255,255,0.4)');
            drawPlug(x, y, 4, null, textElement);

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawPlug(x + GRID_SIZE + increment, y, null, textElement);
                increment++;
            }

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawButtons(x + GRID_SIZE * increment, y);
                increment++;
            }

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawPot(x + GRID_SIZE * increment, y);
                increment++;
            }

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawKnob(x + GRID_SIZE * increment, y);
                increment++;
            }

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawSwitch(x + GRID_SIZE * increment, y, 'on');
                increment++;
            }

            if (Math.random() < 0.4 && GRID_SIZE + increment < svgWidth) {
                drawSwitch(x + GRID_SIZE * increment, y, 'off');
                increment++;
            }

            drawRectangle(x - GRID_SIZE, y - GRID_SIZE + 2, GRID_SIZE * (increment + 1.5), GRID_SIZE * 2 - 4, 'rgba(255,255,255,0.3)', 1, 20);
            increment += 1.75;
        }
    }
}
