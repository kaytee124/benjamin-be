import {
  fingerprintOf,
  gcd,
  pick,
  randInt,
  resolveDomain,
  simplifyFraction,
  uniqueOptions,
  type GeneratedQuestion,
  type QuestionTemplate,
} from "./types";
import {
  boxPlotSvg,
  coordPlaneLineSvg,
  rightTriangleSvg,
  scatterSvg,
  similarTrianglesSvg,
  spinnerSvg,
  transversalSvg,
} from "./figures";

function finish(
  template: QuestionTemplate,
  rng: () => number,
  params: Record<string, string | number>,
  partial: ReturnType<QuestionTemplate["generate"]>,
  calculatorAllowed: boolean,
  position: number
): GeneratedQuestion {
  const fingerprint = fingerprintOf(template.id, params);
  return {
    id: `gen-${template.id}-${fingerprint.slice(0, 10)}-${position}`,
    subjectId: "math",
    templateId: template.id,
    fingerprint,
    calculatorAllowed,
    type: partial.type,
    prompt: partial.prompt,
    options: partial.options,
    correctAnswer: partial.correctAnswer,
    explanation: partial.explanation,
    topic: partial.topic ?? template.topic,
    figureSvg: partial.figureSvg,
  };
}

const templates: QuestionTemplate[] = [
  {
    id: "frac-subtract",
    topic: "fractions",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const den1 = pick(rng, [4, 5, 6, 8, 10, 12]);
      const den2 = pick(rng, [3, 4, 5, 6, 8].filter((d) => d !== den1));
      const num1 = randInt(rng, Math.ceil(den1 / 2), den1 - 1);
      const num2 = randInt(rng, 1, Math.floor(den2 / 2) || 1);
      const common = (den1 * den2) / gcd(den1, den2);
      const resN = (num1 * common) / den1 - (num2 * common) / den2;
      const [sn, sd] = simplifyFraction(Math.max(resN, 1), common);
      const correct = `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "fractions",
        prompt: `What is ${num1}/${den1} − ${num2}/${den2}?`,
        options: uniqueOptions(rng, correct, [
          `${sn + 1}/${sd}`,
          `${sn}/${sd + 1}`,
          `${Math.max(1, sn - 1)}/${sd}`,
        ]),
        correctAnswer: correct,
        explanation: `Common denominator ${common}: result ${correct}.`,
      };
    },
  },
  {
    id: "integer-chain",
    topic: "integers",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, -12, -2);
      const b = randInt(rng, 5, 20);
      const c = randInt(rng, 1, 8);
      const correct = String(a + b - c);
      return {
        type: "short_answer",
        topic: "integers",
        prompt: `Evaluate: (${a}) + ${b} − ${c}.`,
        correctAnswer: correct,
        explanation: `${a} + ${b} = ${a + b}; ${a + b} − ${c} = ${correct}.`,
      };
    },
  },
  {
    id: "distribute-combine",
    topic: "algebra",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const k = randInt(rng, 2, 5);
      const m = randInt(rng, 2, 6);
      const n = randInt(rng, 1, 8);
      const p = randInt(rng, 2, 7);
      const coef = k * m + p;
      const constTerm = -k * n;
      const correct = `${coef}x ${constTerm < 0 ? "−" : "+"} ${Math.abs(constTerm)}`;
      const wrong1 = `${k * m}x ${constTerm < 0 ? "−" : "+"} ${Math.abs(constTerm)}`;
      const wrong2 = `${coef}x ${constTerm < 0 ? "−" : "+"} ${n}`;
      const wrong3 = `${k + m + p}x − ${k * n}`;
      return {
        type: "multiple_choice",
        topic: "algebra",
        prompt: `Which expression is equivalent to ${k}(${m}x − ${n}) + ${p}x?`,
        options: uniqueOptions(rng, correct, [wrong1, wrong2, wrong3]),
        correctAnswer: correct,
        explanation: `Distribute: ${k * m}x − ${k * n} + ${p}x = ${correct}.`,
      };
    },
  },
  {
    id: "fraction-of-recipe",
    topic: "fractions",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const needN = randInt(rng, 1, 3);
      const needD = pick(rng, [2, 3, 4, 5]);
      const halfN = 1;
      const halfD = pick(rng, [2, 3, 4]);
      const resN = needN * halfN;
      const resD = needD * halfD;
      const [sn, sd] = simplifyFraction(resN, resD);
      const correct = `${sn}/${sd} cup`;
      return {
        type: "multiple_choice",
        topic: "fractions",
        prompt: `A recipe needs ${needN}/${needD} cup of oil. You make ${halfN}/${halfD} of the recipe. How much oil do you need?`,
        options: uniqueOptions(rng, correct, [
          `${sn}/${sd + 1} cup`,
          `${sn + 1}/${sd} cup`,
          `${needN}/${needD * 2} cup`,
        ]),
        correctAnswer: correct,
        explanation: `(${halfN}/${halfD})×(${needN}/${needD}) = ${correct}.`,
      };
    },
  },
  {
    id: "diff-of-squares-arith",
    topic: "exponents",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 4, 12);
      const b = randInt(rng, 2, a - 1);
      const correct = String(a * a - b * b);
      return {
        type: "short_answer",
        topic: "exponents",
        prompt: `What is the value of ${a}² − ${b}²?`,
        correctAnswer: correct,
        explanation: `${a * a} − ${b * b} = ${correct}.`,
      };
    },
  },
  {
    id: "solve-linear",
    topic: "algebra",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 2, 9);
      const x = randInt(rng, 2, 15);
      const b = randInt(rng, 1, 20);
      const c = a * x + b;
      const correct = String(x);
      return {
        type: "multiple_choice",
        topic: "algebra",
        prompt: `Solve for x: ${a}x + ${b} = ${c}.`,
        options: uniqueOptions(rng, correct, [
          String(x + 2),
          String(c - b),
          String(a),
        ]),
        correctAnswer: correct,
        explanation: `${a}x = ${c - b}; x = ${x}.`,
      };
    },
  },
  {
    id: "rect-area",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const l = randInt(rng, 6, 24);
      const w = randInt(rng, 4, 18);
      const correct = String(l * w);
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A rectangular garden is ${l} feet long and ${w} feet wide. What is its area in square feet?`,
        correctAnswer: correct,
        explanation: `Area = ${l} × ${w} = ${correct}.`,
      };
    },
  },
  {
    id: "percent-of",
    topic: "percent",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const pct = pick(rng, [10, 15, 20, 25, 30, 40, 50]);
      const base = randInt(rng, 40, 400);
      const rounded = Math.round((base * pct) / 5) * 5; // nicer bases sometimes
      const useBase = pct === 15 || pct === 25 ? base : rounded || base;
      const correct = String((useBase * pct) / 100);
      return {
        type: "multiple_choice",
        topic: "percent",
        prompt: `What is ${pct}% of ${useBase}?`,
        options: uniqueOptions(rng, correct, [
          String(Number(correct) + 4),
          String(useBase * (pct / 10)),
          String(Math.round(useBase * 0.1)),
        ]),
        correctAnswer: correct,
        explanation: `${pct / 100} × ${useBase} = ${correct}.`,
      };
    },
  },
  {
    id: "mean-missing",
    topic: "data",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 2, 10);
      const b = randInt(rng, 2, 12);
      const c = randInt(rng, 4, 16);
      const mean = randInt(rng, 6, 14);
      const x = mean * 4 - (a + b + c);
      const correct = String(x);
      return {
        type: "multiple_choice",
        topic: "data",
        prompt: `The mean of ${a}, ${b}, ${c}, and x is ${mean}. What is x?`,
        options: uniqueOptions(rng, correct, [
          String(mean),
          String(x + 2),
          String(a + b + c),
        ]),
        correctAnswer: correct,
        explanation: `(${a}+${b}+${c}+x)/4 = ${mean} → x = ${x}.`,
      };
    },
  },
  {
    id: "circle-circ",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 3, 12);
      const circ = Math.round(2 * 3.14 * r * 10) / 10;
      const correct = String(circ);
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A circle has radius ${r} cm. What is its circumference? Use π = 3.14 and round to the nearest tenth.`,
        correctAnswer: correct,
        explanation: `C = 2πr = 2 × 3.14 × ${r} = ${correct}.`,
      };
    },
  },
  {
    id: "discount-price",
    topic: "percent",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const price = pick(rng, [20, 40, 48, 60, 80, 100, 120]);
      const pct = pick(rng, [10, 15, 20, 25, 30]);
      const sale = price - (price * pct) / 100;
      const correct = `$${sale}`;
      return {
        type: "multiple_choice",
        topic: "percent",
        prompt: `A shirt costs $${price} and is discounted ${pct}%. What is the sale price?`,
        options: uniqueOptions(rng, correct, [
          `$${price - pct}`,
          `$${(price * pct) / 100}`,
          `$${price}`,
        ]),
        correctAnswer: correct,
        explanation: `${pct}% of ${price} is ${(price * pct) / 100}; sale = ${correct}.`,
      };
    },
  },
  {
    id: "solve-two-step",
    topic: "algebra",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const x = randInt(rng, 4, 20);
      const inner = randInt(rng, 1, 8);
      const factor = pick(rng, [2, 3, 4, 5]);
      const right = factor * (x - inner);
      // factor(x - inner) = right
      const correct = String(x);
      return {
        type: "short_answer",
        topic: "algebra",
        prompt: `Solve: ${factor}(x − ${inner}) = ${right}. Enter the value of x.`,
        correctAnswer: correct,
        explanation: `x − ${inner} = ${right / factor}; x = ${x}.`,
      };
    },
  },
  {
    id: "pythagorean",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const triples = [
        [3, 4, 5],
        [5, 12, 13],
        [6, 8, 10],
        [7, 24, 25],
        [8, 15, 17],
        [9, 12, 15],
      ];
      const [a, b, c] = pick(rng, triples);
      const scale = randInt(rng, 1, 3);
      const A = a * scale;
      const B = b * scale;
      const C = c * scale;
      const correct = String(C);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A right triangle has legs ${A} and ${B} as shown. What is the length of the hypotenuse?`,
        options: uniqueOptions(rng, correct, [
          String(A + B),
          String(C + 2),
          String(Math.abs(B - A)),
        ]),
        correctAnswer: correct,
        explanation: `√(${A}²+${B}²) = ${C}.`,
        figureSvg: rightTriangleSvg({ a: A, b: B }),
      };
    },
  },
  {
    id: "ratio-parts",
    topic: "ratios",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const boys = randInt(rng, 2, 5);
      const girls = randInt(rng, 3, 7);
      const part = randInt(rng, 2, 6);
      const total = (boys + girls) * part;
      const girlCount = girls * part;
      const correct = String(girlCount);
      return {
        type: "multiple_choice",
        topic: "ratios",
        prompt: `The ratio of boys to girls in a class is ${boys}:${girls}. If there are ${total} students total, how many are girls?`,
        options: uniqueOptions(rng, correct, [
          String(boys * part),
          String(total / 2),
          String(girls),
        ]),
        correctAnswer: correct,
        explanation: `${boys}+${girls}=${boys + girls} parts; girls = ${girls}×${part} = ${girlCount}.`,
      };
    },
  },
  {
    id: "slope",
    topic: "algebra",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const x1 = randInt(rng, -3, 4);
      const y1 = randInt(rng, -5, 8);
      const run = pick(rng, [2, 3, 4, 5]);
      const rise = randInt(rng, -6, 8) || 2;
      const x2 = x1 + run;
      const y2 = y1 + rise;
      const [sn, sd] = simplifyFraction(rise, run);
      const correct = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return {
        type: "short_answer",
        topic: "algebra",
        prompt: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
        correctAnswer: correct,
        explanation: `m = (${y2}−${y1})/(${x2}−${x1}) = ${correct}.`,
      };
    },
  },
  {
    id: "prism-height",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const l = randInt(rng, 3, 10);
      const w = randInt(rng, 2, 8);
      const h = randInt(rng, 2, 12);
      const v = l * w * h;
      const correct = String(h);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `The volume of a rectangular prism is V = lwh. If l=${l}, w=${w}, and V=${v}, what is h?`,
        options: uniqueOptions(rng, correct, [
          String(l),
          String(w),
          String(v / l),
        ]),
        correctAnswer: correct,
        explanation: `${v} = ${l}×${w}×h → h = ${h}.`,
      };
    },
  },
  {
    id: "median",
    topic: "data",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const vals = [
        randInt(rng, 1, 5),
        randInt(rng, 6, 10),
        randInt(rng, 11, 15),
        randInt(rng, 16, 20),
        randInt(rng, 21, 30),
      ].sort((a, b) => a - b);
      const correct = String(vals[2]);
      return {
        type: "multiple_choice",
        topic: "data",
        prompt: `Which is the median of the data set: ${vals.join(", ")}?`,
        options: uniqueOptions(rng, correct, [
          String(vals[0]),
          String(vals[1]),
          String(vals[4]),
        ]),
        correctAnswer: correct,
        explanation: `The middle value is ${correct}.`,
      };
    },
  },
  {
    id: "speed",
    topic: "rates",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const hours = pick(rng, [2, 2.5, 3, 3.5, 4, 5]);
      const speed = pick(rng, [40, 45, 50, 55, 60, 65]);
      const miles = speed * hours;
      const correct = String(speed);
      return {
        type: "short_answer",
        topic: "rates",
        prompt: `A car travels ${miles} miles in ${hours} hours at constant speed. What is the speed in miles per hour?`,
        correctAnswer: correct,
        explanation: `${miles} ÷ ${hours} = ${speed}.`,
      };
    },
  },
  {
    id: "square-perimeter-area",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const side = randInt(rng, 5, 20);
      const peri = side * 4;
      const area = side * side;
      const correct = `${area} cm²`;
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A square has perimeter ${peri} cm. What is the area?`,
        options: uniqueOptions(rng, correct, [
          `${peri} cm²`,
          `${side} cm²`,
          `${peri * side} cm²`,
        ]),
        correctAnswer: correct,
        explanation: `Side = ${peri}/4 = ${side}; area = ${area}.`,
      };
    },
  },
  {
    id: "function-eval",
    topic: "functions",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = randInt(rng, 2, 8);
      const b = randInt(rng, -5, 9);
      const x = randInt(rng, 2, 10);
      const y = m * x + b;
      const correct = String(y);
      const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
      return {
        type: "multiple_choice",
        topic: "functions",
        prompt: `The function f(x) = ${m}x ${bStr}. What is f(${x})?`,
        options: uniqueOptions(rng, correct, [
          String(m + x + b),
          String(m * x),
          String(y + 2),
        ]),
        correctAnswer: correct,
        explanation: `f(${x}) = ${m}(${x}) ${bStr} = ${y}.`,
      };
    },
  },
  {
    id: "simple-interest",
    topic: "finance",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const p = pick(rng, [200, 400, 500, 800, 1000]);
      const r = pick(rng, [2, 3, 4, 5, 6]);
      const t = randInt(rng, 2, 5);
      const i = (p * r * t) / 100;
      const correct = String(i);
      return {
        type: "short_answer",
        topic: "finance",
        prompt: `What is the simple interest on $${p} at ${r}% per year for ${t} years? I = Prt. Enter the interest in dollars (no $ sign).`,
        correctAnswer: correct,
        explanation: `I = ${p} × ${r / 100} × ${t} = ${i}.`,
      };
    },
  },
  {
    id: "system-add",
    topic: "algebra",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const x = randInt(rng, 3, 12);
      const y = randInt(rng, 1, 10);
      const s = x + y;
      const d = x - y;
      const correct = `(${x}, ${y})`;
      return {
        type: "multiple_choice",
        topic: "algebra",
        prompt: `Which is a solution to the system: x + y = ${s} and x − y = ${d}?`,
        options: uniqueOptions(rng, correct, [
          `(${y}, ${x})`,
          `(${s}, ${d})`,
          `(${x + 1}, ${y - 1})`,
        ]),
        correctAnswer: correct,
        explanation: `Adding: 2x = ${s + d} → x = ${x}; y = ${y}.`,
      };
    },
  },
  {
    id: "map-scale",
    topic: "ratios",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const scale = pick(rng, [10, 15, 20, 25, 50]);
      const inches = pick(rng, [2, 2.5, 3, 3.5, 4, 5]);
      const miles = inches * scale;
      const correct = String(miles);
      return {
        type: "multiple_choice",
        topic: "ratios",
        prompt: `A map scale is 1 inch : ${scale} miles. Two towns are ${inches} inches apart on the map. How many miles apart are they?`,
        options: uniqueOptions(rng, correct, [
          String(inches + scale),
          String(scale),
          String(inches * 10),
        ]),
        correctAnswer: correct,
        explanation: `${inches} × ${scale} = ${miles}.`,
      };
    },
  },
  {
    id: "triangle-area",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const base = randInt(rng, 6, 24);
      const height = randInt(rng, 4, 18);
      const area = (base * height) / 2;
      const correct = String(area);
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A triangle has base ${base} and height ${height}. What is its area?`,
        correctAnswer: correct,
        explanation: `A = (1/2)×${base}×${height} = ${area}.`,
      };
    },
  },
  {
    id: "sqrt-between",
    topic: "roots",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const n = randInt(rng, 6, 14);
      const low = n * n + 1;
      const high = (n + 2) * (n + 2) - 1;
      const correct = String(n + 1);
      return {
        type: "multiple_choice",
        topic: "roots",
        prompt: `Which integer is between √${low} and √${high}?`,
        options: uniqueOptions(rng, correct, [
          String(n),
          String(n + 2),
          String(n + 3),
        ]),
        correctAnswer: correct,
        explanation: `√${n * n}=${n} and √${(n + 1) * (n + 1)}=${n + 1}; ${n + 1} lies between √${low} and √${high}.`,
      };
    },
  },
  {
    id: "worker-days",
    topic: "rates",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const w1 = randInt(rng, 3, 8);
      const d1 = randInt(rng, 6, 16);
      const w2 = w1 + randInt(rng, 1, 4);
      const total = w1 * d1;
      const d2 = total / w2;
      // ensure integer days
      if (!Number.isInteger(d2)) {
        const fixed = total; // regenerate-like adjustment
        const days = Math.round(fixed / w2);
        const correct = String(days);
        return {
          type: "multiple_choice",
          topic: "rates",
          prompt: `If ${w1} workers finish a job in ${d1} days, about how many days would ${w2} workers take at the same rate? (Use whole worker-days; round to nearest day.)`,
          options: uniqueOptions(rng, correct, [
            String(d1),
            String(days + 2),
            String(w1),
          ]),
          correctAnswer: correct,
          explanation: `Worker-days ≈ ${w1 * d1}; ${w1 * d1}/${w2} ≈ ${days}.`,
        };
      }
      const correct = String(d2);
      return {
        type: "multiple_choice",
        topic: "rates",
        prompt: `If ${w1} workers finish a job in ${d1} days, how many days would ${w2} workers take at the same rate? (Assume inverse proportion.)`,
        options: uniqueOptions(rng, correct, [
          String(d1),
          String(d2 + 2),
          String(w1),
        ]),
        correctAnswer: correct,
        explanation: `Total worker-days = ${total}; ${total}/${w2} = ${d2}.`,
      };
    },
  },
  {
    id: "linear-cost",
    topic: "functions",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const per = randInt(rng, 10, 40);
      const fee = randInt(rng, 15, 60);
      const n = randInt(rng, 4, 12);
      const cost = per * n + fee;
      const correct = `$${cost}`;
      return {
        type: "multiple_choice",
        topic: "functions",
        prompt: `A linear model predicts cost C = ${per}n + ${fee} for n items. What is the cost for ${n} items?`,
        options: uniqueOptions(rng, correct, [
          `$${per * n}`,
          `$${cost + fee}`,
          `$${per + fee}`,
        ]),
        correctAnswer: correct,
        explanation: `C = ${per}(${n}) + ${fee} = ${cost}.`,
      };
    },
  },
  {
    id: "carpet-cost",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const l = randInt(rng, 10, 24);
      const w = randInt(rng, 8, 16);
      const rate = pick(rng, [2.5, 3, 3.5, 4, 4.5]);
      const total = l * w * rate;
      const correct = String(total);
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A rectangular floor is ${l} ft by ${w} ft. Carpet costs $${rate} per square foot. What is the total cost in dollars? (Enter a number; decimals OK.)`,
        correctAnswer: correct,
        explanation: `Area = ${l * w}; cost = ${l * w} × ${rate} = ${total}.`,
      };
    },
  },
  {
    id: "prob-die",
    topic: "probability",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const faces = [1, 2, 3, 4, 5, 6];
      const a = pick(rng, faces);
      let b = pick(rng, faces);
      while (b === a) b = pick(rng, faces);
      const correct = "1/3";
      return {
        type: "multiple_choice",
        topic: "probability",
        prompt: `Which expression equals the probability of rolling a ${a} or a ${b} on a fair six-sided die?`,
        options: uniqueOptions(rng, correct, ["1/6", "1/2", "2/3"]),
        correctAnswer: correct,
        explanation: `2 favorable outcomes out of 6 → 2/6 = 1/3.`,
      };
    },
  },
  {
    id: "sqrt-perfect",
    topic: "roots",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const n = randInt(rng, 5, 20);
      const correct = String(n);
      return {
        type: "short_answer",
        topic: "roots",
        prompt: `Evaluate √${n * n}.`,
        correctAnswer: correct,
        explanation: `${n} × ${n} = ${n * n}.`,
      };
    },
  },
  {
    id: "sci-notation",
    topic: "scientific-notation",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const coef = pick(rng, [1.5, 2.5, 3.2, 4.5, 6.0]);
      const exp = randInt(rng, 2, 4);
      const value = coef * 10 ** exp;
      const correct = String(value);
      return {
        type: "short_answer",
        topic: "scientific-notation",
        prompt: `Write ${coef} × 10${toSuperscript(exp)} as a whole number.`,
        correctAnswer: correct,
        explanation: `${coef} × ${10 ** exp} = ${value}.`,
      };
    },
  },

  // —— Additional GED coverage: angles, surface area, graphs, inequalities, etc. ——
  {
    id: "triangle-angle-sum",
    topic: "angles",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 30, 80);
      const b = randInt(rng, 30, 80);
      const c = 180 - a - b;
      if (c <= 0 || c >= 180) {
        return {
          type: "short_answer",
          topic: "angles",
          prompt: "In a triangle, two angles measure 40° and 65°. What is the third angle in degrees?",
          correctAnswer: "75",
          explanation: "180 − 40 − 65 = 75.",
        };
      }
      const correct = String(c);
      return {
        type: "short_answer",
        topic: "angles",
        prompt: `In a triangle, two angles measure ${a}° and ${b}°. What is the third angle in degrees?`,
        correctAnswer: correct,
        explanation: `Angles in a triangle sum to 180°: 180 − ${a} − ${b} = ${c}.`,
      };
    },
  },
  {
    id: "supplementary-angles",
    topic: "angles",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 20, 160);
      const correct = String(180 - a);
      return {
        type: "multiple_choice",
        topic: "angles",
        prompt: `Two angles are supplementary. One measures ${a}°. What is the other angle?`,
        options: uniqueOptions(rng, correct, [
          String(90 - (a % 90)),
          String(360 - a),
          String(a),
        ]),
        correctAnswer: correct,
        explanation: `Supplementary angles sum to 180°: 180 − ${a} = ${180 - a}.`,
      };
    },
  },
  {
    id: "complementary-angles",
    topic: "angles",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 15, 75);
      const correct = String(90 - a);
      return {
        type: "multiple_choice",
        topic: "angles",
        prompt: `Two angles are complementary. One measures ${a}°. What is the other angle?`,
        options: uniqueOptions(rng, correct, [
          String(180 - a),
          String(a),
          String(90 + a),
        ]),
        correctAnswer: correct,
        explanation: `Complementary angles sum to 90°: 90 − ${a} = ${90 - a}.`,
      };
    },
  },
  {
    id: "rect-perimeter",
    topic: "geometry",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const l = randInt(rng, 5, 20);
      const w = randInt(rng, 3, 15);
      const correct = String(2 * (l + w));
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A rectangle is ${l} units long and ${w} units wide. What is its perimeter?`,
        correctAnswer: correct,
        explanation: `P = 2(${l}+${w}) = ${correct}.`,
      };
    },
  },
  {
    id: "circle-area",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 2, 12);
      const area = Math.round(3.14 * r * r * 10) / 10;
      const correct = String(area);
      return {
        type: "short_answer",
        topic: "geometry",
        prompt: `A circle has radius ${r}. Using π = 3.14, what is its area? Round to the nearest tenth if needed.`,
        correctAnswer: correct,
        explanation: `A = πr² = 3.14 × ${r}² = ${correct}.`,
      };
    },
  },
  {
    id: "cube-surface-area",
    topic: "surface-area",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const edge = randInt(rng, 2, 12);
      const correct = String(6 * edge * edge);
      return {
        type: "multiple_choice",
        topic: "surface-area",
        prompt: `What is the surface area of a cube with edge length ${edge}?`,
        options: uniqueOptions(rng, correct, [
          String(edge * edge),
          String(edge * edge * edge),
          String(4 * edge * edge),
        ]),
        correctAnswer: correct,
        explanation: `SA = 6e² = 6×${edge}² = ${correct}.`,
      };
    },
  },
  {
    id: "prism-surface-area",
    topic: "surface-area",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const l = randInt(rng, 3, 10);
      const w = randInt(rng, 2, 8);
      const h = randInt(rng, 2, 9);
      const sa = 2 * (l * w + l * h + w * h);
      const correct = String(sa);
      return {
        type: "short_answer",
        topic: "surface-area",
        prompt: `A rectangular prism has length ${l}, width ${w}, and height ${h}. What is its surface area?`,
        correctAnswer: correct,
        explanation: `SA = 2(lw+lh+wh) = 2(${l * w}+${l * h}+${w * h}) = ${sa}.`,
      };
    },
  },
  {
    id: "cylinder-volume",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 2, 8);
      const h = randInt(rng, 4, 15);
      const v = Math.round(3.14 * r * r * h);
      const correct = String(v);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A cylinder has radius ${r} and height ${h}. Approximate the volume using π = 3.14. Round to the nearest whole number.`,
        options: uniqueOptions(rng, correct, [
          String(Math.round(2 * 3.14 * r * h)),
          String(r * r * h),
          String(v + 10),
        ]),
        correctAnswer: correct,
        explanation: `V = πr²h ≈ 3.14×${r}²×${h} ≈ ${v}.`,
      };
    },
  },
  {
    id: "cylinder-surface-area",
    topic: "surface-area",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 2, 7);
      const h = randInt(rng, 3, 12);
      // SA = 2πr² + 2πrh
      const sa = Math.round(2 * 3.14 * r * r + 2 * 3.14 * r * h);
      const correct = String(sa);
      return {
        type: "short_answer",
        topic: "surface-area",
        prompt: `A cylinder has radius ${r} and height ${h}. Approximate the total surface area using π = 3.14. Round to the nearest whole number.`,
        correctAnswer: correct,
        explanation: `SA ≈ 2πr² + 2πrh ≈ ${sa}.`,
      };
    },
  },
  {
    id: "inequality-solve",
    topic: "inequalities",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 2, 8);
      const xBound = randInt(rng, 3, 12);
      const b = randInt(rng, 1, 10);
      const right = a * xBound + b;
      // a x + b > right - a  => roughly x > xBound - 1; keep exact: ax + b ≥ right where right = a*xBound+b so x ≥ xBound
      const correct = `x ≥ ${xBound}`;
      return {
        type: "multiple_choice",
        topic: "inequalities",
        prompt: `Which inequality is equivalent to ${a}x + ${b} ≥ ${right}?`,
        options: uniqueOptions(rng, correct, [
          `x ≤ ${xBound}`,
          `x ≥ ${right}`,
          `x > ${b}`,
        ]),
        correctAnswer: correct,
        explanation: `${a}x ≥ ${right - b}; x ≥ ${xBound}.`,
      };
    },
  },
  {
    id: "quadratic-roots-simple",
    topic: "quadratics",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 2, 12);
      const correct = String(r);
      return {
        type: "short_answer",
        topic: "quadratics",
        prompt: `Solve for the positive value of x: x² = ${r * r}.`,
        correctAnswer: correct,
        explanation: `x = ±${r}; the positive solution is ${r}.`,
      };
    },
  },
  {
    id: "mode-range",
    topic: "data",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const mode = randInt(rng, 3, 15);
      const other1 = mode + randInt(rng, 1, 5);
      const other2 = mode - randInt(rng, 1, 3);
      const vals = [mode, mode, mode, other1, other2].sort((a, b) => a - b);
      const range = Math.max(...vals) - Math.min(...vals);
      const askMode = rng() < 0.5;
      if (askMode) {
        const correct = String(mode);
        return {
          type: "multiple_choice",
          topic: "data",
          prompt: `What is the mode of the data set: ${vals.join(", ")}?`,
          options: uniqueOptions(rng, correct, [
            String(other1),
            String(other2),
            String(range),
          ]),
          correctAnswer: correct,
          explanation: `${mode} appears most often.`,
        };
      }
      const correct = String(range);
      return {
        type: "short_answer",
        topic: "data",
        prompt: `What is the range of the data set: ${vals.join(", ")}?`,
        correctAnswer: correct,
        explanation: `Range = max − min = ${Math.max(...vals)} − ${Math.min(...vals)} = ${range}.`,
      };
    },
  },
  {
    id: "table-to-slope",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = pick(rng, [2, 3, -2, 4, -3, 5]);
      const b = randInt(rng, -4, 8);
      const x1 = 1;
      const x2 = 3;
      const y1 = m * x1 + b;
      const y2 = m * x2 + b;
      const correct = String(m);
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: `A linear relationship is shown in this table: x=${x1} → y=${y1}; x=${x2} → y=${y2}. What is the slope?`,
        options: uniqueOptions(rng, correct, [
          String(b),
          String(y2 - y1),
          String(m + 1),
        ]),
        correctAnswer: correct,
        explanation: `m = (${y2}−${y1})/(${x2}−${x1}) = ${m}.`,
      };
    },
  },
  {
    id: "table-to-equation",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = pick(rng, [2, 3, -1, 4]);
      const b = randInt(rng, -3, 6);
      const xs = [0, 1, 2];
      const rows = xs.map((x) => `x=${x}, y=${m * x + b}`).join("; ");
      const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
      const correct = `y = ${m}x ${bStr}`;
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: `Which equation matches this table? ${rows}`,
        options: uniqueOptions(rng, correct, [
          `y = ${m}x ${b < 0 ? "+ " + Math.abs(b) : "− " + b}`,
          `y = ${-m}x ${bStr}`,
          `y = ${b}x + ${m}`,
        ]),
        correctAnswer: correct,
        explanation: `When x=0, y=${b}; slope between points is ${m}.`,
      };
    },
  },
  {
    id: "point-on-line",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = randInt(rng, 1, 5);
      const b = randInt(rng, -4, 6);
      const x = randInt(rng, 1, 6);
      const y = m * x + b;
      const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
      const correct = `(${x}, ${y})`;
      const wrongY = y + pick(rng, [-2, -1, 1, 2]);
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: `Which point lies on the line y = ${m}x ${bStr}?`,
        options: uniqueOptions(rng, correct, [
          `(${x}, ${wrongY})`,
          `(${y}, ${x})`,
          `(0, ${m})`,
        ]),
        correctAnswer: correct,
        explanation: `When x=${x}, y=${m}(${x})${bStr.replace("− ", " − ").replace("+ ", " + ")} = ${y}.`,
      };
    },
  },
  {
    id: "parallel-slopes",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = pick(rng, [2, 3, -4, 5, -2]);
      const correct = String(m);
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: `A line has slope ${m}. Which slope would a parallel line have?`,
        options: uniqueOptions(rng, correct, [
          String(-m),
          "0",
          String(m + 1),
        ]),
        correctAnswer: correct,
        explanation: "Parallel lines have equal slopes.",
      };
    },
  },
  {
    id: "order-of-operations",
    topic: "integers",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 2, 8);
      const b = randInt(rng, 2, 6);
      const c = randInt(rng, 1, 5);
      const d = randInt(rng, 2, 4);
      const correct = String(a + b * c - d);
      return {
        type: "short_answer",
        topic: "integers",
        prompt: `Evaluate: ${a} + ${b} × ${c} − ${d}.`,
        correctAnswer: correct,
        explanation: `Multiply first: ${b}×${c}=${b * c}; then ${a}+${b * c}−${d}=${correct}.`,
      };
    },
  },
  {
    id: "unit-rate",
    topic: "ratios",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const pack = randInt(rng, 2, 8);
      const price = pick(rng, [3.5, 4, 4.5, 5, 6, 7.5, 8]) * pack;
      const rate = price / pack;
      const correct = String(rate);
      return {
        type: "short_answer",
        topic: "ratios",
        prompt: `A pack of ${pack} notebooks costs $${price}. What is the unit price per notebook in dollars?`,
        correctAnswer: correct,
        explanation: `${price} ÷ ${pack} = ${rate}.`,
      };
    },
  },
  {
    id: "absolute-distance",
    topic: "integers",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, -20, -1);
      const b = randInt(rng, 1, 20);
      const correct = String(Math.abs(b - a));
      return {
        type: "short_answer",
        topic: "integers",
        prompt: `On a number line, what is the distance between ${a} and ${b}?`,
        correctAnswer: correct,
        explanation: `|${b} − (${a})| = ${correct}.`,
      };
    },
  },
  {
    id: "percent-increase",
    topic: "percent",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const original = pick(rng, [40, 50, 80, 100, 120, 200]);
      const pct = pick(rng, [10, 15, 20, 25]);
      const result = original * (1 + pct / 100);
      const correct = String(result);
      return {
        type: "multiple_choice",
        topic: "percent",
        prompt: `A value of ${original} increases by ${pct}%. What is the new value?`,
        options: uniqueOptions(rng, correct, [
          String(original + pct),
          String(original * (pct / 100)),
          String(original),
        ]),
        correctAnswer: correct,
        explanation: `${original} × (1 + ${pct / 100}) = ${result}.`,
      };
    },
  },
  {
    id: "sphere-volume",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = pick(rng, [3, 6, 9]);
      // V = 4/3 π r^3 with π=3.14
      const v = Math.round((4 / 3) * 3.14 * r * r * r);
      const correct = String(v);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A sphere has radius ${r}. Approximate the volume using V = (4/3)πr³ and π = 3.14. Round to the nearest whole number.`,
        options: uniqueOptions(rng, correct, [
          String(Math.round(4 * 3.14 * r * r)),
          String(Math.round(3.14 * r * r * r)),
          String(v + 20),
        ]),
        correctAnswer: correct,
        explanation: `V ≈ (4/3)×3.14×${r}³ ≈ ${v}.`,
      };
    },
  },

  // —— Gap fill: visual graphs, richer fractions/decimals, probability, finance, data, angles, geometry ——
  {
    id: "line-from-graph",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = pick(rng, [1, 2, 3, -1, -2]);
      const b = randInt(rng, 0, 4);
      const correct = String(m);
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: "What is the slope of the line shown on the graph?",
        options: uniqueOptions(rng, correct, [
          String(b),
          String(-m),
          String(m + 1),
        ]),
        correctAnswer: correct,
        explanation: `The line rises/runs with slope ${m} (y-intercept ${b}).`,
        figureSvg: coordPlaneLineSvg({ m, b }),
      };
    },
  },
  {
    id: "intercept-from-graph",
    topic: "graphs",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const m = pick(rng, [1, 2, -1, 3]);
      const b = randInt(rng, 1, 5);
      const correct = String(b);
      return {
        type: "multiple_choice",
        topic: "graphs",
        prompt: "What is the y-intercept of the line shown?",
        options: uniqueOptions(rng, correct, [
          String(m),
          String(b + 1),
          String(0),
        ]),
        correctAnswer: correct,
        explanation: `The line crosses the y-axis at (0, ${b}).`,
        figureSvg: coordPlaneLineSvg({ m, b }),
      };
    },
  },
  {
    id: "frac-add",
    topic: "fractions",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const d = pick(rng, [6, 8, 10, 12]);
      const n1 = randInt(rng, 1, Math.floor(d / 2));
      const n2 = randInt(rng, 1, Math.floor(d / 2));
      const [sn, sd] = simplifyFraction(n1 + n2, d);
      const correct = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "fractions",
        prompt: `What is ${n1}/${d} + ${n2}/${d}?`,
        options: uniqueOptions(rng, correct, [
          `${n1 + n2}/${d * 2}`,
          `${Math.abs(n1 - n2)}/${d}`,
          `${n1 + n2}/${d + d}`,
        ]),
        correctAnswer: correct,
        explanation: `Same denominator: (${n1}+${n2})/${d} = ${correct}.`,
      };
    },
  },
  {
    id: "frac-multiply",
    topic: "fractions",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = randInt(rng, 1, 4);
      const b = pick(rng, [3, 4, 5, 6]);
      const c = randInt(rng, 1, 4);
      const d = pick(rng, [3, 4, 5, 6].filter((x) => x !== b));
      const [sn, sd] = simplifyFraction(a * c, b * d);
      const correct = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "fractions",
        prompt: `What is ${a}/${b} × ${c}/${d}?`,
        options: uniqueOptions(rng, correct, [
          `${a + c}/${b + d}`,
          `${a * c}/${b}`,
          `${a}/${b * d}`,
        ]),
        correctAnswer: correct,
        explanation: `Multiply numerators and denominators: ${a * c}/${b * d} = ${correct}.`,
      };
    },
  },
  {
    id: "mixed-number-simplify",
    topic: "fractions",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const whole = randInt(rng, 1, 4);
      const den = pick(rng, [3, 4, 5, 6, 8]);
      const num = randInt(rng, 1, den - 1);
      const improper = whole * den + num;
      const [sn, sd] = simplifyFraction(improper, den);
      const correct = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "fractions",
        prompt: `Write ${whole} ${num}/${den} as an improper fraction in simplest form.`,
        options: uniqueOptions(rng, correct, [
          `${improper}/${den * 2}`,
          `${whole * num}/${den}`,
          `${improper + 1}/${den}`,
        ]),
        correctAnswer: correct,
        explanation: `${whole}×${den}+${num} = ${improper}, so ${improper}/${den} = ${correct}.`,
      };
    },
  },
  {
    id: "decimal-place-value",
    topic: "decimals",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const tenths = randInt(rng, 1, 9);
      const hundredths = randInt(rng, 0, 9);
      const thousandths = randInt(rng, 1, 9);
      const value = (tenths / 10 + hundredths / 100 + thousandths / 1000).toFixed(3);
      const place = pick(rng, [
        { name: "tenths", digit: tenths },
        { name: "hundredths", digit: hundredths },
        { name: "thousandths", digit: thousandths },
      ] as const);
      const correct = String(place.digit);
      return {
        type: "multiple_choice",
        topic: "decimals",
        prompt: `In the number ${value}, what digit is in the ${place.name} place?`,
        options: uniqueOptions(rng, correct, [
          String(tenths === place.digit ? hundredths : tenths),
          String(thousandths === place.digit ? hundredths : thousandths),
          String((place.digit + 1) % 10),
        ]),
        correctAnswer: correct,
        explanation: `In ${value}, the ${place.name} digit is ${place.digit}.`,
      };
    },
  },
  {
    id: "decimal-compare-ops",
    topic: "decimals",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const a = (randInt(rng, 15, 85) / 10).toFixed(1);
      const b = (randInt(rng, 15, 85) / 10).toFixed(1);
      const op = Number(a) >= Number(b) ? "−" : "+";
      const result =
        op === "−"
          ? (Number(a) - Number(b)).toFixed(1)
          : (Number(a) + Number(b)).toFixed(1);
      const correct = result;
      return {
        type: "multiple_choice",
        topic: "decimals",
        prompt: `Compute ${a} ${op} ${b}.`,
        options: uniqueOptions(rng, correct, [
          (Number(result) + 0.1).toFixed(1),
          (Number(result) - 0.1).toFixed(1),
          (Number(a) + Number(b)).toFixed(1) === correct
            ? (Number(a) - Number(b)).toFixed(1)
            : (Number(a) + Number(b)).toFixed(1),
        ]),
        correctAnswer: correct,
        explanation: `${a} ${op} ${b} = ${correct}.`,
      };
    },
  },
  {
    id: "two-event-and",
    topic: "probability",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const red = randInt(rng, 2, 5);
      const blue = randInt(rng, 2, 5);
      const total = red + blue;
      // with replacement: P(red then blue)
      const [sn, sd] = simplifyFraction(red * blue, total * total);
      const correct = `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "probability",
        prompt: `A bag has ${red} red and ${blue} blue marbles. A marble is drawn, replaced, then another is drawn. What is P(red then blue)?`,
        options: uniqueOptions(rng, correct, [
          `${red}/${total}`,
          `${blue}/${total}`,
          `${red + blue}/${total * total}`,
        ]),
        correctAnswer: correct,
        explanation: `(${red}/${total})×(${blue}/${total}) = ${correct}.`,
      };
    },
  },
  {
    id: "spinner-prob",
    topic: "probability",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const colors = [
        { label: "R", color: "#f5a3a3" },
        { label: "B", color: "#a3c4f5" },
        { label: "G", color: "#a8e0b7" },
        { label: "Y", color: "#f5e6a3" },
      ];
      const n = pick(rng, [3, 4]);
      const slices = colors.slice(0, n);
      const target = slices[0].label;
      const [sn, sd] = simplifyFraction(1, n);
      const correct = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return {
        type: "multiple_choice",
        topic: "probability",
        prompt: `The spinner is divided into ${n} equal sections. What is P(landing on ${target})?`,
        options: uniqueOptions(rng, correct, [
          `${n - 1}/${n}`,
          "1",
          `1/${n + 1}`,
        ]),
        correctAnswer: correct,
        explanation: `Equal sections → 1/${n} = ${correct}.`,
        figureSvg: spinnerSvg({ slices }),
      };
    },
  },
  {
    id: "compound-interest",
    topic: "finance",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const p = pick(rng, [500, 800, 1000, 1200]);
      const rPct = pick(rng, [5, 6, 8, 10]);
      const t = pick(rng, [2, 3]);
      const amount = Math.round(p * Math.pow(1 + rPct / 100, t));
      const correct = String(amount);
      return {
        type: "multiple_choice",
        topic: "finance",
        prompt: `$${p} is invested at ${rPct}% annual compound interest for ${t} years. About how much is it worth at the end? (Round to the nearest dollar.)`,
        options: uniqueOptions(rng, correct, [
          String(Math.round(p * (1 + (rPct / 100) * t))),
          String(amount + 50),
          String(p + rPct * t),
        ]),
        correctAnswer: correct,
        explanation: `A = ${p}(1+${rPct}/100)^${t} ≈ ${amount}.`,
      };
    },
  },
  {
    id: "two-way-table",
    topic: "data",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const boysYes = randInt(rng, 4, 12);
      const boysNo = randInt(rng, 3, 10);
      const girlsYes = randInt(rng, 4, 12);
      const girlsNo = randInt(rng, 3, 10);
      const totalYes = boysYes + girlsYes;
      const total = boysYes + boysNo + girlsYes + girlsNo;
      const ask = pick(rng, ["yes", "boys"] as const);
      const correct =
        ask === "yes" ? String(totalYes) : String(boysYes + boysNo);
      return {
        type: "multiple_choice",
        topic: "data",
        prompt:
          ask === "yes"
            ? `A survey of students:\nBoys — Yes: ${boysYes}, No: ${boysNo}\nGirls — Yes: ${girlsYes}, No: ${girlsNo}\nHow many students said Yes?`
            : `A survey of students:\nBoys — Yes: ${boysYes}, No: ${boysNo}\nGirls — Yes: ${girlsYes}, No: ${girlsNo}\nHow many boys were surveyed?`,
        options: uniqueOptions(rng, correct, [
          String(total),
          String(girlsYes + girlsNo),
          String(boysYes + girlsYes === Number(correct) ? boysNo + girlsNo : boysYes + girlsYes),
        ]),
        correctAnswer: correct,
        explanation:
          ask === "yes"
            ? `${boysYes}+${girlsYes} = ${totalYes}.`
            : `${boysYes}+${boysNo} = ${boysYes + boysNo}.`,
      };
    },
  },
  {
    id: "box-plot-read",
    topic: "data",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const min = randInt(rng, 2, 8);
      const q1 = min + randInt(rng, 2, 4);
      const median = q1 + randInt(rng, 2, 5);
      const q3 = median + randInt(rng, 2, 5);
      const max = q3 + randInt(rng, 2, 6);
      const ask = pick(rng, ["median", "iqr"] as const);
      const correct =
        ask === "median" ? String(median) : String(q3 - q1);
      return {
        type: "multiple_choice",
        topic: "data",
        prompt:
          ask === "median"
            ? "According to the box plot, what is the median?"
            : "According to the box plot, what is the interquartile range (IQR)?",
        options: uniqueOptions(rng, correct, [
          String(ask === "median" ? q1 : median),
          String(ask === "median" ? q3 : max - min),
          String(ask === "median" ? max : q1),
        ]),
        correctAnswer: correct,
        explanation:
          ask === "median"
            ? `The middle line of the box is at ${median}.`
            : `IQR = Q3 − Q1 = ${q3} − ${q1} = ${q3 - q1}.`,
        figureSvg: boxPlotSvg({ min, q1, median, q3, max }),
      };
    },
  },
  {
    id: "scatter-trend",
    topic: "data",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const up = rng() < 0.5;
      const points = [1, 2, 3, 4, 5].map((x) => ({
        x,
        y: up
          ? x + randInt(rng, 0, 1)
          : 8 - x + randInt(rng, 0, 1),
      }));
      const correct = up ? "positive" : "negative";
      return {
        type: "multiple_choice",
        topic: "data",
        prompt: "Which best describes the association in the scatter plot?",
        options: uniqueOptions(rng, correct, [
          up ? "negative" : "positive",
          "none",
          "circular",
        ]),
        correctAnswer: correct,
        explanation: `The points trend ${correct}ly as x increases.`,
        figureSvg: scatterSvg({ points }),
      };
    },
  },
  {
    id: "transversal-parallel",
    topic: "angles",
    allowNoCalc: true,
    allowCalc: true,
    generate: (rng) => {
      const marked = pick(rng, [55, 60, 65, 70, 75, 110, 115, 120]);
      // corresponding / alternate interior equal when parallels
      const correct = String(marked);
      return {
        type: "multiple_choice",
        topic: "angles",
        prompt:
          "Lines ℓ₁ and ℓ₂ are parallel, cut by a transversal. The marked angle is shown. What is the measure of the angle marked “?” (corresponding angle)?",
        options: uniqueOptions(rng, correct, [
          String(180 - marked),
          String(90),
          String(marked + 10),
        ]),
        correctAnswer: correct,
        explanation: `Corresponding angles formed by a transversal of parallel lines are congruent (${marked}°).`,
        figureSvg: transversalSvg({ markedAngle: marked }),
      };
    },
  },
  {
    id: "similar-triangles",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const a = pick(rng, [3, 4, 5, 6]);
      const b = pick(rng, [4, 5, 6, 8].filter((x) => x !== a));
      const scale = pick(rng, [2, 3]);
      const a2 = a * scale;
      const correct = String(b * scale);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `The triangles are similar. Corresponding sides ${a} and ${a2} match. If another side on the smaller triangle is ${b}, what is the corresponding side on the larger triangle?`,
        options: uniqueOptions(rng, correct, [
          String(b + scale),
          String(a2),
          String(b * scale + 1),
        ]),
        correctAnswer: correct,
        explanation: `Scale factor ${a2}/${a} = ${scale}, so ${b}×${scale} = ${correct}.`,
        figureSvg: similarTrianglesSvg({ a, b, a2 }),
      };
    },
  },
  {
    id: "trapezoid-area",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const b1 = randInt(rng, 6, 14);
      const b2 = randInt(rng, 4, 12);
      const h = randInt(rng, 3, 9);
      const area = Math.round(((b1 + b2) / 2) * h);
      const correct = String(area);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A trapezoid has bases ${b1} and ${b2} and height ${h}. What is its area?`,
        options: uniqueOptions(rng, correct, [
          String(b1 + b2 + h),
          String(b1 * b2 * h),
          String(((b1 + b2) / 2) * h + 2),
        ]),
        correctAnswer: correct,
        explanation: `A = ½(${b1}+${b2})×${h} = ${area}.`,
      };
    },
  },
  {
    id: "cone-volume",
    topic: "geometry",
    allowNoCalc: false,
    allowCalc: true,
    generate: (rng) => {
      const r = randInt(rng, 3, 8);
      const h = randInt(rng, 4, 12);
      const v = Math.round((1 / 3) * 3.14 * r * r * h);
      const correct = String(v);
      return {
        type: "multiple_choice",
        topic: "geometry",
        prompt: `A cone has radius ${r} and height ${h}. Using π ≈ 3.14, what is its volume to the nearest whole number?`,
        options: uniqueOptions(rng, correct, [
          String(Math.round(3.14 * r * r * h)),
          String(Math.round(3.14 * r * r)),
          String(v + 10),
        ]),
        correctAnswer: correct,
        explanation: `V = (1/3)πr²h ≈ (1/3)×3.14×${r}²×${h} ≈ ${v}.`,
      };
    },
  },
];

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(n)
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}

export function getTemplates(): QuestionTemplate[] {
  return templates.map((t) => ({
    ...t,
    domain: resolveDomain(t),
  }));
}

export function generateFromTemplate(
  template: QuestionTemplate,
  rng: () => number,
  calculatorAllowed: boolean,
  position: number
): GeneratedQuestion {
  // Retry a few times to get a stable instance
  let last: GeneratedQuestion | null = null;
  for (let i = 0; i < 8; i += 1) {
    const partial = template.generate(rng);
    // Derive params fingerprint from prompt+answer for uniqueness
    const params = {
      prompt: partial.prompt,
      answer: partial.correctAnswer,
    };
    last = finish(template, rng, params, partial, calculatorAllowed, position);
    if (last.correctAnswer && last.prompt) return last;
  }
  return last!;
}
