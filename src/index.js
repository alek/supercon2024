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
const GRID_SIZE = 25;


// color palette

// const palette = {
//     'background': "#252725",
//     "foreground": "#D9CDBE",
//     "text": '#D9CDBE',
//     "rectangle": 'rgba(217,205,190,0.3)',
//     "plugged": '#27A149',
//     "dotoff": '#252725',
//     "doton": '#D9CDBE',
//     "wires":  ['#D57729', '#25A7D8', '#27A14A']
// }

const palette = (() => {
    const palettes = [
    {
        "background": "#1C1C1B",
        "foreground": "#FFFFFF",
        "text": "#FFFFFF",
        "rectangle": "rgba(255,255,255,0.5)",
        "plugged": "#FFD700",
        "dotoff": "#FFFFFF",
        "doton": "#FFD700",
        "wires": ["#4CAF50", "#FFC107", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#CCCCCC",
        "text": "#CCCCCC",
        "rectangle": "rgba(204,204,204,0.5)",
        "plugged": "#FF3366",
        "dotoff": "#CCCCCC",
        "doton": "#FF3366",
        "wires": ["#00BCD4", "#FFEB3B", "#8BC34A"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#E0E0E0",
        "text": "#E0E0E0",
        "rectangle": "rgba(224,224,224,0.5)",
        "plugged": "#FF0033",
        "dotoff": "#E0E0E0",
        "doton": "#FF0033",
        "wires": ["#FF5722", "#FF9800", "#4CAF50"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#F5F5F5",
        "text": "#F5F5F5",
        "rectangle": "rgba(245,245,245,0.5)",
        "plugged": "#1E90FF",
        "dotoff": "#F5F5F5",
        "doton": "#1E90FF",
        "wires": ["#FF4500", "#9C27B0", "#00BCD4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FFD700",
        "text": "#FFD700",
        "rectangle": "rgba(255,215,0,0.5)",
        "plugged": "#4CAF50",
        "dotoff": "#FFD700",
        "doton": "#4CAF50",
        "wires": ["#FFEB3B", "#00BCD4", "#FF9800"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FF6347",
        "text": "#FF6347",
        "rectangle": "rgba(255,99,71,0.5)",
        "plugged": "#00FF7F",
        "dotoff": "#FF6347",
        "doton": "#00FF7F",
        "wires": ["#FF5722", "#FFEB3B", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#87CEEB",
        "text": "#87CEEB",
        "rectangle": "rgba(135,206,235,0.5)",
        "plugged": "#00BFFF",
        "dotoff": "#87CEEB",
        "doton": "#00BFFF",
        "wires": ["#8BC34A", "#FFEB3B", "#FF5722"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FF1493",
        "text": "#FF1493",
        "rectangle": "rgba(255,20,147,0.5)",
        "plugged": "#FFD700",
        "dotoff": "#FF1493",
        "doton": "#FFD700",
        "wires": ["#4CAF50", "#FFC107", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FFCC00",
        "text": "#FFCC00",
        "rectangle": "rgba(255,204,0,0.5)",
        "plugged": "#00FF00",
        "dotoff": "#FFCC00",
        "doton": "#00FF00",
        "wires": ["#FF5722", "#FF9800", "#4CAF50"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#00FFFF",
        "text": "#00FFFF",
        "rectangle": "rgba(0,255,255,0.5)",
        "plugged": "#FF00FF",
        "dotoff": "#00FFFF",
        "doton": "#FF00FF",
        "wires": ["#FF4500", "#9C27B0", "#00BCD4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FFFF00",
        "text": "#FFFF00",
        "rectangle": "rgba(255,255,0,0.5)",
        "plugged": "#00FF7F",
        "dotoff": "#FFFF00",
        "doton": "#00FF7F",
        "wires": ["#FFC107", "#4CAF50", "#FF9800"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#9ACD32",
        "text": "#9ACD32",
        "rectangle": "rgba(154,205,50,0.5)",
        "plugged": "#1E90FF",
        "dotoff": "#9ACD32",
        "doton": "#1E90FF",
        "wires": ["#FF5722", "#FFC107", "#00BCD4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FF8C00",
        "text": "#FF8C00",
        "rectangle": "rgba(255,140,0,0.5)",
        "plugged": "#FF3366",
        "dotoff": "#FF8C00",
        "doton": "#FF3366",
        "wires": ["#FFEB3B", "#00BCD4", "#FF9800"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#98FB98",
        "text": "#98FB98",
        "rectangle": "rgba(152,251,152,0.5)",
        "plugged": "#33FFCC",
        "dotoff": "#98FB98",
        "doton": "#33FFCC",
        "wires": ["#4CAF50", "#FFC107", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#F08080",
        "text": "#F08080",
        "rectangle": "rgba(240,128,128,0.5)",
        "plugged": "#FF0033",
        "dotoff": "#F08080",
        "doton": "#FF0033",
        "wires": ["#FF5722", "#FF9800", "#4CAF50"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FF00FF",
        "text": "#FF00FF",
        "rectangle": "rgba(255,0,255,0.5)",
        "plugged": "#FFD700",
        "dotoff": "#FF00FF",
        "doton": "#FFD700",
        "wires": ["#4CAF50", "#FFC107", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#FFDAB9",
        "text": "#FFDAB9",
        "rectangle": "rgba(255,218,185,0.5)",
        "plugged": "#FF4500",
        "dotoff": "#FFDAB9",
        "doton": "#FF4500",
        "wires": ["#FF5722", "#FFEB3B", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#ADFF2F",
        "text": "#ADFF2F",
        "rectangle": "rgba(173,255,47,0.5)",
        "plugged": "#FF6347",
        "dotoff": "#ADFF2F",
        "doton": "#FF6347",
        "wires": ["#8BC34A", "#FFEB3B", "#FF5722"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#4682B4",
        "text": "#4682B4",
        "rectangle": "rgba(70,130,180,0.5)",
        "plugged": "#FFCC00",
        "dotoff": "#4682B4",
        "doton": "#FFCC00",
        "wires": ["#4CAF50", "#FFC107", "#03A9F4"]
    },
    {
        "background": "#1C1C1B",
        "foreground": "#00FF00",
        "text": "#00FF00",
        "rectangle": "rgba(0,255,0,0.5)",
        "plugged": "#1E90FF",
        "dotoff": "#00FF00",
        "doton": "#1E90FF",
        "wires": ["#FF5722", "#FFC107", "#00BCD4"]
    }
]

    // Randomly select a palette and return it
    return palettes[Math.floor(Math.random() * palettes.length)];
})();

const plugRegistry = [];

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
        return { x: nearestPlug.x, y: nearestPlug.y, type: "plug" };
    }

    const nearestX = Math.round(x / gridSize) * gridSize;
    const nearestY = Math.round(y / gridSize) * gridSize;

    const gridDistance = Math.hypot(nearestX - x, nearestY - y);

    if (gridDistance <= snapThreshold) {
        highlightGridLines(nearestX, nearestY, 0.05);
        return { x: nearestX, y: nearestY, type: "grid" };
    }

    return { x, y, type: "miss" };
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
    let type;

    ({ x, y, type } = snapToGrid(x, y));

    if (type == "plug" && points.length < 2) {
        points.push({ x, y });

        points.forEach(point => {
            if (Math.hypot(point.x - x, point.y - y) < 10) {
                draggingPoint = point;
            }
        });

        draw();        
    }

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
                // Make associated text bold & colored
                if (plug.text) {
                    plug.text.font({ weight: '700' });  // Set the font weight to bold
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

    // catenaries.forEach(({ points: catenaryPoints, catenary }) => {
    catenaries.forEach(({ points: catenaryPoints, catenary }, index) => {
        
        let color = palette.wires[index%palette.wires.length]

        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = color;
        context.lineJoin = 'round';
        context.lineCap = 'round';

        drawResult(catenary, context);
        context.stroke();

        context.fillStyle = color;
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    if (points.length > 0) {
        context.fillStyle = palette.wires[(catenaries.length)%palette.wires.length];
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
        context.strokeStyle = palette.wires[catenaries.length%palette.wires.length];
        drawResult(tempCatenary, context);
        context.stroke();
    }
}

function drawTemporaryCatenary(x, y) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    // catenaries.forEach(({ points: catenaryPoints, catenary }) => {
    catenaries.forEach(({ points: catenaryPoints, catenary }, index) => {        
        let color = palette.wires[index%palette.wires.length]
        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = color;
        drawResult(catenary, context);
        context.stroke();

        context.fillStyle = color;
        catenaryPoints.forEach(point => {
            context.beginPath();
            context.arc(point.x, point.y, 5, 0, Math.PI * 2);
            context.fill();
        });
    });

    const tempCatenary = getCatenaryCurve(points[0], { x, y }, 500);
    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = palette.wires[catenaries.length%palette.wires.length];
    drawResult(tempCatenary, context);
    context.stroke();

    context.fillStyle = palette.wires[catenaries.length%palette.wires.length];
    context.beginPath();
    context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
    context.fill();
}

// Helper functions to draw basic SVG shapes
function drawRectangle(x, y, width, height, lineColor = palette.plugged, lineWidth = 1, cornerRadius = 0, fill = 'none') {
    return drawSvg.rect(width, height)
        .move(x, y)
        .fill(fill)
        .stroke({ color: lineColor, width: lineWidth })
        .radius(cornerRadius);
}

function drawText(textContent, x, y, fontSize = 16, fontColor = palette.foreground, letterSpacing = 0) {
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
    drawSvg.circle(r * 4).center(cx, cy).fill('none').stroke({ color: palette.foreground, width: 2 });
    const plugElement = drawSvg.circle(r * 2).center(cx, cy).fill('rgba(0, 0, 0, 0)').stroke({ color: palette.foreground, width: 1 });

    // Register the plug along with its associated rectangle and text
    plugRegistry.push({ x: cx, y: cy, rect: associatedRect, text: associatedText });

}

function drawButtons(cx, cy) {
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            drawSvg.rect(3, 3).move(cx - 8 + x * 4, cy - 5 + y * 4).fill(palette.foreground);
        }
    }
}

function drawPot(cx, cy, r = GRID_SIZE / 2) {
    drawSvg.circle(r * 2 - 2).center(cx, cy).fill(palette.foreground);
    drawSvg.circle(4).center(cx + GRID_SIZE / 4, cy - GRID_SIZE / 4 + 1).fill(palette.background);
}

function drawKnob(cx, cy, r = GRID_SIZE / 2) {
    drawSvg.circle(r * 2 - 4).center(cx + 2, cy).fill('none').stroke({ color: palette.foreground, width: 1 });
    drawSvg.line(cx + 2, cy, cx + 2, cy - GRID_SIZE / 2 + 4).stroke({ color: palette.foreground, width: 1 });
}

function drawSwitch(cx, cy, state = 'on') {
    drawSvg.rect(GRID_SIZE / 2, GRID_SIZE)
        .move(cx, cy - GRID_SIZE / 2)
        .fill('none')
        .stroke({ color: palette.foreground, width: 1 });

    drawSvg.rect(GRID_SIZE / 2 - 4, GRID_SIZE / 2 - 2)
        .move(cx + 2, cy + (state === 'on' ? -GRID_SIZE / 2 + 2 : 0))
        .fill(palette.foreground);
}

function generateRandomPattern(rows, columns) {
    const pattern = [];
    for (let row = 0; row < rows; row++) {
        const rowPattern = [];
        for (let col = 0; col < columns; col++) {
            rowPattern.push(Math.random() > 0.5 ? 1 : 0); // Randomly set each dot to 1 (on) or 0 (off)
        }
        pattern.push(rowPattern);
    }
    return pattern;
}

// pattern corresponding to current catenary connection state
function generateCatenaryPattern(rows, columns) {
    const pattern = [];
    for (let row = 0; row < rows; row++) {
        const rowPattern = [];
        for (let col = 0; col < columns; col++) {
            rowPattern.push(Math.random() > 0.1*catenaries.length ? 1 : 0); // Randomly set each dot to 1 (on) or 0 (off)
        }
        pattern.push(rowPattern);
    }
    return pattern;
}

// random matrix
// function renderDotMatrix(svgId, rows, columns, dotSize, gap) {
//     // Get the SVG element by ID
//     const svg = document.getElementById(svgId);
    
//     // Clear any existing content in the SVG
//     svg.innerHTML = '';

//     // Generate a random pattern
//     const pattern = generateRandomPattern(rows, columns);

//     // Loop through each row and column to create the dots
//     for (let row = 0; row < rows; row++) {
//         for (let col = 0; col < columns; col++) {
//             // Determine the x and y position for each dot
//             const x = col * (dotSize + gap);
//             const y = row * (dotSize + gap);

//             // Check if the dot should be "on" based on the pattern
//             const isOn = pattern[row][col];

//             // Create the circle element for the dot
//             const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
//             dot.setAttribute('cx', x + dotSize / 2);
//             dot.setAttribute('cy', y + dotSize / 2);
//             dot.setAttribute('r', dotSize / 2);
//             dot.setAttribute('fill', isOn ? palette.dotoff : palette.doton);

//             // Append the dot to the SVG
//             svg.appendChild(dot);
//         }
//     }
// }

function renderDotMatrix(svgId, rows, columns, dotSize, gap) {
    // Get the SVG element by ID
    const svg = document.getElementById(svgId);
    
    // Clear any existing content in the SVG
    svg.innerHTML = '';

    // Generate a random pattern
    let pattern = generateRandomPattern(rows, columns);
    if (catenaries.length > 0) {
        pattern = generateCatenaryPattern(rows, columns)
    }

    // Loop through each row and column to create the dots
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            // Determine the x and y position for each dot
            const x = col * (dotSize + gap);
            const y = row * (dotSize + gap);

            // Check if the dot should be "on" based on the pattern
            const isOn = pattern[row][col];

            // Create the circle element for the dot
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', x + dotSize / 2);
            dot.setAttribute('cy', y + dotSize / 2);
            dot.setAttribute('r', dotSize / 2);
            dot.setAttribute('fill', isOn ? palette.dotoff : palette.doton);

            // Append the dot to the SVG
            svg.appendChild(dot);
        }
    }
}


// Immediately render the dot matrix display once
renderDotMatrix('displaySvg', 5, 100, 10, 10);

// Set up an interval to redraw the pattern every second (1000 ms)
setInterval(() => {
    renderDotMatrix('displaySvg', 5, 100, 10, 10);
}, 250);

document.body.style.backgroundColor = palette.background;

// Example of how to draw and associate elements
let increment = 12;
for (let y = GRID_SIZE * 2; y < svgHeight; y += GRID_SIZE * 3) {
    for (let x = GRID_SIZE * 2; x < svgWidth - 6 * GRID_SIZE; x += GRID_SIZE * increment) {
        if (Math.random() < 0.9) {
            increment = 2;
            const textElement = drawText(getRandomAlphanumericString(), x - GRID_SIZE / 2, y - GRID_SIZE * 2, 8, palette.text);
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

            drawRectangle(x - GRID_SIZE, y - GRID_SIZE + 2, GRID_SIZE * (increment + 1.5), GRID_SIZE * 2 - 4, palette.rectangle, 1, 20);
            increment += 1.75;
        }
    }
}
