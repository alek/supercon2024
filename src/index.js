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
const GRID_SIZE = 20

const cableColors = [
    "#FF4136",  // Red: A bright, bold red, often used for visual emphasis.
    "#FF851B",  // Orange: A vivid orange, striking and easily distinguishable.
    "#FFDC00",  // Yellow: A bright yellow, commonly used for visibility.
    "#2ECC40",  // Green: A vibrant green, stands out well against darker colors.
    "#0074D9",  // Blue: A deep blue, providing a strong contrast with warmer colors.
    "#B10DC9",  // Purple: A rich purple, less common, adding variety to the palette.
    "#F012BE",  // Pink: A bright, almost neon pink, very eye-catching.
    "#111111",  // Black: A dark, solid black, standard for many patch cables.
    "#FFFFFF",  // White: Pure white, offering high contrast with darker backgrounds.
    "#AAAAAA"   // Gray: A neutral gray, for more muted connections.
]

const plugRegistry = [];

// Get device pixel ratio
const dpr = window.devicePixelRatio || 1;

// // Adjust canvas size for higher resolution
// canvas.width = canvas.clientWidth * dpr;
// canvas.height = canvas.clientHeight * dpr;
// context.scale(dpr, dpr);


//  utils

function getRandomCableColor() {
    const randomIndex = Math.floor(Math.random() * cableColors.length);
    return cableColors[randomIndex];
}

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

// // Snap to the nearest grid intersection if within 11 pixels
// function snapToGrid(x, y, gridSize = GRID_SIZE, snapThreshold = gridSize*0.4) {
//     const nearestX = Math.round(x / gridSize) * gridSize;
//     const nearestY = Math.round(y / gridSize) * gridSize;

//     const distance = Math.hypot(nearestX - x, nearestY - y);

//     if (distance <= snapThreshold) {
//         // Increase the stroke-width of the corresponding grid lines
//         highlightGridLines(nearestX, nearestY, 0.05);
//         return { x: nearestX, y: nearestY };
//     }

//     return { x, y };
// }

