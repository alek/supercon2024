/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var catenary_curve__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! catenary-curve */ \"./node_modules/catenary-curve/lib/catenary-curve.js\");\n\n\nconst canvas = document.getElementById('catenaryCanvas');\nconst context = canvas.getContext('2d');\nconst svg = document.getElementById('catenarySvg');\n\nlet points = [];\nlet catenaries = [];\nlet draggingPoint = null;\nconst gridLines = []; // To store references to grid lines for easy access later\n\n// Function to render a grid on the SVG element with a background color and white grid lines\nfunction renderGrid(svg, gridSize = 50) {\n    const width = svg.clientWidth;\n    const height = svg.clientHeight;\n\n    // Clear existing grid lines and background (if any)\n    while (svg.firstChild) {\n        svg.removeChild(svg.firstChild);\n    }\n\n    // Add a background rectangle\n    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');\n    backgroundRect.setAttribute('x', 0);\n    backgroundRect.setAttribute('y', 0);\n    backgroundRect.setAttribute('width', width);\n    backgroundRect.setAttribute('height', height);\n    backgroundRect.setAttribute('fill', '#201E1F');\n    svg.appendChild(backgroundRect);\n\n    // Draw vertical grid lines\n    for (let x = 0; x <= width; x += gridSize) {\n        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');\n        line.setAttribute('x1', x);\n        line.setAttribute('y1', 0);\n        line.setAttribute('x2', x);\n        line.setAttribute('y2', height);\n        line.setAttribute('stroke', 'white');\n        line.setAttribute('stroke-width', '0.05');\n        svg.appendChild(line);\n        gridLines.push({ type: 'vertical', x, line });\n    }\n\n    // Draw horizontal grid lines\n    for (let y = 0; y <= height; y += gridSize) {\n        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');\n        line.setAttribute('x1', 0);\n        line.setAttribute('y1', y);\n        line.setAttribute('x2', width);\n        line.setAttribute('y2', y);\n        line.setAttribute('stroke', 'white');\n        line.setAttribute('stroke-width', '0.05');\n        svg.appendChild(line);\n        gridLines.push({ type: 'horizontal', y, line });\n    }\n}\n\n// Snap to the nearest grid intersection if within 11 pixels\nfunction snapToGrid(x, y, gridSize = 50, snapThreshold = 11) {\n    const nearestX = Math.round(x / gridSize) * gridSize;\n    const nearestY = Math.round(y / gridSize) * gridSize;\n\n    const distance = Math.hypot(nearestX - x, nearestY - y);\n\n    if (distance <= snapThreshold) {\n        // Increase the stroke-width of the corresponding grid lines\n        highlightGridLines(nearestX, nearestY, 0.05);\n        return { x: nearestX, y: nearestY };\n    }\n\n    return { x, y };\n}\n\n// Highlight grid lines corresponding to a specific grid intersection\nfunction highlightGridLines(x, y, strokeWidth = 0.05) {\n    gridLines.forEach(lineObj => {\n        if (lineObj.type === 'vertical' && lineObj.x === x) {\n            lineObj.line.setAttribute('stroke-width', strokeWidth);\n        }\n        if (lineObj.type === 'horizontal' && lineObj.y === y) {\n            // lineObj.line.setAttribute('stroke', '#FFD300');\n            lineObj.line.setAttribute('stroke-width', strokeWidth);\n        }\n    });\n}\n\n// Render the grid on the SVG\nrenderGrid(svg);\n\ncanvas.addEventListener('mousedown', (event) => {\n    let { offsetX: x, offsetY: y } = event;\n\n    // Snap to grid if close enough\n    ({ x, y } = snapToGrid(x, y));\n\n    if (points.length < 2) {\n        points.push({ x, y });\n    }\n\n    points.forEach(point => {\n        if (Math.hypot(point.x - x, point.y - y) < 10) {\n            draggingPoint = point;\n        }\n    });\n\n    draw();\n});\n\ncanvas.addEventListener('mousemove', (event) => {\n    let { offsetX: x, offsetY: y } = event;\n\n    if (draggingPoint) {\n        // Snap to grid if close enough\n        ({ x, y } = snapToGrid(x, y));\n        draggingPoint.x = x;\n        draggingPoint.y = y;\n        draw();\n    } else if (points.length === 1) {\n        // If one point is defined, show a \"dragging\" wire\n        drawTemporaryCatenary(x, y);\n    }\n});\n\ncanvas.addEventListener('mouseup', () => {\n    if (points.length === 2) {\n        // When two points are defined, calculate the catenary and add to the list\n        const catenary = (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.getCatenaryCurve)(points[0], points[1], 500);\n        catenaries.push({ points: [...points], catenary });\n        points = []; // Reset points for the next catenary\n        draw(); // Re-draw after adding a new catenary\n    }\n    draggingPoint = null;\n});\n\nfunction draw() {\n    // Clear the canvas without filling it with any color to maintain transparency\n    context.clearRect(0, 0, canvas.width, canvas.height);\n\n    // Draw all the catenaries\n    catenaries.forEach(({ points: catenaryPoints, catenary }) => {\n        // Draw the catenary curve\n        context.beginPath();\n        context.lineWidth = 2;\n        context.strokeStyle = 'white';\n        (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.drawResult)(catenary, context);\n        context.stroke();\n\n        // Draw the anchor points for this catenary\n        context.fillStyle = 'white';\n        catenaryPoints.forEach(point => {\n            context.beginPath();\n            context.arc(point.x, point.y, 5, 0, Math.PI * 2);\n            context.fill();\n        });\n    });\n\n    // Draw the points for the current catenary being defined\n    if (points.length > 0) {\n        context.fillStyle = 'white';\n        points.forEach(point => {\n            context.beginPath();\n            context.arc(point.x, point.y, 5, 0, Math.PI * 2);\n            context.fill();\n        });\n    }\n\n    // If we have two points, draw the current catenary being defined\n    if (points.length === 2) {\n        const tempCatenary = (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.getCatenaryCurve)(points[0], points[1], 500);\n        context.beginPath();\n        context.lineWidth = 2;\n        context.strokeStyle = '#FFD300';\n        (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.drawResult)(tempCatenary, context);\n        context.stroke();\n    }\n}\n\nfunction drawTemporaryCatenary(x, y) {\n    // Clear the canvas without filling it with any color to maintain transparency\n    context.clearRect(0, 0, canvas.width, canvas.height);\n\n    // Draw all the existing catenaries\n    catenaries.forEach(({ points: catenaryPoints, catenary }) => {\n        // Draw the existing catenary curves\n        context.beginPath();\n        context.lineWidth = 2;\n        context.strokeStyle = 'white';\n        (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.drawResult)(catenary, context);\n        context.stroke();\n\n        // Draw the anchor points for this catenary\n        context.fillStyle = 'white';\n        catenaryPoints.forEach(point => {\n            context.beginPath();\n            context.arc(point.x, point.y, 5, 0, Math.PI * 2);\n            context.fill();\n        });\n    });\n\n    // Draw the \"dragging\" wire from the first point to the current mouse position\n    const tempCatenary = (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.getCatenaryCurve)(points[0], { x, y }, 500);\n    context.beginPath();\n    context.lineWidth = 2;\n    context.strokeStyle = '#FFD300';\n    (0,catenary_curve__WEBPACK_IMPORTED_MODULE_0__.drawResult)(tempCatenary, context);\n    context.stroke();\n\n    // Draw the first point\n    context.fillStyle = 'white';\n    context.beginPath();\n    context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);\n    context.fill();\n}\n\n\n//# sourceURL=webpack:///./src/index.js?");

