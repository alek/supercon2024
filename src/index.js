import { getCatenaryCurve, drawResult } from 'catenary-curve';

const canvas = document.getElementById('catenaryCanvas');
const context = canvas.getContext('2d');
const svg = document.getElementById('catenarySvg');

let points = [];
let catenaries = [];
let draggingPoint = null;
const gridLines = []; // To store references to grid lines for easy access later

// Function to render a grid on the SVG element with a background color and white grid lines
function renderGrid(svg, gridSize = 50) {
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // Clear existing grid lines and background (if any)
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }

    // Add a background rectangle
    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('x', 0);
    backgroundRect.setAttribute('y', 0);
    backgroundRect.setAttribute('width', width);
    backgroundRect.setAttribute('height', height);
    backgroundRect.setAttribute('fill', '#201E1F');
    svg.appendChild(backgroundRect);

    // Draw vertical grid lines
    for (let x = 0; x <= width; x += gridSize) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', height);
        line.setAttribute('stroke', 'white');
        line.setAttribute('stroke-width', '0.05');
        svg.appendChild(line);
        gridLines.push({ type: 'vertical', x, line });
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= height; y += gridSize) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'white');
        line.setAttribute('stroke-width', '0.05');
        svg.appendChild(line);
        gridLines.push({ type: 'horizontal', y, line });
    }
}

// Snap to the nearest grid intersection if within 11 pixels
function snapToGrid(x, y, gridSize = 50, snapThreshold = 11) {
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
function highlightGridLines(x, y, strokeWidth = 0.05) {
    gridLines.forEach(lineObj => {
        if (lineObj.type === 'vertical' && lineObj.x === x) {
            lineObj.line.setAttribute('stroke-width', strokeWidth);
        }
        if (lineObj.type === 'horizontal' && lineObj.y === y) {
            // lineObj.line.setAttribute('stroke', '#FFD300');
            lineObj.line.setAttribute('stroke-width', strokeWidth);
        }
    });
}

// Render the grid on the SVG
renderGrid(svg);

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
        context.strokeStyle = '#FFD300';
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
    context.strokeStyle = '#FFD300';
    drawResult(tempCatenary, context);
    context.stroke();

    // Draw the first point
    context.fillStyle = 'white';
    context.beginPath();
    context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    context.fill();
}