function snapToGrid(x, y, gridSize = GRID_SIZE, snapThreshold = gridSize * 0.5) {
    // First, try snapping to the nearest plug
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

    // If no plug is close enough, snap to the grid
    // const nearestX = Math.round(x / gridSize) * gridSize;
    // const nearestY = Math.round(y / gridSize) * gridSize;
    const nearestX = x / gridSize * gridSize;
    const nearestY = y / gridSize * gridSize;

    const gridDistance = Math.hypot(nearestX - x, nearestY - y);

    if (gridDistance <= snapThreshold) {
        // Increase the stroke-width of the corresponding grid lines
        highlightGridLines(nearestX, nearestY, 0.05);
        return { x: nearestX, y: nearestY };
    }

    // If no snap, return original position
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

// canvas.addEventListener('mouseup', () => {
//     if (points.length === 2) {
//         // When two points are defined, calculate the catenary and add to the list
//         const catenary = getCatenaryCurve(points[0], points[1], 500);
//         catenaries.push({ points: [...points], catenary });
//         points = []; // Reset points for the next catenary
//         draw(); // Re-draw after adding a new catenary
//     }
//     draggingPoint = null;
// });

canvas.addEventListener('mouseup', () => {
    if (points.length === 2) {
        // When two points are defined, calculate the catenary and add to the list
        const catenary = getCatenaryCurve(points[0], points[1], 500);
        catenaries.push({ points: [...points], catenary });

        // Change rectangle color to red if a plug was connected
        plugRegistry.forEach(plug => {
            if (
                (plug.x === points[0].x && plug.y === points[0].y) ||
                (plug.x === points[1].x && plug.y === points[1].y)
            ) {
                if (plug.rect) {
                    plug.rect.fill('#FF4136'); // Change rectangle color to red
                }
            }
        });

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
        context.lineWidth = 5;
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
        context.lineWidth = 5;
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

// Helper functions to draw basic SVG shapes

// function drawRectangle(x, y, width, height, lineColor = 'white', lineWidth = 1, cornerRadius = 0) {
//     drawSvg.rect(width, height)
//         .move(x, y)
//         .fill('none')
//         .stroke({ color: lineColor, width: lineWidth })
//         .radius(cornerRadius);  // Set the corner radius
// }

function drawRectangle(x, y, width, height, lineColor = 'white', lineWidth = 1, cornerRadius = 0) {
    return drawSvg.rect(width, height)
        .move(x, y)
        .fill('none')
        .stroke({ color: lineColor, width: lineWidth })
        .radius(cornerRadius);  // Set the corner radius
}

function drawCircle(cx, cy, r) {
    drawSvg.circle(r * 2).center(cx, cy).fill('none').stroke({ color: '#FFD300', width: 2 });
}

function drawEllipse(cx, cy, rx, ry) {
    drawSvg.ellipse(rx * 2, ry * 2).center(cx, cy).fill('none').stroke({ color: '#FFD300', width: 2 });
}

function drawText(textContent, x, y, fontSize = 16, fontColor = '#ffffff', letterSpacing = 0) {
    return drawSvg.text(textContent)
        .move(x, y)          // Position the text at (x, y)
        .font({
            size: fontSize,          // Set the font size
            fill: fontColor,         // Set the font color
            family: 'Roboto Mono',   // Use the web font
            weight: 100,             // Set the font weight to light
            letterSpacing: letterSpacing  // Set the letter spacing
        });
}

function drawLine(x1, y1, x2, y2, lineColor = '#ffffff', lineWidth = 1) {
    drawSvg.line(x1, y1, x2, y2)
        .stroke({ color: lineColor, width: lineWidth });
}

// function drawPlug(cx, cy, r = 4) {
//     drawSvg.circle(r * 2).center(cx, cy).fill('none').stroke({ color: '#fff', width: 1 });   
//     drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: '#fff', width: 2 });   
//     plugRegistry.push({ x: cx, y: cy });
// }

// function drawPlug(cx, cy, r = 4, associatedRect = null) {
//     drawSvg.circle(r * 2).center(cx, cy).fill('none').stroke({ color: '#fff', width: 1 });
//     drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: '#fff', width: 2 });

//     // Register the plug along with its associated rectangle
//     plugRegistry.push({ x: cx, y: cy, rect: associatedRect });
// }

function drawPlug(cx, cy, r = 4, associatedRect = null, associatedText = null) {
    drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: '#fff', width: 2 });
    const plugElement = drawSvg.circle(r * 2)
        .center(cx, cy)
        .fill('rgba(0, 0, 0, 0)')  // Transparent fill to ensure clickability
        .stroke({ color: '#fff', width: 1 })
        .css({ cursor: 'pointer' });  // Add pointer cursor for clickability indication

    // Register the plug along with its associated rectangle and text
    plugRegistry.push({ x: cx, y: cy, rect: associatedRect, text: associatedText });

    // Add event listener to change the text weight on selection
    plugElement.on('click', () => {
        console.log("CLICK!");
        if (associatedText) {
            associatedText.font({ weight: 'bold' });
        }
    });

    // Debugging: Test with a basic click event
    plugElement.on('click', () => {
        alert("Plug clicked at position: " + cx + ", " + cy);
    });
}

function drawButtons(cx, cy) {
    for (let y=0; y<3; y++) {
        for (let x=0; x<3; x++) {
            // drawSvg.rect(3, 3).move(cx + x*6, cy - 7 + y*5).fill('#fff');
            drawSvg.rect(3, 3).move(cx - 8 + x*4, cy - 5 + y*4).fill('#fff');
        }
    }
}

function drawPot(cx, cy, r=GRID_SIZE/2) {
    drawSvg.circle(r * 2-2).center(cx, cy).fill('#fff');
    drawSvg.circle(4).center(cx+GRID_SIZE/4, cy-GRID_SIZE/4+1).fill('#201E1F');
}

function drawKnob(cx, cy, r=GRID_SIZE/2) {
    drawSvg.circle(r * 2-4).center(cx+2, cy).fill('none').stroke({ color: '#fff', width: 1 });   
     drawSvg.line(cx+2, cy, cx+2, cy-GRID_SIZE/2+4).stroke({ color: '#fff', width: 1 });
}

function drawSwitch(cx, cy, state = 'on') {
    const outerRect = drawSvg.rect(GRID_SIZE / 2, GRID_SIZE)
        .move(cx, cy - GRID_SIZE / 2)
        .fill('none')
        .stroke({ color: '#fff', width: 1 });

    const innerRect = drawSvg.rect(GRID_SIZE / 2 - 4, GRID_SIZE / 2 - 2)
        .move(cx + 2, cy + (state === 'on' ? -GRID_SIZE / 2 + 2 : 0))
        .fill('#fff');
}

let increment = 12;
for (let y = GRID_SIZE * 2; y < svgHeight; y += GRID_SIZE * 3) {
    for (let x = GRID_SIZE * 2; x < svgWidth - 6*GRID_SIZE; x += GRID_SIZE * increment) {
        if (Math.random() < 0.6) {
            increment = 2;
            const textElement = drawText(getRandomAlphanumericString(), x - GRID_SIZE / 2, y - GRID_SIZE * 2, 8, 'rgba(255,255,255,0.4)');
            drawPlug(x, y, 4, null, textElement);

            if (Math.random() < 0.4) {
                drawPlug(x + GRID_SIZE + increment, y, 4, null, textElement);
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

