import * as THREE from "three";

const PARTICLE_COUNT = 11200;
const COUNTER_PARTICLES = 3400;
const ALBUM_STORAGE_KEY = "gestureParticleAlbumFolders";
const GITHUB_TOKEN_KEY = "gestureParticleGithubToken";
const LEGACY_CJ_STORAGE_KEY = "gestureParticleCjAlbum";
const DEFAULT_FOLDER_KEY = "20260509";
const CJ_FOLDER_KEY = "cj";
const GITHUB_OWNER = "70-z";
const GITHUB_REPO = "gesture-particle-demo";
const GITHUB_BRANCH = "main";
const MANIFEST_PATH = "assets/gallery/manifest.json";
const TEXTS = {
  one: "青年才俊",
  two: "才智超群",
};
const DEFAULT_IMAGES = [
  "./assets/gallery/1.jpg",
  "./assets/gallery/2.jpg",
  "./assets/gallery/3.jpg",
  "./assets/gallery/4.jpg",
];

const folders = loadStoredFolders();

const canvas = document.querySelector("#scene");
const video = document.querySelector("#camera");
const cameraStatus = document.querySelector("#cameraStatus");
const gestureStatus = document.querySelector("#gestureStatus");
const motionStatus = document.querySelector("#motionStatus");
const debugStatus = document.querySelector("#debugStatus");
const spreadControl = document.querySelector("#spreadControl");
const textOneButton = document.querySelector("#textOne");
const textTwoButton = document.querySelector("#textTwo");
const numberThreeButton = document.querySelector("#numberThree");
const numberFourButton = document.querySelector("#numberFour");
const exitGalleryButton = document.querySelector("#exitGallery");
const defaultGalleryButton = document.querySelector("#defaultGalleryButton");
const newFolderButton = document.querySelector("#newFolderButton");
const folderSelect = document.querySelector("#folderSelect");
const authButton = document.querySelector("#authButton");
const cjUploadButton = document.querySelector("#cjUploadButton");
const deletePhotoButton = document.querySelector("#deletePhotoButton");
const cjUpload = document.querySelector("#cjUpload");
const cameraRetryButton = document.querySelector("#cameraRetry");
const gallery = document.querySelector("#gallery");
const galleryFrame = document.querySelector(".gallery-frame");
const galleryImage = document.querySelector("#galleryImage");
const galleryTitle = document.querySelector("#galleryTitle");
const galleryCounter = document.querySelector("#galleryCounter");
const galleryEmpty = document.querySelector("#galleryEmpty");
const folderTabs = document.querySelector("#folderTabs");
const galleryPrev = document.querySelector("#galleryPrev");
const galleryNext = document.querySelector("#galleryNext");
const toast = document.querySelector("#toast");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x100612, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x100612, 12, 42);

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
const albumTargetCache = new Map();
const scatterTargets = makeScatterTargets();
let activeTargets = shapeTargets.one;

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const offset = i * 3;
  const p = Math.random() > 0.5 ? scatterTargets : shapeTargets.one;
  current[offset] = p[offset] + rand(-1.5, 1.5);
  current[offset + 1] = p[offset + 1] + rand(-1.5, 1.5);
  current[offset + 2] = p[offset + 2] + rand(-1.5, 1.5);
  positionArray[offset] = current[offset];
  positionArray[offset + 1] = current[offset + 1];
  positionArray[offset + 2] = current[offset + 2];
  setDefaultParticleColor(i, offset);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

