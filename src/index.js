import { getCatenaryCurve, drawResult } from 'catenary-curve';
import { SVG } from '@svgdotjs/svg.js';

const canvas = document.getElementById('catenaryCanvas');
const context = canvas ? canvas.getContext('2d') : null;

const svgContainer = document.getElementById('catenarySvg');
const drawSvg = svgContainer ? SVG().addTo(svgContainer).size('100%', '100%') : null;
let [svgWidth, svgHeight] = svgContainer ? [svgContainer.getAttribute('width'), svgContainer.getAttribute('height')] : [0,0];

let points = [];
let catenaries = [];
let draggingPoint = null;
const gridLines = []; // To store references to grid lines for easy access later
const GRID_SIZE = 25;

// let pattern = generateRandomPattern()
let pattern = generateEmptyPattern()

const palette = {
    'background': "#232222",
    "foreground": "#D9CDBE",
    "text": '#E6E6D5',
    "rectangle": 'rgba(217,205,190,0.3)',
    "plugged": '#E6E5D7',
    "dotoff": '#232222',
    "doton": '#E6E5D7',
    "wires":  ['#D57729', '#25A7D8', '#27A14A']
}

let midiEnabled = false

const plugRegistry = [];
let midiOutputs = []; // Store all available MIDI output devices by index
let isMIDIInitialized = false; // Flag to track whether MIDI is initialized
// const deviceMap = [12, 0, 3, 4, 9, 11]
const deviceMap = [12, 0, 4, 3, 11, 3, 4]
const aMajorPentatonic = [
  21, 23, 25, 28, 30,  // A0
  33, 35, 37, 40, 42,  // A1
  45, 47, 49, 52, 54,  // A2
  57, 59, 61, 64, 66,  // A3
  69, 71, 73, 76, 78,  // A4 (Middle A)
  81, 83, 85, 88, 90,  // A5
  93, 95, 97, 100, 102,  // A6
  105, 107, 109, 112, 114,  // A7
  117, 119, 121, 124, 126  // A8
]

// Function to initialize MIDI access and store all available MIDI output devices
function initMIDI() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(
      function (midiAccess) {
        midiAccess.outputs.forEach((output) => {
          midiOutputs.push(output); // Store each output device in the array
        });

        if (midiOutputs.length === 0) {
          console.error('No MIDI output devices found.');
        } else {
          isMIDIInitialized = true; // Set flag to true once MIDI devices are initialized
          //console.log('MIDI output devices initialized:', midiOutputs);
          midiOutputs.forEach((output, index) => {
            console.log(`Device ${index}:`, output.name);
          });
        }
      },
      function () {
        console.error('Failed to get MIDI access.');
      }
    );
  } else {
    console.error('WebMIDI is not supported in this browser.');
  }
}

