import { getCatenaryCurve, drawResult } from 'catenary-curve';
import { SVG } from '@svgdotjs/svg.js';

const canvas = document.getElementById('catenaryCanvas');
const context = canvas.getContext('2d');
const svgContainer = document.getElementById('catenarySvg');
const drawSvg = SVG().addTo(svgContainer).size('100%', '100%'); // Use svg.js to create the SVG drawing context

const svgElement = document.getElementById('catenarySvg');
const [svgWidth, svgHeight] = [svgElement.getAttribute('width'), svgElement.getAttribute('height')];

let points = [];
let catenaries = [];
let draggingPoint = null;
const gridLines = []; // To store references to grid lines for easy access later
const GRID_SIZE = 30

// Get device pixel ratio
const dpr = window.devicePixelRatio || 1;

// // Adjust canvas size for higher resolution
// canvas.width = canvas.clientWidth * dpr;
// canvas.height = canvas.clientHeight * dpr;
// context.scale(dpr, dpr);

// Function to render a grid on the SVG element with a background color and white grid lines
function renderGrid(gridSize = 50) {
    const width = svgContainer.clientWidth;
    const height = svgContainer.clientHeight;

    // Clear existing grid lines and background (if any)
    drawSvg.clear();

    // Add a background rectangle
    drawSvg.rect(width, height).fill('#201E1F');

    // Draw vertical grid lines
    for (let x = 0; x <= width; x += gridSize) {
        const line = drawSvg.line(x, 0, x, height).stroke({ color: 'white', width: 0.05 });
        gridLines.push({ type: 'vertical', x, line });
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= height; y += gridSize) {
        const line = drawSvg.line(0, y, width, y).stroke({ color: 'white', width: 0.05 });
        gridLines.push({ type: 'horizontal', y, line });
    }
}

// Snap to the nearest grid intersection if within 11 pixels
function snapToGrid(x, y, gridSize = GRID_SIZE, snapThreshold = gridSize*0.4) {
    const nearestX = Math.round(x / gridSize) * gridSize;
    const nearestY = Math.round(y / gridSize) * gridSize;

    const distance = Math.hypot(nearestX - x, nearestY - y);

    if (distance <= snapThreshold) {
        // Increase the stroke-width of the corresponding grid lines
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

// Render the grid on the SVG
// renderGrid(GRID_SIZE);

// Event listeners for drawing catenaries and interacting with the canvas
canvas.addEventListener('mousedown', (event) => {
    let { offsetX: x, offsetY: y } = event;

    // Snap to grid if close enough
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
        // Snap to grid if close enough
        ({ x, y } = snapToGrid(x, y));
        draggingPoint.x = x;
        draggingPoint.y = y;
        draw();
    } else if (points.length === 1) {
        // If one point is defined, show a "dragging" wire
        drawTemporaryCatenary(x, y);
    }
});

canvas.addEventListener('mouseup', () => {
    if (points.length === 2) {
        // When two points are defined, calculate the catenary and add to the list
        const catenary = getCatenaryCurve(points[0], points[1], 500);
        catenaries.push({ points: [...points], catenary });
        points = []; // Reset points for the next catenary
        draw(); // Re-draw after adding a new catenary
    }
    draggingPoint = null;
});

function draw() {
    // Clear the canvas without filling it with any color to maintain transparency
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all the catenaries
    catenaries.forEach(({ points: catenaryPoints, catenary }) => {
        // Draw the catenary curve
        context.beginPath();
        context.lineWidth = 4;
        context.strokeStyle = 'white';
        context.lineJoin = 'round'; // Smooth line joins
        context.lineCap = 'round';  // Smooth line ends   
             
        drawResult(catenary, context);
        context.stroke();

        // Draw the anchor points for this catenary
        context.fillStyle = 'white';
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    // Draw the points for the current catenary being defined
    if (points.length > 0) {
        context.fillStyle = 'white';
        points.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    }

    // If we have two points, draw the current catenary being defined
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
    // Clear the canvas without filling it with any color to maintain transparency
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all the existing catenaries
    catenaries.forEach(({ points: catenaryPoints, catenary }) => {
        // Draw the existing catenary curves
        context.beginPath();
        context.lineWidth = 2;
        context.strokeStyle = 'white';
        drawResult(catenary, context);
        context.stroke();

        // Draw the anchor points for this catenary
        context.fillStyle = 'white';
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    // Draw the "dragging" wire from the first point to the current mouse position
    const tempCatenary = getCatenaryCurve(points[0], { x, y }, 500);
    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = '#ffd300';
    drawResult(tempCatenary, context);
    context.stroke();

    // Draw the first point
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    context.fill();
}

// Add functions to draw basic SVG shapes
function drawRectangle(x, y, width, height, lineColor = 'white', lineWidth = 1 ) {
    drawSvg.rect(width, height).move(x, y).fill('none').stroke({ color: lineColor, width: lineWidth });
}

function drawCircle(cx, cy, r) {
    drawSvg.circle(r * 2).center(cx, cy).fill('none').stroke({ color: '#FFD300', width: 2 });
}

function drawEllipse(cx, cy, rx, ry) {
    drawSvg.ellipse(rx * 2, ry * 2).center(cx, cy).fill('none').stroke({ color: '#FFD300', width: 2 });
}

function drawPlug(cx, cy, r = 4) {
    drawSvg.circle(r * 2).center(cx, cy).fill('none').stroke({ color: '#fff', width: 1 });   
    drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: '#fff', width: 2 });   
}

const range = Array.from({ length: (800 / GRID_SIZE) - 2 }, (_, k) => (k + 1) * GRID_SIZE);

for (const i of range) {
    for (const j of range) {
        if (Math.random() < 0.1) {
            drawRectangle(i-GRID_SIZE, j-GRID_SIZE/2, GRID_SIZE*5, GRID_SIZE, 'rgba(255,255,255,0.3)', 1)
            drawPlug(i, j);
        }
    }
}

