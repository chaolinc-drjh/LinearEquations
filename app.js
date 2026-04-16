/* ========================================
   二元一次方程式圖形練習 - Main Application
   ======================================== */

(function () {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        GRID_RANGE: 10,        // -10 to 10
        GRID_PADDING: 40,      // px padding around grid
        POINT_RADIUS: 10,      // visual radius of draggable points
        SNAP_THRESHOLD: 0.4,   // snap to integer if within this distance
        TOTAL_QUESTIONS: 10,
        POINTS_PER_QUESTION: 10,
        HIT_RADIUS: 20,        // px radius for click detection
    };

    // ========================================
    // State
    // ========================================
    const state = {
        round: 1,
        questionIndex: 0,
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        equation: null,      // { a, b, c } for ax + by = c
        points: [null, null], // [{x, y}, {x, y}]
        dragging: -1,         // index of point being dragged, -1 if none
        answered: false,
        lastCorrect: false,
        showCorrectLine: false, // whether to draw the correct answer line
        needsHint: false,
        examplePoints: [], // store example points to draw them on canvas
    };

    // ========================================
    // DOM References
    // ========================================
    const $ = (id) => document.getElementById(id);
    const canvas = $('gridCanvas');
    const ctx = canvas.getContext('2d');
    const wrapper = $('canvasWrapper');

    const elEquationText = $('equationText');
    const elQuestionCounter = $('questionCounter');
    const elRoundNumber = $('roundNumber');
    const elPoint1Value = $('point1Value');
    const elPoint2Value = $('point2Value');
    const elPoint1Row = $('point1Row');
    const elPoint2Row = $('point2Row');
    const elScoreValue = $('scoreValue');
    const elScoreBar = $('scoreBar');
    const elCorrectCount = $('correctCount');
    const elWrongCount = $('wrongCount');
    const btnSubmit = $('btnSubmit');
    const btnReset = $('btnReset');

    // Inline Feedback
    const elInlineFeedback = $('inlineFeedback');
    const elInlineFeedbackIcon = $('inlineFeedbackIcon');
    const elInlineFeedbackTitle = $('inlineFeedbackTitle');
    const elInlineFeedbackMessage = $('inlineFeedbackMessage');
    const elInlineFeedbackScoreText = $('inlineFeedbackScoreText');
    const btnNextInline = $('btnNextInline');
    const btnNextInlineText = $('btnNextInlineText');

    // Round complete
    const elRoundOverlay = $('roundOverlay');
    const elFinalScore = $('finalScore');
    const elAccuracy = $('accuracy');
    const elRoundStars = $('roundStars');
    const btnNewRound = $('btnNewRound');

    // ========================================
    // Canvas Setup
    // ========================================
    function resizeCanvas() {
        const rect = wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const size = Math.min(rect.width, rect.height);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function getCanvasSize() {
        return Math.min(
            parseFloat(canvas.style.width),
            parseFloat(canvas.style.height)
        );
    }

    // Convert grid coordinate to canvas pixel
    function gridToPixel(gx, gy) {
        const size = getCanvasSize();
        const pad = CONFIG.GRID_PADDING;
        const range = CONFIG.GRID_RANGE;
        const drawSize = size - pad * 2;
        const step = drawSize / (range * 2);
        const px = pad + (gx + range) * step;
        const py = pad + (range - gy) * step;
        return { x: px, y: py };
    }

    // Convert canvas pixel to grid coordinate
    function pixelToGrid(px, py) {
        const size = getCanvasSize();
        const pad = CONFIG.GRID_PADDING;
        const range = CONFIG.GRID_RANGE;
        const drawSize = size - pad * 2;
        const step = drawSize / (range * 2);
        const gx = (px - pad) / step - range;
        const gy = range - (py - pad) / step;
        return { x: gx, y: gy };
    }

    // Snap to nearest integer
    function snapToGrid(val) {
        const rounded = Math.round(val);
        return rounded; // always snap to grid
    }

    // Clamp value to grid range
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // ========================================
    // Drawing
    // ========================================
    function draw() {
        const size = getCanvasSize();
        ctx.clearRect(0, 0, size, size);

        drawGrid(size);

        // Draw the correct answer line in RED when wrong
        if (state.showCorrectLine && !state.lastCorrect) {
            drawCorrectAnswerLine(size);
        }

        drawUserLine(size);
        drawPoints(size);
        drawExamplePoints(size);
    }

    function drawGrid(size) {
        const pad = CONFIG.GRID_PADDING;
        const range = CONFIG.GRID_RANGE;
        const drawSize = size - pad * 2;
        const step = drawSize / (range * 2);

        // Minor grid lines
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--grid-line').trim() || 'rgba(120,100,255,0.08)';
        ctx.lineWidth = 1;

        for (let i = -range; i <= range; i++) {
            const pos = pad + (i + range) * step;

            // Vertical
            ctx.beginPath();
            ctx.moveTo(pos, pad);
            ctx.lineTo(pos, size - pad);
            ctx.stroke();

            // Horizontal
            ctx.beginPath();
            ctx.moveTo(pad, pos);
            ctx.lineTo(size - pad, pos);
            ctx.stroke();
        }

        // Major grid lines every 5
        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--grid-line-major').trim() || 'rgba(120,100,255,0.18)';
        ctx.lineWidth = 1;

        for (let i = -range; i <= range; i += 5) {
            if (i === 0) continue;
            const pos = pad + (i + range) * step;

            ctx.beginPath();
            ctx.moveTo(pos, pad);
            ctx.lineTo(pos, size - pad);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pad, pos);
            ctx.lineTo(size - pad, pos);
            ctx.stroke();
        }

        // Axes
        const origin = gridToPixel(0, 0);

        ctx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--grid-axis').trim() || 'rgba(200,190,255,0.6)';
        ctx.lineWidth = 2;

        // X axis
        ctx.beginPath();
        ctx.moveTo(pad, origin.y);
        ctx.lineTo(size - pad, origin.y);
        ctx.stroke();

        // Y axis
        ctx.beginPath();
        ctx.moveTo(origin.x, pad);
        ctx.lineTo(origin.x, size - pad);
        ctx.stroke();

        // Arrow heads
        const arrowSize = 8;

        // X axis arrow (right)
        ctx.beginPath();
        ctx.moveTo(size - pad, origin.y);
        ctx.lineTo(size - pad - arrowSize, origin.y - arrowSize / 2);
        ctx.lineTo(size - pad - arrowSize, origin.y + arrowSize / 2);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        // Y axis arrow (up)
        ctx.beginPath();
        ctx.moveTo(origin.x, pad);
        ctx.lineTo(origin.x - arrowSize / 2, pad + arrowSize);
        ctx.lineTo(origin.x + arrowSize / 2, pad + arrowSize);
        ctx.closePath();
        ctx.fill();

        // Labels
        ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--grid-text').trim() || 'rgba(200,190,255,0.5)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X axis labels
        for (let i = -range; i <= range; i++) {
            if (i === 0) continue;
            const p = gridToPixel(i, 0);
            ctx.fillText(i.toString(), p.x, p.y + 6);
        }

        // Y axis labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = -range; i <= range; i++) {
            if (i === 0) continue;
            const p = gridToPixel(0, i);
            ctx.fillText(i.toString(), p.x - 6, p.y);
        }

        // Origin label
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('O', origin.x - 6, origin.y + 6);

        // Axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '13px "Noto Sans TC", sans-serif';
        ctx.fillText('x', size - pad + 5, origin.y - 5);
        ctx.fillText('y', origin.x + 12, pad - 2);
    }

    // ========================================
    // Draw the CORRECT answer line in RED
    // ========================================
    function drawCorrectAnswerLine(size) {
        if (!state.equation) return;
        const { a, b, c } = state.equation;
        const validPts = findValidPoints(a, b, c);
        if (validPts.length < 2) return;

        const pad = CONFIG.GRID_PADDING;

        // Use first and last valid points for maximum extent
        const gp1 = validPts[0];
        const gp2 = validPts[validPts.length - 1];
        const px1 = gridToPixel(gp1.x, gp1.y);
        const px2 = gridToPixel(gp2.x, gp2.y);

        // Extend to grid boundaries
        const dx = px2.x - px1.x;
        const dy = px2.y - px1.y;
        let extStart, extEnd;

        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

        if (Math.abs(dx) < 0.001) {
            extStart = { x: px1.x, y: pad };
            extEnd = { x: px1.x, y: size - pad };
        } else if (Math.abs(dy) < 0.001) {
            extStart = { x: pad, y: px1.y };
            extEnd = { x: size - pad, y: px1.y };
        } else {
            const slope = dy / dx;
            const intercept = px1.y - slope * px1.x;
            const candidates = [];

            const yAtLeft = slope * pad + intercept;
            if (yAtLeft >= pad && yAtLeft <= size - pad) candidates.push({ x: pad, y: yAtLeft });

            const yAtRight = slope * (size - pad) + intercept;
            if (yAtRight >= pad && yAtRight <= size - pad) candidates.push({ x: size - pad, y: yAtRight });

            const xAtTop = (pad - intercept) / slope;
            if (xAtTop >= pad && xAtTop <= size - pad) candidates.push({ x: xAtTop, y: pad });

            const xAtBottom = (size - pad - intercept) / slope;
            if (xAtBottom >= pad && xAtBottom <= size - pad) candidates.push({ x: xAtBottom, y: size - pad });

            if (candidates.length < 2) return;
            candidates.sort((a, b) => a.x - b.x || a.y - b.y);
            extStart = candidates[0];
            extEnd = candidates[candidates.length - 1];
        }

        // Draw the correct line in solid RED
        ctx.save();

        // Glow effect
        ctx.shadowColor = 'rgba(255, 60, 60, 0.6)';
        ctx.shadowBlur = 12;

        ctx.strokeStyle = '#ff3c3c';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(extStart.x, extStart.y);
        ctx.lineTo(extEnd.x, extEnd.y);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Draw "正確答案" label near the line
        const midX = (extStart.x + extEnd.x) / 2;
        const midY = (extStart.y + extEnd.y) / 2;

        ctx.fillStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Draw label background
        const labelText = '正確答案';
        const textMetrics = ctx.measureText(labelText);
        const labelX = midX + 10;
        const labelY = midY - 10;

        ctx.fillStyle = 'rgba(30, 20, 40, 0.85)';
        ctx.beginPath();
        ctx.roundRect(labelX - 4, labelY - 16, textMetrics.width + 8, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#ff3c3c';
        ctx.fillText(labelText, labelX, labelY);

        ctx.restore();
    }

    function drawUserLine(size) {
        const p1 = state.points[0];
        const p2 = state.points[1];

        if (!p1 || !p2) return;

        const pad = CONFIG.GRID_PADDING;
        const px1 = gridToPixel(p1.x, p1.y);
        const px2 = gridToPixel(p2.x, p2.y);

        // Extend the line to edges of the grid
        const dx = px2.x - px1.x;
        const dy = px2.y - px1.y;

        let extStart, extEnd;

        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

        if (Math.abs(dx) < 0.001) {
            extStart = { x: px1.x, y: pad };
            extEnd = { x: px1.x, y: size - pad };
        } else if (Math.abs(dy) < 0.001) {
            extStart = { x: pad, y: px1.y };
            extEnd = { x: size - pad, y: px1.y };
        } else {
            const slope = dy / dx;
            const intercept = px1.y - slope * px1.x;

            const candidates = [];

            const yAtLeft = slope * pad + intercept;
            if (yAtLeft >= pad && yAtLeft <= size - pad) candidates.push({ x: pad, y: yAtLeft });

            const yAtRight = slope * (size - pad) + intercept;
            if (yAtRight >= pad && yAtRight <= size - pad) candidates.push({ x: size - pad, y: yAtRight });

            const xAtTop = (pad - intercept) / slope;
            if (xAtTop >= pad && xAtTop <= size - pad) candidates.push({ x: xAtTop, y: pad });

            const xAtBottom = (size - pad - intercept) / slope;
            if (xAtBottom >= pad && xAtBottom <= size - pad) candidates.push({ x: xAtBottom, y: size - pad });

            if (candidates.length < 2) return;

            candidates.sort((a, b) => a.x - b.x || a.y - b.y);
            extStart = candidates[0];
            extEnd = candidates[candidates.length - 1];
        }

        // Determine line color
        let lineColor, lineColorDim;
        if (state.answered) {
            if (state.lastCorrect) {
                lineColor = '#00d4aa';
                lineColorDim = 'rgba(0, 212, 170, 0.4)';
            } else {
                // User's wrong line: dimmed grey
                lineColor = 'rgba(150, 150, 170, 0.6)';
                lineColorDim = 'rgba(150, 150, 170, 0.3)';
            }
        } else {
            lineColor = 'rgba(255, 255, 255, 0.7)';
            lineColorDim = 'rgba(255, 255, 255, 0.35)';
        }

        // Draw extended line (dimmer)
        ctx.save();
        ctx.strokeStyle = lineColorDim;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(extStart.x, extStart.y);
        ctx.lineTo(extEnd.x, extEnd.y);
        ctx.stroke();

        // Draw segment between points (brighter)
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;

        // If wrong answer, use dashed line for user's answer
        if (state.answered && !state.lastCorrect) {
            ctx.setLineDash([8, 6]);
        }

        ctx.beginPath();
        ctx.moveTo(px1.x, px1.y);
        ctx.lineTo(px2.x, px2.y);
        ctx.stroke();

        // Add "你的答案" label when wrong
        if (state.answered && !state.lastCorrect) {
            const midX = (px1.x + px2.x) / 2;
            const midY = (px1.y + px2.y) / 2;

            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(30, 20, 40, 0.85)';
            ctx.font = 'bold 12px "Noto Sans TC", sans-serif';
            const labelText = '你的答案';
            const tm = ctx.measureText(labelText);

            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY + 8, tm.width + 8, 18, 4);
            ctx.fill();

            ctx.fillStyle = 'rgba(150, 150, 170, 0.9)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(labelText, midX, midY + 10);
        }

        ctx.restore();
    }

    function drawPoints() {
        state.points.forEach((pt, i) => {
            if (!pt) return;
            const px = gridToPixel(pt.x, pt.y);

            let color, glowColor;
            if (state.answered && !state.lastCorrect) {
                // Dimmed colors for wrong answer points
                color = 'rgba(150, 150, 170, 0.7)';
                glowColor = 'rgba(150, 150, 170, 0.2)';
            } else {
                color = i === 0 ? '#ff6b9d' : '#4dc9f6';
                glowColor = i === 0 ? 'rgba(255,107,157,0.4)' : 'rgba(77,201,246,0.4)';
            }

            // Glow
            const gradient = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, 20);
            gradient.addColorStop(0, glowColor);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px.x, px.y, 20, 0, Math.PI * 2);
            ctx.fill();

            // Point
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px.x, px.y, CONFIG.POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();

            // White center
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(px.x, px.y, 3, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = color;
            ctx.font = 'bold 12px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const label = i === 0 ? 'A' : 'B';
            ctx.fillText(`${label}(${pt.x},${pt.y})`, px.x + 14, px.y - 8);
        });
    }

    function drawExamplePoints() {
        if (!state.showCorrectLine || state.lastCorrect || !state.examplePoints || state.examplePoints.length === 0) return;
        
        state.examplePoints.forEach((pt) => {
            const px = gridToPixel(pt.x, pt.y);
            
            // White outline for contrast
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px.x, px.y, 7, 0, Math.PI * 2);
            ctx.fill();

            // Vibrant red point
            ctx.fillStyle = '#ff3c3c';
            ctx.beginPath();
            ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Coordinate label
            ctx.fillStyle = '#ff1a1a';
            ctx.font = 'bold 12px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            // Background for label
            const labelText = `(${pt.x},${pt.y})`;
            const tm = ctx.measureText(labelText);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.roundRect(px.x - tm.width / 2 - 4, px.y + 7, tm.width + 8, 16, 4);
            ctx.fill();

            // Text
            ctx.fillStyle = '#cc0000';
            ctx.fillText(labelText, px.x, px.y + 8);
        });
    }

    // ========================================
    // Equation Generation
    // ========================================
    function getGcd(x, y) {
        x = Math.abs(x);
        y = Math.abs(y);
        while(y) {
            let t = y;
            y = x % y;
            x = t;
        }
        return x;
    }

    function generateEquation() {
        let a, b, c;
        let attempts = 0;

        do {
            a = randomInt(-5, 5);
            b = randomInt(-5, 5);

            if (a === 0 && b === 0) continue;

            const px = randomInt(-CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);
            const py = randomInt(-CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);
            c = a * px + b * py;

            const validPoints = findValidPoints(a, b, c);
            if (validPoints.length >= 2) {
                const g = getGcd(getGcd(a, b), c);
                if (g > 1) {
                    a /= g;
                    b /= g;
                    c /= g;
                }
                break;
            }

            attempts++;
        } while (attempts < 100);

        state.equation = { a, b, c };
        return state.equation;
    }

    function findValidPoints(a, b, c) {
        const range = CONFIG.GRID_RANGE;
        const points = [];

        if (b !== 0) {
            for (let x = -range; x <= range; x++) {
                const yNum = c - a * x;
                if (yNum % b === 0) {
                    const y = yNum / b;
                    if (y >= -range && y <= range) {
                        points.push({ x, y });
                    }
                }
            }
        } else if (a !== 0) {
            if (c % a === 0) {
                const x = c / a;
                if (x >= -range && x <= range) {
                    for (let y = -range; y <= range; y++) {
                        points.push({ x, y });
                    }
                }
            }
        }

        return points;
    }

    function formatEquation(eq) {
        const { a, b, c } = eq;
        let parts = [];
        const vx = '<span class="math-var">x</span>';
        const vy = '<span class="math-var">y</span>';

        if (a !== 0) {
            if (a === 1) parts.push(vx);
            else if (a === -1) parts.push(`−${vx}`);
            else if (a > 0) parts.push(`${a}${vx}`);
            else parts.push(`−${Math.abs(a)}${vx}`);
        }

        if (b !== 0) {
            if (parts.length > 0) {
                if (b === 1) parts.push(`+ ${vy}`);
                else if (b === -1) parts.push(`− ${vy}`);
                else if (b > 0) parts.push(`+ ${b}${vy}`);
                else parts.push(`− ${Math.abs(b)}${vy}`);
            } else {
                if (b === 1) parts.push(vy);
                else if (b === -1) parts.push(`−${vy}`);
                else if (b > 0) parts.push(`${b}${vy}`);
                else parts.push(`−${Math.abs(b)}${vy}`);
            }
        }

        return `${parts.join(' ')} = ${c}`;
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ========================================
    // Validation
    // ========================================
    function validateAnswer() {
        const p1 = state.points[0];
        const p2 = state.points[1];
        const { a, b, c } = state.equation;

        if (!p1 || !p2) return false;

        // Both points must be different
        if (p1.x === p2.x && p1.y === p2.y) return false;

        // Both points must satisfy the equation ax + by = c
        const check1 = a * p1.x + b * p1.y;
        const check2 = a * p2.x + b * p2.y;

        return check1 === c && check2 === c;
    }

    // ========================================
    // UI Update
    // ========================================
    function updateUI() {
        elQuestionCounter.textContent = `${state.questionIndex + 1} / ${CONFIG.TOTAL_QUESTIONS}`;
        elRoundNumber.textContent = state.round;

        if (state.equation) {
            elEquationText.innerHTML = formatEquation(state.equation);
        }

        const getHint = (pt) => {
            if (!state.needsHint || !state.equation) return '';
            const { a, b } = state.equation;
            const val = a * pt.x + b * pt.y;
            return ` ⇒ ${val}`;
        };

        if (state.points[0]) {
            elPoint1Value.textContent = `(${state.points[0].x}, ${state.points[0].y})${getHint(state.points[0])}`;
            elPoint1Row.classList.add('active');
        } else {
            elPoint1Value.textContent = '未設定';
            elPoint1Row.classList.remove('active');
        }

        if (state.points[1]) {
            elPoint2Value.textContent = `(${state.points[1].x}, ${state.points[1].y})${getHint(state.points[1])}`;
            elPoint2Row.classList.add('active');
        } else {
            elPoint2Value.textContent = '未設定';
            elPoint2Row.classList.remove('active');
        }

        btnSubmit.disabled = !state.points[0] || !state.points[1] || state.answered;

        elScoreValue.textContent = state.score;
        elScoreBar.style.width = `${state.score}%`;
        elCorrectCount.textContent = state.correctCount;
        elWrongCount.textContent = state.wrongCount;
    }

    // ========================================
    // Inline Feedback (no popup)
    // ========================================
    function showInlineFeedback(correct) {
        state.lastCorrect = correct;
        state.showCorrectLine = !correct; // show red correct line only when wrong

        // Update inline feedback card
        elInlineFeedback.className = 'card feedback-inline-card ' + (correct ? 'correct-inline' : 'wrong-inline');
        elInlineFeedbackIcon.textContent = correct ? '🎉' : '❌';
        elInlineFeedbackTitle.textContent = correct ? '正確！' : '答錯了';

        if (correct) {
            elInlineFeedbackMessage.textContent = '太棒了！你畫對了這條直線！';
            elInlineFeedbackScoreText.textContent = `+${CONFIG.POINTS_PER_QUESTION} 分`;
            btnNextInlineText.textContent = '下一題';
        } else {
            const { a, b, c } = state.equation;
            const validPts = findValidPoints(a, b, c);
            let hint = '紅色直線為正確答案。';
            if (validPts.length >= 2) {
                let pt1 = validPts.reduce((min, p) => Math.abs(p.y) < Math.abs(min.y) ? p : min, validPts[0]);
                let remaining = validPts.filter(p => !(p.x === pt1.x && p.y === pt1.y));
                let pt2 = remaining.reduce((min, p) => Math.abs(p.x) < Math.abs(min.x) ? p : min, remaining[0]);

                state.examplePoints = [pt1, pt2];
                hint += ` 例如 (${pt1.x}, ${pt1.y}) 和 (${pt2.x}, ${pt2.y}) 皆在此直線上。`;
            } else {
                state.examplePoints = [];
            }
            elInlineFeedbackMessage.textContent = hint;
            elInlineFeedbackScoreText.textContent = '+0 分';
            btnNextInlineText.textContent = '確認，下一題';
        }

        // Flash canvas border
        wrapper.classList.remove('correct-flash', 'wrong-flash');
        void wrapper.offsetWidth;
        wrapper.classList.add(correct ? 'correct-flash' : 'wrong-flash');

        // Redraw canvas with correct answer line
        draw();

        // Show inline feedback card with animation
        elInlineFeedback.style.display = 'block';

        // Scroll feedback into view
        elInlineFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideInlineFeedback() {
        elInlineFeedback.style.display = 'none';
        elInlineFeedback.className = 'card feedback-inline-card';
    }

    function showRoundComplete() {
        elFinalScore.textContent = state.score;
        const accuracy = CONFIG.TOTAL_QUESTIONS > 0
            ? Math.round((state.correctCount / CONFIG.TOTAL_QUESTIONS) * 100)
            : 0;
        elAccuracy.textContent = accuracy + '%';

        let stars = '';
        const starCount = Math.floor(state.correctCount / 2);
        for (let i = 0; i < 5; i++) {
            stars += i < starCount ? '⭐' : '☆';
        }
        elRoundStars.textContent = stars;

        elRoundOverlay.classList.add('visible');
    }

    // ========================================
    // Game Logic
    // ========================================
    function startNewQuestion() {
        state.points = [null, null];
        state.answered = false;
        state.lastCorrect = false;
        state.showCorrectLine = false;
        state.examplePoints = [];
        wrapper.classList.remove('correct-flash', 'wrong-flash');

        hideInlineFeedback();
        generateEquation();
        updateUI();
        draw();
    }

    function startNewRound() {
        if (state.score <= 40) {
            state.needsHint = true;
        } else {
            state.needsHint = false;
        }

        state.round++;
        state.questionIndex = 0;
        state.score = 0;
        state.correctCount = 0;
        state.wrongCount = 0;

        elRoundOverlay.classList.remove('visible');
        startNewQuestion();

        elScoreValue.classList.add('bump');
        setTimeout(() => elScoreValue.classList.remove('bump'), 500);
    }

    function submitAnswer() {
        if (state.answered) return;
        state.answered = true;

        const correct = validateAnswer();

        if (correct) {
            state.score += CONFIG.POINTS_PER_QUESTION;
            state.correctCount++;

            elScoreValue.classList.add('bump');
            setTimeout(() => elScoreValue.classList.remove('bump'), 500);
        } else {
            state.wrongCount++;
        }

        updateUI();
        showInlineFeedback(correct);
    }

    function nextQuestion() {
        hideInlineFeedback();

        state.questionIndex++;

        if (state.questionIndex >= CONFIG.TOTAL_QUESTIONS) {
            setTimeout(() => showRoundComplete(), 300);
            return;
        }

        setTimeout(() => startNewQuestion(), 200);
    }

    function resetPoints() {
        if (state.answered) return;
        state.points = [null, null];
        updateUI();
        draw();
    }

    // ========================================
    // Input Handling
    // ========================================
    function getEventPos(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function findNearestPoint(px, py) {
        let nearest = -1;
        let minDist = CONFIG.HIT_RADIUS;

        state.points.forEach((pt, i) => {
            if (!pt) return;
            const pp = gridToPixel(pt.x, pt.y);
            const dist = Math.hypot(pp.x - px, pp.y - py);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        });

        return nearest;
    }

    function handlePointerDown(e) {
        if (state.answered) return;
        e.preventDefault();

        const pos = getEventPos(e);
        const nearIdx = findNearestPoint(pos.x, pos.y);

        if (nearIdx >= 0) {
            state.dragging = nearIdx;
            canvas.style.cursor = 'grabbing';
        } else {
            const grid = pixelToGrid(pos.x, pos.y);
            const gx = clamp(snapToGrid(grid.x), -CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);
            const gy = clamp(snapToGrid(grid.y), -CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);

            if (!state.points[0]) {
                state.points[0] = { x: gx, y: gy };
            } else if (!state.points[1]) {
                state.points[1] = { x: gx, y: gy };
            } else {
                const d0 = Math.hypot(state.points[0].x - gx, state.points[0].y - gy);
                const d1 = Math.hypot(state.points[1].x - gx, state.points[1].y - gy);
                const replaceIdx = d0 <= d1 ? 0 : 1;
                state.points[replaceIdx] = { x: gx, y: gy };
                state.dragging = replaceIdx;
                canvas.style.cursor = 'grabbing';
            }

            updateUI();
            draw();
        }
    }

    function handlePointerMove(e) {
        if (state.dragging < 0) {
            const pos = getEventPos(e);
            const nearIdx = findNearestPoint(pos.x, pos.y);
            canvas.style.cursor = nearIdx >= 0 ? 'grab' : 'crosshair';
            return;
        }

        e.preventDefault();
        const pos = getEventPos(e);
        const grid = pixelToGrid(pos.x, pos.y);
        const gx = clamp(snapToGrid(grid.x), -CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);
        const gy = clamp(snapToGrid(grid.y), -CONFIG.GRID_RANGE, CONFIG.GRID_RANGE);

        state.points[state.dragging] = { x: gx, y: gy };
        updateUI();
        draw();
    }

    function handlePointerUp() {
        if (state.dragging >= 0) {
            state.dragging = -1;
            canvas.style.cursor = 'crosshair';
        }
    }

    // ========================================
    // Event Listeners
    // ========================================
    function initEvents() {
        // Canvas interactions - mouse
        canvas.addEventListener('mousedown', handlePointerDown);
        canvas.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);

        // Canvas interactions - touch
        canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
        canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
        window.addEventListener('touchend', handlePointerUp);

        // Buttons
        btnSubmit.addEventListener('click', submitAnswer);
        btnReset.addEventListener('click', resetPoints);
        btnNextInline.addEventListener('click', nextQuestion);
        btnNewRound.addEventListener('click', startNewRound);

        // Resize
        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
        });
        resizeObserver.observe(wrapper);

        window.addEventListener('resize', resizeCanvas);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (state.answered) {
                    // If already answered, pressing Enter goes to next question
                    nextQuestion();
                } else if (!btnSubmit.disabled) {
                    submitAnswer();
                }
            } else if (e.key === 'r' || e.key === 'R') {
                if (!state.answered) resetPoints();
            }
        });
    }

    // ========================================
    // Initialize
    // ========================================
    function init() {
        initEvents();
        resizeCanvas();
        startNewQuestion();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