// Function to play a MIDI note on a specific device and channel by index
function playMIDINote(noteNumber, velocity = 127, duration = 1000, deviceIndex = 0, dot, midiChannel = 0) {
  if (!isMIDIInitialized) {
    console.error('MIDI devices are not yet initialized. Please wait for initialization.');
    return;
  }

  if (deviceIndex >= 0 && deviceIndex < midiOutputs.length) {
    let midiOutput = midiOutputs[deviceIndex];

    // Ensure the MIDI channel is between 0 and 15
    midiChannel = midiChannel < 0 ? 0 : (midiChannel > 15 ? 15 : midiChannel);

    // "Note On" and "Note Off" messages with the specified channel (0x90 is for channel 1, etc.)
    let noteOnMessage = [0x90 + midiChannel, noteNumber, velocity];
    let noteOffMessage = [0x80 + midiChannel, noteNumber, 0];

    // Send a "Note On" message
    midiOutput.send(noteOnMessage);

    // Send a "Note Off" message after the specified duration
    setTimeout(() => {
      midiOutput.send(noteOffMessage);
      if (dot) {
        dot.setAttribute('fill', palette.dotoff);
      }
    }, duration);

  } else {
    console.error('Invalid MIDI output device index.');
  }
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

function findIndexOfEntry(array, target) {
  return array.findIndex(entry => entry.x === target.x && entry.y === target.y);
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

// Function to handle both mouse and touch events
function getEventPosition(event) {
    if (event.touches && event.touches.length > 0) {
        return {
            offsetX: event.touches[0].clientX - canvas.getBoundingClientRect().left,
            offsetY: event.touches[0].clientY - canvas.getBoundingClientRect().top
        };
    }
    return { offsetX: event.offsetX, offsetY: event.offsetY };
}

// Event listeners for drawing catenaries and interacting with the canvas
if (canvas) {
    canvas.addEventListener('mousedown', (event) => {
        let { offsetX: x, offsetY: y } = getEventPosition(event);
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
}

if (canvas) {
    canvas.addEventListener('mousemove', (event) => {
        event.preventDefault(); // Prevent default behavior like scrolling    
        let { offsetX: x, offsetY: y } = getEventPosition(event);

        if (draggingPoint) {
            ({ x, y } = snapToGrid(x, y));
            draggingPoint.x = x;
            draggingPoint.y = y;
            draw();
        } else if (points.length === 1) {
            drawTemporaryCatenary(x, y);
        }
    });
}

// convert canvas point to grid coordinates
function getGridCoordinates(points) {
        const [x_end, y_end, x_start, y_start] = points
                .map(({ x, y }) => Math.floor(x / GRID_SIZE))
                .concat(points.map(({ y }) => Math.floor(y / GRID_SIZE)))
                .slice(0, 4);
        return {
            "start": {
                "x": x_start,
                "y": y_start
            }, 
            "end": {
                "x": x_end,
                "y": y_end
            }
        }    
}

if (canvas) {
    canvas.addEventListener('mouseup', () => {
        if (points.length === 2) {
            const catenary = getCatenaryCurve(points[0], points[1], 500);
            catenaries.push({ points: [...points], catenary });
            let coord = getGridCoordinates(points)
            
            let outPlug = snapToGrid(points[0].x, points[0].y)
            let inPlug = snapToGrid(points[1].x, points[1].y)

            let outIndex = findIndexOfEntry(plugRegistry, {'x': outPlug.x, 'y': outPlug.y})
            let inIndex = findIndexOfEntry(plugRegistry, {'x': inPlug.x, 'y': inPlug.y})

            pattern[0][outIndex] = 1
            pattern[2][inIndex] = 1

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
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    catenaries.forEach(({ points: catenaryPoints, catenary }, index) => {
        
        let color = palette.wires[index%palette.wires.length]

        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = color;
        context.lineJoin = 'round';
        context.lineCap = 'round';

        context.shadowColor = 'rgba(20, 20, 20, 0.2)'; // Shadow color (black with 50% opacity)
        context.shadowBlur = 5; // Blur level
        context.shadowOffsetX = 5; // Horizontal shadow offset
        context.shadowOffsetY = 5; // Vertical shadow offset

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

        context.shadowColor = 'rgba(20, 20, 20, 0.2)'; // Shadow color (black with 50% opacity)
        context.shadowBlur = 5; // Blur level
        context.shadowOffsetX = 5; // Horizontal shadow offset
        context.shadowOffsetY = 5; // Vertical shadow offset


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

    context.shadowColor = 'rgba(20, 20, 20, 0.2)'; // Shadow color (black with 50% opacity)
    context.shadowBlur = 5; // Blur level
    context.shadowOffsetX = 5; // Horizontal shadow offset
    context.shadowOffsetY = 5; // Vertical shadow offset

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

function generateRandomPattern(rows=5, columns=40) {
    const pattern = [];
    for (let row = 0; row < rows; row++) {
        const rowPattern = [];
        for (let col = 0; col < columns; col++) {
            rowPattern.push(Math.random() > 0.5 ? 1 : 0); // Randomly set each dot to 1 (on) or 0 (off)
            // rowPattern.push(1);
        }
        pattern.push(rowPattern);
    }
    return pattern;
}

function generateEmptyPattern(rows=5, columns=40) {
    const pattern = [];
    for (let row = 0; row < rows; row++) {
        const rowPattern = [];
        for (let col = 0; col < columns; col++) {
            rowPattern.push(0);
        }
        pattern.push(rowPattern);
    }
    return pattern;
}

function createMatrix(pointsArray, width=svgWidth, height=svgHeight, CONST=GRID_SIZE) {
    // Initialize the matrix with zeros
    const matrix = Array.from({ length: Math.floor(height / CONST) }, () =>
        Array(Math.floor(width / CONST)).fill(0)
    );

    // Iterate through each point in the pointsArray
    pointsArray.forEach(point => {
        let coord = getGridCoordinates(point.points)

        matrix[coord.start.x%4][coord.start.y%4] = 1
        matrix[coord.start.y%4][coord.end.y%4] = 1
    });

    return matrix;
}


// pattern corresponding to current catenary connection state
function generateCatenaryPattern(rows=5, columns=40) {
    const matrix = createMatrix(catenaries)
    const pattern = [];
    for (let row = 0; row < rows; row++) {
        const rowPattern = [];
        for (let col = 0; col < columns; col++) {
            if (matrix[row][col] == 1) {
                rowPattern.push(0)
            } else {
                rowPattern.push(1)
            }
        }
        pattern.push(rowPattern);
    }
    return pattern;
}

function shiftRight(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the result
    const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Perform the right shift with rotation
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Calculate the new column index with wrap-around
            const newCol = (col + 1) % numCols;
            result[row][newCol] = matrix[row][col];
        }
    }

    return result;
}

function shiftDown(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the result
    const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Perform the right shift with rotation
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const newRow = (row + 1) % numRows;
            result[newRow][col] = matrix[row][col];            
        }
    }
    return result;
}

function conwaysGameOfLifeStep(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the next generation
    const nextGen = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Helper function to count live neighbors
    function countLiveNeighbors(row, col) {
        let liveNeighbors = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue; // Skip the cell itself
                const newRow = row + i;
                const newCol = col + j;
                // Check if the neighbor is within bounds
                if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < numCols) {
                    liveNeighbors += matrix[newRow][newCol];
                }
            }
        }
        return liveNeighbors;
    }

    // Apply Conway's Game of Life rules to each cell
    let isSameAsPrevious = true; // Flag to check if the matrix stays the same
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const liveNeighbors = countLiveNeighbors(row, col);
            const currentState = matrix[row][col];

            // Apply the rules of the game
            if (currentState === 1 && (liveNeighbors < 2 || liveNeighbors > 3)) {
                nextGen[row][col] = 0; // Cell dies
            } else if (currentState === 1 && (liveNeighbors === 2 || liveNeighbors === 3)) {
                nextGen[row][col] = 1; // Cell stays alive
            } else if (currentState === 0 && liveNeighbors === 3) {
                nextGen[row][col] = 1; // Dead cell becomes alive
            }

            // Check if the cell state has changed compared to the previous generation
            if (nextGen[row][col] !== currentState) {
                isSameAsPrevious = false; // There is a change
            }
        }
    }

    // If the matrix is the same as the previous generation, reset to random state
    if (isSameAsPrevious) {
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                nextGen[row][col] = Math.random() > 0.5 ? 1 : 0; // Randomly set each cell to 0 or 1
            }
        }
    }

    return nextGen;
}



