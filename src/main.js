import * as THREE from "three";

const PARTICLE_COUNT = 7600;
const TEXTS = {
  one: "青年才俊",
  two: "长长久久",
};

const canvas = document.querySelector("#scene");
const video = document.querySelector("#camera");
const cameraStatus = document.querySelector("#cameraStatus");
const gestureStatus = document.querySelector("#gestureStatus");
const motionStatus = document.querySelector("#motionStatus");
const debugStatus = document.querySelector("#debugStatus");
const spreadControl = document.querySelector("#spreadControl");
const textOneButton = document.querySelector("#textOne");
const textTwoButton = document.querySelector("#textTwo");
const cameraRetryButton = document.querySelector("#cameraRetry");
const toast = document.querySelector("#toast");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x070a12, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a12, 12, 42);

const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 100);
camera.position.set(0, 0.55, 16);

const group = new THREE.Group();
scene.add(group);

const positionArray = new Float32Array(PARTICLE_COUNT * 3);
const colorArray = new Float32Array(PARTICLE_COUNT * 3);
const current = new Float32Array(PARTICLE_COUNT * 3);
const velocity = new Float32Array(PARTICLE_COUNT * 3);
const shapeTargets = {
  one: makeTextTargets(TEXTS.one),
  two: makeTextTargets(TEXTS.two),
};
const scatterTargets = makeScatterTargets();

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const offset = i * 3;
  const p = scatterTargets[offset] ? scatterTargets : shapeTargets.one;
  current[offset] = p[offset] + rand(-1.5, 1.5);
  current[offset + 1] = p[offset + 1] + rand(-1.5, 1.5);
  current[offset + 2] = p[offset + 2] + rand(-1.5, 1.5);
  positionArray[offset] = current[offset];
  positionArray[offset + 1] = current[offset + 1];
  positionArray[offset + 2] = current[offset + 2];

  const tone = i / PARTICLE_COUNT;
  const color = new THREE.Color().setHSL(0.53 + tone * 0.22, 0.88, 0.58);
  color.lerp(new THREE.Color(0xff4f8b), Math.max(0, Math.sin(tone * Math.PI * 2)) * 0.28);
  colorArray[offset] = color.r;
  colorArray[offset + 1] = color.g;
  colorArray[offset + 2] = color.b;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

const material = new THREE.PointsMaterial({
  size: 0.055,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
group.add(points);

let activeShape = "one";
let targetSpread = 0.36;
let smoothedSpread = targetSpread;
let hasHands = false;
let lastGestureAt = 0;
let clockStart = performance.now();
let handsModel = null;
let handLoopRunning = false;
let activeStream = null;
let rotationBlend = 1;
let stableTextBlend = 0;
let lastTextGestureAt = 0;

setActiveShape("one");
resize();
window.addEventListener("resize", resize);

textOneButton.addEventListener("click", () => setActiveShape("one", "按钮切换：青年才俊"));
textTwoButton.addEventListener("click", () => setActiveShape("two", "按钮切换：长长久久"));
cameraRetryButton.addEventListener("click", () => setupHands({ force: true }));
spreadControl.addEventListener("input", () => {
  targetSpread = Number(spreadControl.value) / 100;
  motionStatus.textContent = spreadLabel(targetSpread);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "1") setActiveShape("one", "键盘 1：青年才俊");
  if (event.key === "2") setActiveShape("two", "键盘 2：长长久久");
});

window.addEventListener("pointermove", (event) => {
  if (hasHands) return;
  targetSpread = Math.min(1, Math.max(0, event.clientX / window.innerWidth));
  spreadControl.value = String(Math.round(targetSpread * 100));
  motionStatus.textContent = spreadLabel(targetSpread);
});

animate();
setupHands();

async function setupHands({ force = false } = {}) {
  if (!window.Hands) {
    cameraStatus.textContent = "组件未加载";
    showToast("手势组件没有加载成功，请确认网络可访问 jsDelivr。");
    return;
  }

  try {
    if (force) stopActiveCamera();
    cameraStatus.textContent = "请求授权";
    debugStatus.textContent = "请求中";

    const stream = await openCameraStream();
    activeStream = stream;
    video.srcObject = stream;
    await video.play();

    handsModel = handsModel ?? createHandsModel();
    handLoopRunning = true;
    pumpVideoToHands();
    cameraStatus.textContent = "已开启";
    const devices = await listCameraDevices();
    const trackLabel = stream.getVideoTracks()[0]?.label;
    const name = trackLabel || devices[0]?.label || "摄像头";
    debugStatus.textContent = `设备 ${devices.length || 1}`;
    showToast(`摄像头已连接：${name}。双手张合控制扩散，手势 1 / 2 切换文字。`);
  } catch (error) {
    cameraStatus.textContent = readableCameraError(error).title;
    gestureStatus.textContent = "手动演示";
    debugStatus.textContent = error?.name || "未知错误";
    showToast(readableCameraError(error).message);
    console.warn(error);
  }
}

function createHandsModel() {
  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.72,
    minTrackingConfidence: 0.68,
    selfieMode: true,
  });
  hands.onResults(handleHandResults);
  return hands;
}