const material = new THREE.PointsMaterial({
  size: 0.06,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.94,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
group.add(points);

let activeShape = "one";
let activeFolderKey = DEFAULT_FOLDER_KEY;
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
let galleryState = "closed";
let galleryIndex = 0;
let lastPhotoSwitchAt = 0;
let lastGalleryToggleAt = 0;

setActiveShape("one");
resize();
window.addEventListener("resize", resize);

textOneButton.addEventListener("click", () => handleNumberAction(1, "点击 1"));
textTwoButton.addEventListener("click", () => handleNumberAction(2, "点击 2"));
numberThreeButton.addEventListener("click", () => handleNumberAction(3, "点击 3"));
numberFourButton.addEventListener("click", () => handleNumberAction(4, "点击 4"));
exitGalleryButton.addEventListener("click", () => closeGallery("点击退出相册"));
defaultGalleryButton.addEventListener("click", () => openGallery(activeFolderKey));
newFolderButton.addEventListener("click", createFolder);
authButton.addEventListener("click", configureGithubToken);
cjUploadButton.addEventListener("click", () => cjUpload.click());
deletePhotoButton.addEventListener("click", deleteCurrentPhoto);
cameraRetryButton.addEventListener("click", () => setupHands({ force: true }));
galleryPrev.addEventListener("click", () => switchGalleryPhoto(-1));
galleryNext.addEventListener("click", () => switchGalleryPhoto(1));
cjUpload.addEventListener("change", handleCjUpload);
folderSelect.addEventListener("change", () => {
  if (folders[folderSelect.value]) openGallery(folderSelect.value);
});
spreadControl.addEventListener("input", () => {
  targetSpread = Number(spreadControl.value) / 100;
  motionStatus.textContent = spreadLabel(targetSpread);
});

window.addEventListener("keydown", (event) => {
  if (["1", "2", "3", "4"].includes(event.key)) {
    handleNumberAction(Number(event.key), `键盘 ${event.key}`);
    return;
  }
  if (event.key === "Escape") closeGallery("键盘退出相册");
  if (event.key === "ArrowLeft" && galleryState === "open") switchGalleryPhoto(-1);
  if (event.key === "ArrowRight" && galleryState === "open") switchGalleryPhoto(1);
});

window.addEventListener("pointermove", (event) => {
  if (hasHands) return;
  targetSpread = Math.min(1, Math.max(0, event.clientX / window.innerWidth));
  spreadControl.value = String(Math.round(targetSpread * 100));
  motionStatus.textContent = spreadLabel(targetSpread);
});

animate();
renderFolderControls();
loadRemoteFolders();
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
    showToast(`摄像头已连接：${name}。普通模式手势 1 / 2 切文字；点击进入或退出相册，相册内手势 1-4 切图。`);
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
    message: `摄像头连接失败：${message || name || "未知错误"}。可先用页面按钮继续演示。`,
  };
}

function handleHandResults(results) {
  const hands = results.multiHandLandmarks ?? [];
  hasHands = hands.length > 0;

  if (!hands.length) {
    if (performance.now() - lastGestureAt > 800) {
      gestureStatus.textContent = galleryState === "open" ? "相册模式" : "等待手势";
      cameraStatus.textContent = "已开启";
    }
    return;
  }

  lastGestureAt = performance.now();
  const fingerCounts = hands.map(countExtendedFingers);
  const handSpread = computeTwoHandSpread(hands);
  const openness = hands.reduce((sum, hand) => sum + computeHandOpenness(hand), 0) / hands.length;
  const primaryCount = [5, 4, 3, 2, 1].find((count) => fingerCounts.includes(count)) ?? fingerCounts[0];

  if (galleryState === "open") {
    handleGalleryGestures(primaryCount, handSpread, openness);
    return;
  }

  if (primaryCount === 1) {
    setActiveShape("one");
  } else if (primaryCount === 2) {
    setActiveShape("two");
  } else {
    gestureStatus.textContent = `${Math.min(2, hands.length)} 手 / ${primaryCount} 指`;
  }

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
  rotationBlend += ((gestureRecentlySeen || galleryState === "open" ? 0 : 1) - rotationBlend) * 0.075;
  const expanding = targetSpread > 0.18;
  const stableTarget = galleryState === "open" ? 0.58 : textGestureRecentlySeen && !expanding ? 1 : 0;
  stableTextBlend += (stableTarget - stableTextBlend) * 0.14;
  smoothedSpread += (targetSpread - smoothedSpread) * (expanding ? 0.18 : 0.1);
  const stillness = stableTextBlend;
  const breath = Math.sin(elapsed * 1.4) * 0.05 * (1 - stillness);
  const rawSpread = smoothedSpread + breath;
  const visualSpread = Math.max(0, rawSpread * (1 - stillness * 0.72));
  const burst = THREE.MathUtils.smoothstep(visualSpread, 0.04, 0.9);
  const twist = visualSpread * THREE.MathUtils.lerp(0.45, 1.15, burst) * (1 - stillness);
  const targetScale = 1 + visualSpread * THREE.MathUtils.lerp(1.15, 2.8, burst);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const sx = activeTargets[offset];
    const sy = activeTargets[offset + 1];
    const sz = activeTargets[offset + 2];
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

    const color = getDefaultParticleColor(i, elapsed);
    colorArray[offset] += (color.r - colorArray[offset]) * 0.08;
    colorArray[offset + 1] += (color.g - colorArray[offset + 1]) * 0.08;
    colorArray[offset + 2] += (color.b - colorArray[offset + 2]) * 0.08;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  group.rotation.y = Math.sin(elapsed * 0.32) * 0.12 * rotationBlend * (1 - stableTextBlend);
  group.rotation.x = Math.sin(elapsed * 0.23) * 0.045 * rotationBlend * (1 - stableTextBlend);
  renderer.render(scene, camera);
}