function shiftRightAndRotate(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the result
    const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Perform the right shift with rotation
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Calculate the new column index with wrap-around
            const newCol = (col + 1) % numCols;
            result[row][newCol] = matrix[row][col];
        }
    }

    return result;
}

function shiftDiagonally(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the result
    const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Perform the diagonal shift with wrap-around
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Calculate the new row and column indices with wrap-around
            const newRow = (row + 1) % numRows;
            const newCol = (col + 1) % numCols;
            result[newRow][newCol] = matrix[row][col];
        }
    }

    return result;
}



function shiftRightAndInvertIfSet(matrix) {
    // Handle the case where the matrix is empty
    if (matrix.length === 0 || matrix[0].length === 0) {
        return matrix;
    }

    // Get the number of rows and columns
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    // Create a new matrix to store the result
    const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

    // Perform the right shift with conditional inversion
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Calculate the new column index with wrap-around
            const newCol = (col + 1) % numCols;
            // Invert the value only if the original value is 1
            result[row][newCol] = matrix[row][col] === 1 ? 0 : matrix[row][col];
        }
    }

    return result;
}

function renderDotMatrix(svgId, rows=4, columns=32, dotSize=10, gap=10) {
    // Get the SVG element by ID
    const svg = document.getElementById(svgId);
    if (midiEnabled) {
        if (Math.random() < 0.5) {
            playMIDINote(36, 127, 50, 10, null, 3) 
        }
        if (Math.random() < 0.25) {
            playMIDINote(37, 127, 50, 10, null, 3) 
        }
        playMIDINote(38, Math.floor(Math.random()*127), 50, 10, null, 3) 
    }

    // Clear any existing content in the SVG
    svg.innerHTML = '';

    if (catenaries.length == 0) {
        pattern = conwaysGameOfLifeStep(pattern)
    } else {
        // pattern = shiftRightAndRotate(pattern) 
        // pattern = shiftDiagonally(pattern)
        pattern = shiftDown(pattern)

        if (Math.random() < 0.2) {
            pattern = shiftDiagonally(pattern)
        }

        if (Math.random() < 0.1) {
            pattern = shiftRightAndRotate(pattern) 
        }
        
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
            dot.setAttribute('fill', isOn ? palette.doton : palette.dotoff);

            // Append the dot to the SVG
            svg.appendChild(dot);
            // if (isOn && row > 0) {
            if (isOn) {
                if (Math.random() < 0.3) {
                    if (catenaries.length > 0) {
                        dot.setAttribute('fill', "#D57729");
                    }
                    if (midiEnabled) {
                        playMIDINote(aMajorPentatonic[col], 127, 200, deviceMap[row], dot) 
                    }
                }                
            }

        }

    }
}