/***/ }),

/***/ "./node_modules/catenary-curve/lib/catenary-curve.js":
/*!***********************************************************!*\
  !*** ./node_modules/catenary-curve/lib/catenary-curve.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   drawResult: () => (/* binding */ I),\n/* harmony export */   drawResultCurve: () => (/* binding */ D),\n/* harmony export */   drawResultLine: () => (/* binding */ P),\n/* harmony export */   getCatenaryCurve: () => (/* binding */ L)\n/* harmony export */ });\nfunction R(t, e, n, i, u, c) {\n  const r = [\n    // Calculate the first point on the curve\n    [e.x, t * Math.cosh((e.x - i) / t) + u]\n  ], s = n.x - e.x, o = c - 1;\n  for (let x = 0; x < o; x++) {\n    const y = e.x + s * (x + 0.5) / o, f = t * Math.cosh((y - i) / t) + u;\n    r.push([y, f]);\n  }\n  return r.push([n.x, t * Math.cosh((n.x - i) / t) + u]), r;\n}\nfunction a(t) {\n  return {\n    type: \"line\",\n    start: t[0],\n    lines: t.slice(1)\n  };\n}\nfunction T(t, e, n, i) {\n  const u = Math.sqrt(n * n - e * e) / t;\n  let c = Math.acosh(u) + 1, r = -1, s = 0;\n  for (; Math.abs(c - r) > 1e-6 && s < i; )\n    r = c, c = c - (Math.sinh(c) - u * c) / (Math.cosh(c) - u), s++;\n  return t / (2 * c);\n}\nfunction p(t) {\n  let e = t.length - 1, n = t[1][0], i = t[1][1];\n  const u = [t[0][0], t[0][1]], c = [];\n  for (let r = 2; r < e; r++) {\n    const s = t[r][0], o = t[r][1], x = (s + n) * 0.5, y = (o + i) * 0.5;\n    c.push([n, i, x, y]), n = s, i = o;\n  }\n  return e = t.length, c.push([\n    t[e - 2][0],\n    t[e - 2][1],\n    t[e - 1][0],\n    t[e - 1][1]\n  ]), { type: \"quadraticCurve\", start: u, curves: c };\n}\nfunction I(t, e) {\n  t.type === \"quadraticCurve\" ? D(t, e) : t.type === \"line\" && P(t, e);\n}\nfunction P(t, e) {\n  e.moveTo(...t.start);\n  for (let n = 0; n < t.lines.length; n++)\n    e.lineTo(...t.lines[n]);\n}\nfunction D(t, e) {\n  e.moveTo(...t.start);\n  for (let n = 0; n < t.curves.length; n++)\n    e.quadraticCurveTo(...t.curves[n]);\n}\nfunction d(t, e) {\n  return { x: t.x - e.x, y: t.y - e.y };\n}\nfunction E(t, e) {\n  const n = d(t, e);\n  return Math.sqrt(Math.pow(n.x, 2) + Math.pow(n.y, 2));\n}\nfunction L(t, e, n, i = {}) {\n  const u = i.segments || 25, c = i.iterationLimit || 6, r = t.x > e.x, s = r ? e : t, o = r ? t : e;\n  if (E(s, o) < n) {\n    if (o.x - s.x > 0.01) {\n      const v = o.x - s.x, h = o.y - s.y, l = -T(v, h, n, c), M = (l * Math.log((n + h) / (n - h)) - v) * 0.5, C = l * Math.cosh(M / l), w = s.x - M, q = s.y - C, m = R(l, s, o, w, q, u);\n      return r && m.reverse(), p(m);\n    }\n    const f = (s.x + o.x) * 0.5, g = (s.y + o.y + n) * 0.5;\n    return a([\n      [s.x, s.y],\n      [f, g],\n      [o.x, o.y]\n    ]);\n  }\n  return a([\n    [s.x, s.y],\n    [o.x, o.y]\n  ]);\n}\n\n\n\n//# sourceURL=webpack:///./node_modules/catenary-curve/lib/catenary-curve.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;