async function pumpVideoToHands() {
  if (!handLoopRunning || !handsModel || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (handLoopRunning) requestAnimationFrame(pumpVideoToHands);
    return;
  }

  try {
    await handsModel.send({ image: video });
  } catch (error) {
    console.warn(error);
  }
  if (handLoopRunning) requestAnimationFrame(pumpVideoToHands);
}

async function listCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

async function openCameraStream() {
  const preferred = {
    video: {
      width: { ideal: 960 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: { ideal: "user" },
    },
    audio: false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch (error) {
    if (error.name === "OverconstrainedError" || error.name === "NotFoundError") {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw error;
  }
}

function stopActiveCamera() {
  handLoopRunning = false;
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
  video.srcObject = null;
}

function readableCameraError(error) {
  const name = error?.name ?? "";
  const message = String(error?.message ?? "");

  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "权限被拒绝",
      message: "Edge 没有获得摄像头权限。请点地址栏左侧的权限图标，允许摄像头后再点“摄像头”重试。",
    };
  }
  if (name === "NotFoundError" || message.includes("没有检测到")) {
    return {
      title: "未找到设备",
      message: "没有检测到可用摄像头。请检查 Windows 设置 > 隐私和安全性 > 摄像头，并关闭可能占用摄像头的软件。",
    };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return {
      title: "设备被占用",
      message: "摄像头可能正被微信、会议软件或另一个浏览器标签占用。关闭占用后点“摄像头”重试。",
    };
  }
  return {
    title: "连接失败",
    message: `摄像头连接失败：${message || name || "未知错误"}。可先用键盘 1/2 和鼠标继续演示。`,
  };
}

function handleHandResults(results) {
  const hands = results.multiHandLandmarks ?? [];
  hasHands = hands.length > 0;

  if (!hands.length) {
    if (performance.now() - lastGestureAt > 800) {
      gestureStatus.textContent = "等待双手";
      cameraStatus.textContent = "已开启";
    }
    return;
  }

  lastGestureAt = performance.now();
  const fingerCounts = hands.map(countExtendedFingers);
  const primaryCount = fingerCounts.includes(2) ? 2 : fingerCounts.includes(1) ? 1 : fingerCounts[0];

  if (primaryCount === 1) {
    setActiveShape("one");
    gestureStatus.textContent = "手势 1";
    lastTextGestureAt = performance.now();
  } else if (primaryCount === 2) {
    setActiveShape("two");
    gestureStatus.textContent = "手势 2";
    lastTextGestureAt = performance.now();
  } else {
    gestureStatus.textContent = `${Math.min(2, hands.length)} 手 / ${primaryCount} 指`;
  }

  const handSpread = computeTwoHandSpread(hands);
  const openness = hands.reduce((sum, hand) => sum + computeHandOpenness(hand), 0) / hands.length;
  const textGestureActive = primaryCount === 1 || primaryCount === 2;
  targetSpread = Math.max(handSpread, openness * 0.72);
  if (textGestureActive) {
    targetSpread = handSpread > 0.22 ? THREE.MathUtils.smoothstep(handSpread, 0.22, 0.82) : 0;
  }
  targetSpread = THREE.MathUtils.clamp(targetSpread, 0, 1);
  spreadControl.value = String(Math.round(targetSpread * 100));
  motionStatus.textContent = spreadLabel(targetSpread);
}

function countExtendedFingers(landmarks) {
  const palmSize = distance2D(landmarks[0], landmarks[9]) || 0.1;
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let count = 0;

  for (let i = 0; i < tips.length; i += 1) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    const wristDistance = distance2D(tip, landmarks[0]);
    if (tip.y < pip.y - 0.018 && wristDistance > palmSize * 0.82) count += 1;
  }

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  if (distance2D(thumbTip, thumbMcp) > palmSize * 0.74 && Math.abs(thumbTip.x - thumbIp.x) > 0.035) {
    count += 1;
  }

  return count;
}

function computeTwoHandSpread(hands) {
  if (hands.length < 2) return 0;
  const centers = hands.slice(0, 2).map((hand) => {
    const sum = hand.reduce((acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    }, { x: 0, y: 0 });
    return { x: sum.x / hand.length, y: sum.y / hand.length };
  });
  const dist = distance2D(centers[0], centers[1]);
  return THREE.MathUtils.clamp((dist - 0.12) / 0.58, 0, 1);
}

function computeHandOpenness(hand) {
  const palm = distance2D(hand[0], hand[9]) || 0.1;
  const thumbIndex = distance2D(hand[4], hand[8]) / palm;
  const indexPinky = distance2D(hand[8], hand[20]) / palm;
  return THREE.MathUtils.clamp((thumbIndex * 0.42 + indexPinky * 0.58 - 0.74) / 1.12, 0, 1);
}