function flip(p=0.3) {
    return (Math.random() < p)
}


// Immediately render the dot matrix display once
if (document.getElementById('displaySvg')) {

    if (window.innerWidth < 850) {
        let svgElement = document.getElementById('displaySvg');
        svgElement.setAttribute('width', window.innerWidth*0.8);

        let catenarySvg = document.getElementById('catenarySvg');
        catenarySvg.setAttribute('width', window.innerWidth*0.8);

        let catenaryCanvas = document.getElementById('catenaryCanvas');
        catenaryCanvas.setAttribute('width', window.innerWidth*0.8);

    }

    renderDotMatrix('displaySvg', 4, window.innerWidth < 600 ? Math.ceil(window.innerWidth/25) : 32, 10, 10);

    // Set up an interval to redraw the pattern every second (1000 ms)
    setInterval(() => {
        renderDotMatrix('displaySvg', 4, window.innerWidth < 600 ? Math.ceil(window.innerWidth/25) : 32, 10, 10);
    }, 200);
}

document.body.style.backgroundColor = palette.background;
if (midiEnabled) {
    initMIDI()
}

if (canvas && svgContainer) {
    let increment = 12;
    let maxWidth = svgWidth;
    if (window.innerWidth < 850) {
        maxWidth = window.innerWidth*0.9;
    }
    for (let y = GRID_SIZE * 2; y < svgHeight*0.6; y += GRID_SIZE * 3) {
        for (let x = GRID_SIZE * 2; x < maxWidth - 6 * GRID_SIZE; x += GRID_SIZE * increment) {
            if (flip(1)) {
                increment = 2;
                const textElement = drawText(getRandomAlphanumericString(), x - GRID_SIZE / 2, y - GRID_SIZE * 2, 8, palette.text);
                drawPlug(x, y, 4, null, textElement);

                if (flip() && GRID_SIZE + increment < maxWidth) {
                    drawPlug(x + GRID_SIZE + increment, y, null, textElement);
                    increment++;
                }

                if (flip() && GRID_SIZE + increment < maxWidth) {
                    drawButtons(x + GRID_SIZE * increment, y);
                    increment++;
                }

                if (flip() && GRID_SIZE + increment < maxWidth) {
                    drawPot(x + GRID_SIZE * increment, y);
                    increment++;
                }

                if (flip() && GRID_SIZE + increment < maxWidth) {
                    drawKnob(x + GRID_SIZE * increment, y);
                    increment++;
                }

                if (window.innerWidth > 500) {

                    if (flip() && GRID_SIZE + increment < maxWidth) {
                        drawSwitch(x + GRID_SIZE * increment, y, 'on');
                        increment++;
                    }

                    if (flip() && GRID_SIZE + increment < maxWidth) {
                        drawSwitch(x + GRID_SIZE * increment, y, 'off');
                        increment++;
                    }

                }

                if (increment > 2) {
                    drawRectangle(x - GRID_SIZE, y - GRID_SIZE + 2, GRID_SIZE * (increment + 1.5), GRID_SIZE * 2 - 4, palette.rectangle, 1, 20);
                } else {
                    drawRectangle(x - GRID_SIZE, y - GRID_SIZE + 2, GRID_SIZE * increment, GRID_SIZE * 2 - 4, palette.rectangle, 1, 20);
                    x -= GRID_SIZE*increment*0.5
                }

                increment += 1.75;
            }
        }
    }
}