function makeTextTargets(text, options = {}) {
  const textCanvas = document.createElement("canvas");
  const width = options.width ?? 1380;
  const height = options.height ?? 430;
  const scaleX = options.scaleX ?? 13.6;
  const scaleY = options.scaleY ?? 4.35;
  const yOffset = options.yOffset ?? 0;
  const zRange = options.zRange ?? 0.22;
  textCanvas.width = width;
  textCanvas.height = height;
  const ctx = textCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = options.fontSize ?? (text.length > 5 ? 178 : 220);
  ctx.font = `900 ${fontSize}px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif`;
  while (ctx.measureText(text).width > width * 0.9 && fontSize > 64) {
    fontSize -= 8;
    ctx.font = `900 ${fontSize}px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif`;
  }
  ctx.fillText(text, width / 2, height / 2 + fontSize * 0.02);

  const image = ctx.getImageData(0, 0, width, height).data;
  const points = [];
  const step = options.step ?? 5;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = image[(y * width + x) * 4 + 3];
      if (alpha > 80 && Math.random() > 0.1) {
        const px = (x / width - 0.5) * scaleX;
        const py = (0.5 - y / height) * scaleY + yOffset;
        points.push([px + rand(-0.025, 0.025), py + rand(-0.025, 0.025), rand(-zRange, zRange)]);
      }
    }
  }

  if (!points.length) points.push([0, yOffset, 0]);

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

function makeAlbumTargets(label) {
  if (albumTargetCache.has(label)) return albumTargetCache.get(label);
  const counter = makeTextTargets(label, {
    width: 760,
    height: 240,
    scaleX: 4.25,
    scaleY: 1.36,
    yOffset: -4.38,
    fontSize: 148,
    step: 4,
    zRange: 0.16,
  });
  const halo = makeAlbumHaloTargets();
  const targets = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const source = i < COUNTER_PARTICLES ? counter : halo;
    targets[offset] = source[offset];
    targets[offset + 1] = source[offset + 1];
    targets[offset + 2] = source[offset + 2];
  }

  albumTargetCache.set(label, targets);
  return targets;
}

function makeAlbumHaloTargets() {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const side = Math.random();
    const layer = Math.random();
    let x;
    let y;
    if (side < 0.32) {
      x = rand(-7.4, 7.4);
      y = rand(2.55, 4.2);
    } else if (side < 0.64) {
      x = rand(-7.4, 7.4);
      y = rand(-2.65, -1.35);
    } else if (side < 0.82) {
      x = rand(-7.8, -4.75);
      y = rand(-1.55, 2.75);
    } else {
      x = rand(4.75, 7.8);
      y = rand(-1.55, 2.75);
    }
    targets[offset] = x + Math.sin(layer * Math.PI * 2) * 0.25;
    targets[offset + 1] = y + Math.cos(layer * Math.PI * 2) * 0.18;
    targets[offset + 2] = rand(-1.45, 1.45);
  }
  return targets;
}

function getDefaultParticleColor(i, elapsed = 0) {
  const tone = i / PARTICLE_COUNT;
  const shimmer = (Math.sin(elapsed * 1.8 + i * 0.017) + 1) * 0.5;
  const hue = THREE.MathUtils.lerp(0.885, 0.965, (tone * 1.7 + shimmer * 0.24) % 1);
  const saturation = THREE.MathUtils.lerp(0.74, 0.98, shimmer);
  const lightness = THREE.MathUtils.lerp(0.58, 0.76, Math.sin(tone * Math.PI * 6) * 0.5 + 0.5);
  return new THREE.Color().setHSL(hue, saturation, lightness);
}