function animate() {
  requestAnimationFrame(animate);

  const elapsed = (performance.now() - clockStart) / 1000;
  const gestureRecentlySeen = performance.now() - lastGestureAt < 1200;
  const textGestureRecentlySeen = performance.now() - lastTextGestureAt < 1600;
  rotationBlend += ((gestureRecentlySeen ? 0 : 1) - rotationBlend) * 0.075;
  const expanding = targetSpread > 0.18;
  stableTextBlend += ((textGestureRecentlySeen && !expanding ? 1 : 0) - stableTextBlend) * 0.14;
  smoothedSpread += (targetSpread - smoothedSpread) * (expanding ? 0.18 : 0.1);
  const shape = shapeTargets[activeShape];
  const stillness = stableTextBlend;
  const breath = Math.sin(elapsed * 1.4) * 0.05 * (1 - stillness);
  const rawSpread = smoothedSpread + breath;
  const visualSpread = Math.max(0, rawSpread * (1 - stillness * 0.98));
  const burst = THREE.MathUtils.smoothstep(visualSpread, 0.04, 0.9);
  const twist = visualSpread * THREE.MathUtils.lerp(0.45, 1.15, burst) * (1 - stillness);
  const targetScale = 1 + visualSpread * THREE.MathUtils.lerp(1.15, 2.8, burst);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const sx = shape[offset];
    const sy = shape[offset + 1];
    const sz = shape[offset + 2];
    const wave = Math.sin(elapsed * 2.2 + i * 0.013) * 0.22 * burst;
    const rx = scatterTargets[offset] * visualSpread * 2.75 + wave;
    const ry = scatterTargets[offset + 1] * visualSpread * 2.05 + Math.cos(elapsed * 1.7 + i * 0.01) * 0.16 * burst;
    const rz = scatterTargets[offset + 2] * visualSpread * 3.35;

    const angle = twist * sy + elapsed * 0.05 * (1 - stillness);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tx = (sx * targetScale + rx) * cos - (sz + rz) * sin;
    const ty = sy * targetScale + ry;
    const tz = (sx * targetScale + rx) * sin + (sz + rz) * cos;

    const pull = THREE.MathUtils.lerp(0.018, 0.09, stillness);
    const damping = THREE.MathUtils.lerp(0.78, 0.38, stillness);
    velocity[offset] = (velocity[offset] + (tx - current[offset]) * pull) * damping;
    velocity[offset + 1] = (velocity[offset + 1] + (ty - current[offset + 1]) * pull) * damping;
    velocity[offset + 2] = (velocity[offset + 2] + (tz - current[offset + 2]) * pull) * damping;
    current[offset] += velocity[offset];
    current[offset + 1] += velocity[offset + 1];
    current[offset + 2] += velocity[offset + 2];

    positionArray[offset] = current[offset];
    positionArray[offset + 1] = current[offset + 1];
    positionArray[offset + 2] = current[offset + 2];
  }

  geometry.attributes.position.needsUpdate = true;
  group.rotation.y = Math.sin(elapsed * 0.32) * 0.12 * rotationBlend * (1 - stableTextBlend);
  group.rotation.x = Math.sin(elapsed * 0.23) * 0.045 * rotationBlend * (1 - stableTextBlend);
  renderer.render(scene, camera);
}

function makeTextTargets(text) {
  const textCanvas = document.createElement("canvas");
  const width = 1380;
  const height = 430;
  textCanvas.width = width;
  textCanvas.height = height;
  const ctx = textCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = text.length > 5 ? 178 : 220;
  ctx.font = `900 ${fontSize}px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif`;
  while (ctx.measureText(text).width > width * 0.9 && fontSize > 90) {
    fontSize -= 8;
    ctx.font = `900 ${fontSize}px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif`;
  }
  ctx.fillText(text, width / 2, height / 2 + fontSize * 0.02);

  const image = ctx.getImageData(0, 0, width, height).data;
  const points = [];
  const step = 5;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = image[(y * width + x) * 4 + 3];
      if (alpha > 80 && Math.random() > 0.1) {
        const px = (x / width - 0.5) * 13.6;
        const py = (0.5 - y / height) * 4.35;
        points.push([px + rand(-0.025, 0.025), py + rand(-0.025, 0.025), rand(-0.22, 0.22)]);
      }
    }
  }

  const targets = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const source = points[i % points.length];
    const offset = i * 3;
    targets[offset] = source[0] + rand(-0.018, 0.018);
    targets[offset + 1] = source[1] + rand(-0.018, 0.018);
    targets[offset + 2] = source[2];
  }
  return targets;
}

function makeScatterTargets() {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const radius = rand(1.6, 7.2);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(rand(-1, 1));
    targets[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    targets[offset + 1] = Math.cos(phi) * radius * 0.7;
    targets[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  return targets;
}

function setActiveShape(shape, message) {
  activeShape = shape;
  textOneButton.classList.toggle("active", shape === "one");
  textTwoButton.classList.toggle("active", shape === "two");
  gestureStatus.textContent = shape === "one" ? "手势 1" : "手势 2";
  if (message) showToast(message);
}

function spreadLabel(value) {
  if (value < 0.25) return "收缩";
  if (value > 0.68) return "扩散";
  return "聚合";
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = width < 760 ? 19 : 16;
  camera.updateProjectionMatrix();
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

let toastTimer = 0;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 4200);
}