// Function to render the talks in HTML
function renderTalks(talks, target) {
    const container = document.getElementById(target);
    if (!container) return; // Ensure the container exists

    // Iterate through each talk and create HTML structure for it
    talks.forEach(talk => {
        // Create a wrapper for each talk
        const talkDiv = document.createElement('div');
        talkDiv.classList.add('talk');

        // Create a container for headshots, to display them inline
        if (talk['Headshots'] && talk['Headshots'].length > 0) {
            const headshotContainer = document.createElement('div');
            headshotContainer.classList.add('headshot-container');
            
            talk['Headshots'].forEach(headshotUrl => {
                if (headshotUrl) {
                    const headshotImg = document.createElement('img');
                    headshotImg.src = `${headshotUrl}?w=150`;  // Append ?w=150 to the URL
                    headshotImg.alt = `${talk['Presenter Name']} Headshot`;
                    headshotImg.classList.add('headshot-img');
                    headshotContainer.appendChild(headshotImg);
                }
            });

            // Add the headshot container below the title
            talkDiv.appendChild(headshotContainer);
        }

        // Add the presenter name
        const name = document.createElement('h2');
        name.textContent = `${talk['Presenter Name']}`;
        talkDiv.appendChild(name);

        // Add pronouns if available
        if (talk['Pronouns']) {
            const pronouns = document.createElement('h4');
            pronouns.textContent = `${talk['Pronouns']}`;
            talkDiv.appendChild(pronouns);
        }

        // Add the talk title
        const title = document.createElement('h3');
        title.textContent = talk['Talk Title'];
        talkDiv.appendChild(title);

        // Add the talk description
        const description = document.createElement('p');
        description.textContent = talk['Talk Description (20-40 words)'];
        talkDiv.appendChild(description);

        // Add the presenter bio
        const bio = document.createElement('p');
        bio.innerHTML = `<strong>Bio:</strong> ${talk['Presenter Bio (edited, 20-40 words)']}`;
        talkDiv.appendChild(bio);

        // Add the day, time, and location information
        const scheduleInfo = document.createElement('p');
        scheduleInfo.innerHTML = `${talk['Day']} ${talk['Time']} @ ${talk['Location']}`;
        talkDiv.appendChild(scheduleInfo);

        // Append the talkDiv to the container
        container.appendChild(talkDiv);
    });
}