function setDefaultParticleColor(i, offset) {
  const color = getDefaultParticleColor(i);
  colorArray[offset] = color.r;
  colorArray[offset + 1] = color.g;
  colorArray[offset + 2] = color.b;
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

function handleNumberAction(number, messagePrefix = "切换") {
  if (galleryState === "open") {
    if (number >= 1 && number <= 4) {
      showGalleryPhoto(number - 1, `${messagePrefix}：第 ${number} 张`);
    }
    return;
  }

  if (number === 1) {
    setActiveShape("one", `${messagePrefix}：青年才俊`);
  } else if (number === 2) {
    setActiveShape("two", `${messagePrefix}：才智超群`);
  } else if (number === 3) {
    showToast("点击“相册”或“cj”进入相册；按钮 3 在相册模式下切第 3 张。");
  } else {
    showToast("普通模式下手势 1/2 切文字，点击“相册”或“cj”进入相册。");
  }
}

function setActiveShape(shape, message) {
  if (galleryState === "open") return;
  galleryState = "closed";
  activeShape = shape;
  activeTargets = shapeTargets[shape];
  lastTextGestureAt = performance.now();
  textOneButton.classList.toggle("active", shape === "one");
  textTwoButton.classList.toggle("active", shape === "two");
  numberThreeButton.classList.remove("active");
  numberFourButton.classList.remove("active");
  exitGalleryButton.classList.remove("active");
  defaultGalleryButton.classList.remove("active");
  newFolderButton.classList.remove("active");
  authButton.classList.toggle("active", hasGithubToken());
  deletePhotoButton.classList.remove("active");
  gestureStatus.textContent = shape === "one" ? "手势 1" : "手势 2";
  if (message) showToast(message);
}

function openGallery(folderKey = activeFolderKey) {
  activeFolderKey = folders[folderKey] ? folderKey : DEFAULT_FOLDER_KEY;
  galleryState = "open";
  galleryIndex = Math.min(galleryIndex, Math.max(0, getActiveImages().length - 1));
  targetSpread = 0.32;
  smoothedSpread = Math.max(smoothedSpread, 0.24);
  lastGalleryToggleAt = performance.now();
  gallery.classList.add("open");
  gallery.setAttribute("aria-hidden", "false");
  textOneButton.classList.remove("active");
  textTwoButton.classList.remove("active");
  numberThreeButton.classList.remove("active");
  numberFourButton.classList.toggle("active", galleryIndex === 3);
  exitGalleryButton.classList.add("active");
  defaultGalleryButton.classList.add("active");
  motionStatus.textContent = "相册";
  gestureStatus.textContent = "相册模式";
  renderFolderControls();
  updateGalleryPhoto();
  showToast(`已打开 ${folders[activeFolderKey].title} 文件夹，可选择文件夹上传照片。`);
}

function closeGallery(message = "已退出相册。") {
  if (galleryState !== "open") return;
  gallery.classList.remove("open");
  gallery.setAttribute("aria-hidden", "true");
  galleryState = "closed";
  lastGalleryToggleAt = performance.now();
  setActiveShape(activeShape || "one");
  targetSpread = 0;
  lastTextGestureAt = performance.now();
  motionStatus.textContent = "收缩";
  showToast(message);
}

function handleGalleryGestures(primaryCount, handSpread, openness) {
  gestureStatus.textContent = "相册模式";
  targetSpread = Math.max(0.24, handSpread, openness * 0.62);
  targetSpread = THREE.MathUtils.clamp(targetSpread, 0, 1);
  spreadControl.value = String(Math.round(targetSpread * 100));
  motionStatus.textContent = "相册";
  const now = performance.now();
  if (now - lastPhotoSwitchAt < 850) return;
  if (primaryCount >= 1 && primaryCount <= 4) showGalleryPhoto(primaryCount - 1, `手势 ${primaryCount}`);
}

function switchGalleryPhoto(direction) {
  const images = getActiveImages();
  if (!images.length) {
    showToast("当前相册还没有照片。");
    return;
  }
  galleryIndex = (galleryIndex + direction + images.length) % images.length;
  lastPhotoSwitchAt = performance.now();
  updateGalleryPhoto();
}

function showGalleryPhoto(index, message) {
  const images = getActiveImages();
  if (!images.length) {
    showToast(`${folders[activeFolderKey].title} 文件夹还没有照片，选择文件夹后点“上传”添加。`);
    return;
  }
  if (index < 0 || index >= images.length) {
    showToast(`当前相册只有 ${images.length} 张照片。`);
    return;
  }
  if (index === galleryIndex) {
    updateGalleryPhoto();
    return;
  }
  galleryIndex = index;
  lastPhotoSwitchAt = performance.now();
  updateGalleryPhoto();
  if (message) showToast(message);
}

function updateGalleryPhoto() {
  const folder = folders[activeFolderKey];
  const images = getActiveImages();
  galleryTitle.textContent = folder.title;
  galleryFrame.classList.add("switching");

  window.setTimeout(() => {
    if (images.length) {
      galleryIndex = THREE.MathUtils.clamp(galleryIndex, 0, images.length - 1);
      galleryImage.src = images[galleryIndex];
      galleryImage.alt = `${folder.title}照片 ${galleryIndex + 1}`;
      galleryImage.hidden = false;
      galleryEmpty.hidden = true;
      galleryCounter.textContent = `${galleryIndex + 1} / ${images.length}`;
      activeTargets = makeAlbumTargets(`${galleryIndex + 1}/${images.length}`);
      updateNumberButtonState();
    } else {
      galleryImage.removeAttribute("src");
      galleryImage.hidden = true;
      galleryEmpty.hidden = false;
      galleryEmpty.textContent = folder.title;
      galleryCounter.textContent = "0 / 0";
      activeTargets = makeAlbumTargets("0/0");
      updateNumberButtonState();
    }
    galleryFrame.classList.remove("switching");
  }, 120);
}

function updateNumberButtonState() {
  const isOpen = galleryState === "open";
  textOneButton.classList.toggle("active", isOpen && galleryIndex === 0);
  textTwoButton.classList.toggle("active", isOpen && galleryIndex === 1);
  numberThreeButton.classList.toggle("active", isOpen && galleryIndex === 2);
  numberFourButton.classList.toggle("active", isOpen && galleryIndex === 3);
  exitGalleryButton.classList.toggle("active", isOpen);
  defaultGalleryButton.classList.toggle("active", isOpen);
  deletePhotoButton.classList.toggle("active", isOpen && getActiveImages().length > 0);
}

async function handleCjUpload() {
  const files = Array.from(cjUpload.files ?? []).filter((file) => file.type.startsWith("image/"));
  cjUpload.value = "";
  if (!files.length) return;
  const targetKey = folders[folderSelect.value] ? folderSelect.value : activeFolderKey;
  const token = await requireGithubToken();
  if (!token) return;

  try {
    debugStatus.textContent = "上传处理中";
    const uploaded = [];
    for (const file of files) {
      const compressed = await compressImageFile(file);
      const fileName = makeUploadFileName(file);
      const repoPath = `assets/gallery/${targetKey}/${fileName}`;
      await putGithubFile(repoPath, compressed.base64, `Upload ${fileName}`, token);
      uploaded.push(`./${repoPath}`);
    }
    folders[targetKey].images.push(...uploaded);
    await saveFoldersEverywhere(`Update ${folders[targetKey].title} album`, token);
    galleryIndex = Math.max(0, folders[targetKey].images.length - uploaded.length);
    openGallery(targetKey);
    updateGalleryPhoto();
    debugStatus.textContent = `${folders[targetKey].title} ${folders[targetKey].images.length} 张`;
    showToast(`已上传 ${uploaded.length} 张照片到 ${folders[targetKey].title}，其他设备稍后刷新即可看到。`);
  } catch (error) {
    console.warn(error);
    debugStatus.textContent = "上传失败";
    showToast(`上传失败：${error.message || "请检查 GitHub 授权和网络"}`);
  }
}

async function deleteCurrentPhoto() {
  if (galleryState !== "open") {
    showToast("请先打开相册。");
    return;
  }

  const images = getActiveImages();
  if (!images.length) {
    showToast("当前文件夹没有照片可删除。");
    return;
  }

  const folder = folders[activeFolderKey];
  const photoUrl = images[galleryIndex];
  const ok = window.confirm(`确定删除 ${folder.title} 文件夹里的第 ${galleryIndex + 1} 张照片吗？`);
  if (!ok) return;

  const token = await requireGithubToken();
  if (!token) return;

  try {
    debugStatus.textContent = "删除处理中";
    const repoPath = toRepoPath(photoUrl);
    images.splice(galleryIndex, 1);
    galleryIndex = Math.min(galleryIndex, Math.max(0, images.length - 1));

    if (repoPath && repoPath.startsWith(`assets/gallery/${activeFolderKey}/`)) {
      await deleteGithubFile(repoPath, `Delete ${folder.title} photo`, token);
    }
    await saveFoldersEverywhere(`Update ${folder.title} album after delete`, token);
    renderFolderControls();
    updateGalleryPhoto();
    debugStatus.textContent = `${folder.title} ${images.length} 张`;
    showToast("已删除，其他设备稍后刷新即可同步。");
  } catch (error) {
    console.warn(error);
    showToast(`删除失败：${error.message || "请检查 GitHub 授权和网络"}`);
    await loadRemoteFolders();
  }
}

async function loadRemoteFolders() {
  try {
    const response = await fetch(`./${MANIFEST_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest?.folders || typeof manifest.folders !== "object") return;

    const merged = normalizeManifestFolders(manifest.folders);
    for (const key of Object.keys(folders)) delete folders[key];
    Object.assign(folders, merged);
    if (!folders[activeFolderKey]) activeFolderKey = DEFAULT_FOLDER_KEY;
    renderFolderControls();
    if (galleryState === "open") updateGalleryPhoto();
    debugStatus.textContent = "相册已同步";
  } catch (error) {
    console.warn(error);
  }
}

function normalizeManifestFolders(source) {
  const normalized = {
    [DEFAULT_FOLDER_KEY]: {
      title: DEFAULT_FOLDER_KEY,
      images: DEFAULT_IMAGES,
      builtIn: true,
    },
    [CJ_FOLDER_KEY]: {
      title: CJ_FOLDER_KEY,
      images: [],
    },
  };

  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== "object") continue;
    const title = typeof value.title === "string" && value.title.trim() ? value.title.trim() : key;
    const images = Array.isArray(value.images) ? value.images.filter((item) => typeof item === "string") : [];
    normalized[key] = {
      title,
      images: key === DEFAULT_FOLDER_KEY && !images.length ? DEFAULT_IMAGES : images,
      builtIn: !!value.builtIn || key === DEFAULT_FOLDER_KEY,
    };
  }

  return normalized;
}

async function saveFoldersEverywhere(message, token) {
  saveStoredFolders();
  await putGithubFile(MANIFEST_PATH, utf8ToBase64(JSON.stringify({ folders: serializeFolders(folders) }, null, 2)), message, token);
}

async function putGithubFile(path, contentBase64, message, token) {
  const existing = await getGithubFile(path, token);
  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponentPath(path)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: GITHUB_BRANCH,
      sha: existing?.sha,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub 写入失败 ${response.status}: ${text.slice(0, 120)}`);
  }
  return response.json();
}

async function deleteGithubFile(path, message, token) {
  const existing = await getGithubFile(path, token);
  if (!existing?.sha) return null;

  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponentPath(path)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub 删除失败 ${response.status}: ${text.slice(0, 120)}`);
  }
  return response.json();
}

async function getGithubFile(path, token) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponentPath(path)}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub 读取失败 ${response.status}: ${text.slice(0, 120)}`);
  }
  return response.json();
}

function configureGithubToken() {
  const current = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  const token = window.prompt("请输入 GitHub fine-grained token（需要 Contents: Read and write）", current);
  if (token === null) return;
  const trimmed = token.trim();
  if (!trimmed) {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    authButton.classList.remove("active");
    showToast("已清除 GitHub 授权。");
    return;
  }
  localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
  authButton.classList.add("active");
  showToast("授权已保存到本浏览器，可用于上传到 GitHub 仓库。");
}

async function requireGithubToken() {
  let token = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  if (!token) {
    configureGithubToken();
    token = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  }
  if (!token) showToast("需要先点击“授权”填写 GitHub Token，才能保存到多设备可见的相册。");
  return token;
}

function hasGithubToken() {
  return !!localStorage.getItem(GITHUB_TOKEN_KEY);
}

function makeUploadFileName(file) {
  const safeName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName || "photo"}.jpg`;
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toRepoPath(url) {
  if (!url || url.startsWith("data:")) return "";
  try {
    const parsed = new URL(url, window.location.href);
    const path = parsed.pathname.replace(/^\/gesture-particle-demo\//, "").replace(/^\//, "");
    return path;
  } catch {
    return url.replace(/^\.\//, "");
  }
}

function utf8ToBase64(text) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const imageCanvas = document.createElement("canvas");
        imageCanvas.width = width;
        imageCanvas.height = height;
        const ctx = imageCanvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = imageCanvas.toDataURL("image/jpeg", 0.84);
        resolve({
          dataUrl,
          base64: dataUrl.split(",")[1],
        });
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function loadStoredFolders() {
  const base = {
    [DEFAULT_FOLDER_KEY]: {
      title: DEFAULT_FOLDER_KEY,
      images: DEFAULT_IMAGES,
      builtIn: true,
    },
    [CJ_FOLDER_KEY]: {
      title: CJ_FOLDER_KEY,
      images: [],
    },
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(ALBUM_STORAGE_KEY) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object") continue;
        const title = typeof value.title === "string" && value.title.trim() ? value.title.trim() : key;
        const images = Array.isArray(value.images) ? value.images.filter((item) => typeof item === "string") : [];
        base[key] = {
          title,
          images: key === DEFAULT_FOLDER_KEY && !images.length ? DEFAULT_IMAGES : images,
          builtIn: key === DEFAULT_FOLDER_KEY,
        };
      }
    }

    const legacyCj = JSON.parse(localStorage.getItem(LEGACY_CJ_STORAGE_KEY) || "[]");
    if (Array.isArray(legacyCj) && legacyCj.length && !base[CJ_FOLDER_KEY].images.length) {
      base[CJ_FOLDER_KEY].images = legacyCj.filter((item) => typeof item === "string");
      localStorage.removeItem(LEGACY_CJ_STORAGE_KEY);
      localStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(serializeFolders(base)));
    }
  } catch {
  }
  return base;
}

function saveStoredFolders() {
  localStorage.setItem(ALBUM_STORAGE_KEY, JSON.stringify(serializeFolders(folders)));
}

function serializeFolders(source) {
  return Object.fromEntries(Object.entries(source).map(([key, folder]) => [
    key,
    {
      title: folder.title,
      images: folder.images,
      builtIn: !!folder.builtIn,
    },
  ]));
}

function getActiveImages() {
  return folders[activeFolderKey]?.images ?? [];
}

function renderFolderControls() {
  folderSelect.innerHTML = "";
  folderTabs.innerHTML = "";

  for (const [key, folder] of Object.entries(folders)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${folder.title} (${folder.images.length})`;
    option.selected = key === activeFolderKey;
    folderSelect.append(option);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = folder.title;
    button.className = key === activeFolderKey ? "active" : "";
    button.addEventListener("click", () => {
      galleryIndex = 0;
      openGallery(key);
    });
    folderTabs.append(button);
  }
}

async function createFolder() {
  const raw = window.prompt("请输入新文件夹名称", "");
  const title = raw?.trim();
  if (!title) return;
  const token = await requireGithubToken();
  if (!token) return;

  const key = makeFolderKey(title);
  if (folders[key]) {
    showToast("这个文件夹已经存在。");
    return;
  }

  folders[key] = {
    title,
    images: [],
  };
  activeFolderKey = key;
  galleryIndex = 0;
  try {
    await saveFoldersEverywhere(`Create album folder ${title}`, token);
    renderFolderControls();
    openGallery(key);
    showToast(`已新建 ${title} 文件夹，其他设备稍后刷新即可看到。`);
  } catch (error) {
    delete folders[key];
    console.warn(error);
    showToast(`新建失败：${error.message || "请检查 GitHub 授权和网络"}`);
  }
}

function makeFolderKey(title) {
  const normalized = title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "");
  let key = normalized || `folder-${Date.now()}`;
  let suffix = 2;
  while (folders[key]) {
    key = `${normalized}-${suffix}`;
    suffix += 1;
  }
  return key;
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