// Function to resize the elements
function resizeCatenaryElements() {
    // Check if screen width is lower than 540px
    if (window.innerWidth < 540) {
        // Select the elements
        const catenarySvg = document.getElementById('catenarySvg');
        const catenaryCanvas = document.getElementById('catenaryCanvas');

        if (catenarySvg && catenaryCanvas) {
            // Resize them to 80% of their current width
            const newWidth = catenarySvg.clientWidth * 0.8;
            catenarySvg.setAttribute('width', newWidth);
            catenaryCanvas.setAttribute('width', newWidth);
        }
        [svgWidth, svgHeight] = svgContainer ? [svgContainer.getAttribute('width'), svgContainer.getAttribute('height')] : [0,0];
        console.log(svgWidth)
    }
}

function getSpeakerTalks(schedule) {
    return schedule
        .filter(entry => entry.Type === "speaker")
        .map(speaker => {
            // Collect headshots
            let headshots = [];
            if (speaker.Headshot) headshots.push(speaker.Headshot);
            if (speaker["Headshot 1/2"]) headshots.push(speaker["Headshot 1/2"]);
            if (speaker["Headshot 2/2"]) headshots.push(speaker["Headshot 2/2"]);
            if (speaker["Headshot 3"]) headshots.push(speaker["Headshot 3"]);

            return {
                "Final Copy Approved": "TRUE", // Assuming this is always "TRUE" for this case
                "Day": speaker.Day || "",
                "Time": speaker.Time || "",
                "Location": speaker.Location || "",
                "Announced?": "",               // Empty field, you can adjust this based on other data
                "Presenter Name": speaker["First and Last Name: "] || "",
                "Pronouns": "",                 // This information is missing from the original data, add manually if available
                "Presenter Bio (edited, 20-40 words)": speaker["Presenter Bio (edited, 20-40 words)"] || "",
                "Presenter Bio (original)": "", // Assuming original bio not available from the current data
                "Talk Title": speaker["Talk Title"] || "",
                "Talk Description (20-40 words)": speaker["Talk Description (20-40 words)"] || "",
                "Talk Description (original)": speaker["Talk Description (20-40 words)"] || "", // Assuming original and edited are the same here
                "Notes ": "",                   // Placeholder for any notes
                "Headshots": headshots,         // Array of available headshots
                "copy emailed for approval": "TRUE" // Assuming always TRUE for this case
            };
        });
}

function getWorkshopEntries(schedule) {
    return schedule
        .filter(entry => entry.Type === "workshop")
        .map(workshop => {
            // Collect headshots
            let headshots = [];
            if (workshop.Headshot) headshots.push(workshop.Headshot);
            if (workshop["Headshot 1/2"]) headshots.push(workshop["Headshot 1/2"]);
            if (workshop["Headshot 2/2"]) headshots.push(workshop["Headshot 2/2"]);
            if (workshop["Headshot 3"]) headshots.push(workshop["Headshot 3"]);

            return {
                "Final Copy Approved": "TRUE", // Assuming this is always "TRUE" for this case
                "Day": workshop.Day || "",
                "Time": workshop.Time || "",
                "Location": workshop.Location || "",
                "Presenter Name": workshop["First and Last Name: "] || "",
                "Pronouns": "",                 // Pronouns are not provided, so leaving empty
                "Presenter Bio (edited, 20-40 words)": workshop["Presenter Bio (edited, 20-40 words)"] || "",
                "Presenter Bio (original)": "", // Assuming original bio is not provided in the data
                "Talk Title": workshop["Talk Title"] || "",
                "Workshop Description (edited, 20-40 words)": workshop["Talk Description (20-40 words)"] || "",
                "Talk Description (20-40 words)": workshop["Talk Description (20-40 words)"] || "", // Assuming original and edited are the same here
                "Notes": "",                    // Placeholder for any notes
                "Headshots": headshots,          // Array of available headshots
                "final copy emailed for approval": "TRUE" // Assuming this is always "TRUE"
            };
        });
}

// Function to render the schedule in HTML, grouped by day and sorted by time (time prioritized over location)
function renderSchedule(schedule, target) {
    const container = document.getElementById(target);
    if (!container) return; // Ensure the container exists

    // Clear the container before rendering the schedule
    container.innerHTML = '';

    // Define the correct day order
    const dayOrder = ['Friday', 'Saturday', 'Sunday'];

    // Helper function to convert time strings to a comparable format (24-hour format)
    function parseTime(timeStr) {
        if (!timeStr) return null; // Handle missing time
        const [time, modifier] = timeStr.split(' '); // Split time and AM/PM
        let [hours, minutes] = time.split(':').map(Number); // Split hours and minutes
        if (modifier === 'PM' && hours !== 12) hours += 12; // Convert PM to 24-hour format
        if (modifier === 'AM' && hours === 12) hours = 0; // Handle 12 AM as 0 hours
        return hours * 60 + minutes; // Return total minutes for easy comparison
    }

    // Group the schedule entries by day
    const groupedByDay = schedule.reduce((acc, item) => {
        const day = item['Day'] || 'No Day Specified'; // Handle missing days
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
    }, {});

    // Sort and render the schedule entries according to the correct day order
    dayOrder.forEach(day => {
        if (groupedByDay[day]) {
            // Sort the entries by time within the day (time is the primary sort criterion)
            // groupedByDay[day].sort((a, b) => {
            //     const timeA = parseTime(a['Time']);
            //     const timeB = parseTime(b['Time']);
            //     return (timeA || 0) - (timeB || 0); // Handle null times by pushing them to the end
            // });

            // Create an h1 for the day
            const dayHeader = document.createElement('h1');
            dayHeader.textContent = day;
            container.appendChild(dayHeader);

            // Create a flexbox container for the day's schedule items
            const flexContainer = document.createElement('div');
            flexContainer.classList.add('schedule-flex-container');

            // Iterate through each schedule item for the day and create HTML structure
            groupedByDay[day].forEach(item => {
                // Create a flex item for each schedule entry
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('schedule-item');

                // Add time and location first, without "Time:" and "Location:" labels
                const time = document.createElement('h4');
                const timeText = item['Time'] || 'TBD';
                time.textContent = `${timeText}`;
                time.classList.add('time');
                itemDiv.appendChild(time);

                const location = document.createElement('h4');
                const locationText = item['Location'] || 'TBD';
                location.textContent = `${locationText}`;
                location.classList.add('location');
                itemDiv.appendChild(location);

                // Add the event title (use "First and Last Name" or Talk Title)
                const title = document.createElement('h3');
                const eventTitle = item["Talk Title"] || item["First and Last Name: "] || "Untitled Event";
                title.textContent = eventTitle;
                title.classList.add('event-title');
                itemDiv.appendChild(title);

                // Add presenter name if available and not equal to talk title
                if (item["First and Last Name: "] && item["Talk Title"]) {
                    const name = document.createElement('p');
                    name.textContent = item["First and Last Name: "];
                    name.classList.add('presenter-name');
                    itemDiv.appendChild(name);
                }

                // Add talk description if available
                if (item["Talk Description (20-40 words)"]) {
                    const description = document.createElement('p');
                    description.textContent = item["Talk Description (20-40 words)"];
                    description.classList.add('description');
                    itemDiv.appendChild(description);
                }

                // Append the itemDiv to the flexbox container
                flexContainer.appendChild(itemDiv);
            });

            // Append the flex container to the main container
            container.appendChild(flexContainer);
        }
    });
}


renderTalks(getSpeakerTalks(SCHEDULE), 'speakers');
renderTalks(getWorkshopEntries(SCHEDULE), 'workshops');
renderSchedule(SCHEDULE, 'schedule');
