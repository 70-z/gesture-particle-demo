import * as THREE from "three";

const PARTICLE_COUNT = 11200;
const COUNTER_PARTICLES = 3400;
const TEXT_FLOAT_RATIO = 0.26;
const TEXT_CORE_PARTICLES = Math.floor(PARTICLE_COUNT * (1 - TEXT_FLOAT_RATIO));
const COLOR_UPDATE_STRIDE = 2;
const HAND_FRAME_INTERVAL = 48;
const ALBUM_STORAGE_KEY = "gestureParticleAlbumFolders";
const GITHUB_TOKEN_KEY = "gestureParticleGithubToken";
const LEGACY_CJ_STORAGE_KEY = "gestureParticleCjAlbum";
const STATUS_COLLAPSED_KEY = "gestureParticleStatusCollapsed";
const CAMERA_PREVIEW_COLLAPSED_KEY = "gestureParticleCameraPanelCollapsed";
const THEME_COLOR_KEY = "gestureParticleThemeColor";
const SPREAD_SENSITIVITY_KEY = "gestureParticleSpreadSensitivity";
const ROTATION_SENSITIVITY_KEY = "gestureParticleRotationSensitivityV2";
const DEFAULT_FOLDER_KEY = "20260509";
const CJ_FOLDER_KEY = "cj";
const GITHUB_OWNER = "70-z";
const GITHUB_REPO = "qingniancaijun";
const GITHUB_BRANCH = "main";
const MANIFEST_PATH = "assets/gallery/manifest.json";
const TEXTS = {
  one: "青年才俊",
  two: "苏音唯美，爱泷不悔",
  three: "Silence牛逼克拉斯",
};
const DEFAULT_IMAGES = [
  "./assets/gallery/1.jpg",
  "./assets/gallery/2.jpg",
  "./assets/gallery/3.jpg",
  "./assets/gallery/4.jpg",
];
const FEATURE_IMAGES = {
  tomorrow: "./assets/features/tomorrow-world.jpg",
  dragon: "./assets/features/sulong.jpg",
};
const FEATURE_LABELS = {
  heart: "爱心",
  lightning: "闪电",
  crystal: "桃心晶体",
  tomorrow: "明日世界",
  dragon: "素龙",
  sphere: "球体",
};
const THEME_PRESETS = {
  pink: ["#ff5da8", "#ff8ac6", "#bf2f74", "#ffd1e8", "#100612", 0.925],
  blue: ["#4da3ff", "#8fd2ff", "#2863d8", "#caecff", "#06101e", 0.58],
  green: ["#4ee08a", "#9affbd", "#159a55", "#caffdd", "#06140d", 0.39],
  red: ["#ff5b6e", "#ff9aa6", "#c9273d", "#ffd1d6", "#130509", 0.985],
  yellow: ["#ffd84d", "#ffe98f", "#c49316", "#fff1ba", "#120d04", 0.14],
  purple: ["#b56cff", "#d4a3ff", "#7c34cf", "#ead2ff", "#0e0616", 0.765],
};

const folders = loadStoredFolders();

const canvas = document.querySelector("#scene");
const cameraPreview = document.querySelector("#cameraPreview");
const cameraPreviewToggle = document.querySelector("#cameraPreviewToggle");
const cameraCheckButton = document.querySelector("#cameraCheck");
const video = document.querySelector("#camera");
const cameraStatus = document.querySelector("#cameraStatus");
const gestureStatus = document.querySelector("#gestureStatus");
const motionStatus = document.querySelector("#motionStatus");
const debugStatus = document.querySelector("#debugStatus");
const statusPanel = document.querySelector("#statusPanel");
const statusToggle = document.querySelector("#statusToggle");
const sensitivityButton = document.querySelector("#sensitivityButton");
const sensitivityPanel = document.querySelector("#sensitivityPanel");
const rotationSensitivityButton = document.querySelector("#rotationSensitivityButton");
const spreadSensitivityButton = document.querySelector("#spreadSensitivityButton");
const sensitivityControl = document.querySelector("#sensitivityControl");
const sensitivityLabel = document.querySelector("#sensitivityLabel");
const sensitivityValue = document.querySelector("#sensitivityValue");
const textOneButton = document.querySelector("#textOne");
const textTwoButton = document.querySelector("#textTwo");
const numberThreeButton = document.querySelector("#numberThree");
const featureButton = document.querySelector("#featureButton");
const featurePanel = document.querySelector("#featurePanel");
const featureExitButton = document.querySelector("#featureExit");
const colorButton = document.querySelector("#colorButton");
const colorPalette = document.querySelector("#colorPalette");
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
  one: makeTextTargets(TEXTS.one, { floatRatio: TEXT_FLOAT_RATIO }),
  two: makeTextTargets(TEXTS.two, { floatRatio: TEXT_FLOAT_RATIO }),
  three: makeTextTargets(TEXTS.three, { floatRatio: TEXT_FLOAT_RATIO }),
};
const featureTargets = {
  heart: makeFilledHeartTargets(),
  lightning: makeFilledLightningTargets(),
  crystal: makeCrystalHeartTargets(),
  tomorrow: makeImagePlaceholderTargets(),
  dragon: makeImagePlaceholderTargets(),
  sphere: makeSphereTargets(),
};
loadFeatureImageTargets();
const albumTargetCache = new Map();
const scatterTargets = makeScatterTargets();
let activeTargets = shapeTargets.one;
let spreadSensitivity = loadStoredNumber(SPREAD_SENSITIVITY_KEY, 42);
let rotationSensitivity = loadStoredNumber(ROTATION_SENSITIVITY_KEY, 86);
let sensitivityMode = "rotation";
let activeTheme = localStorage.getItem(THEME_COLOR_KEY) || "pink";
const reusableParticleColor = new THREE.Color();

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
let smoothedHandSpread = targetSpread;
let smoothedHandOpenness = targetSpread;
let targetHandRotationY = 0;
let targetHandRotationX = 0;
let smoothedHandRotationY = 0;
let smoothedHandRotationX = 0;
let hasHands = false;
let lastGestureAt = 0;
let clockStart = performance.now();
let handsModel = null;
let handLoopRunning = false;
let activeStream = null;
let rotationBlend = 1;
let stableTextBlend = 0;
let lastTextGestureAt = 0;
let stableFingerCount = 0;
let pendingFingerCount = 0;
let pendingFingerCountAt = 0;
let lastFiveFingerAt = 0;
let galleryState = "closed";
let galleryIndex = 0;
let galleryPhotoToken = 0;
let lastPhotoSwitchAt = 0;
let lastGalleryToggleAt = 0;
let activeFeature = null;
let lastHandFrameAt = 0;
let frameIndex = 0;
let lockedTextShape = null;
let textViewLockBlend = 0;

setActiveShape("one");
resize();
window.addEventListener("resize", resize);
applyTheme(activeTheme);
updateSensitivityPanel();

textOneButton.addEventListener("click", () => handleNumberAction(1, "点击 1"));
textTwoButton.addEventListener("click", () => handleNumberAction(2, "点击 2"));
numberThreeButton.addEventListener("click", () => handleNumberAction(3, "点击 3"));
featureButton.addEventListener("click", () => setFeaturePanelOpen(!featurePanel.classList.contains("open")));
featureExitButton.addEventListener("click", () => exitFeature("已退出功能。"));
featurePanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feature-shape]");
  if (!button) return;
  setFeatureShape(button.dataset.featureShape);
});
colorButton.addEventListener("click", () => {
  colorPalette.hidden = !colorPalette.hidden;
  colorButton.classList.toggle("active", !colorPalette.hidden);
});
colorPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-color]");
  if (!button) return;
  applyTheme(button.dataset.themeColor, true);
});
exitGalleryButton.addEventListener("click", () => closeGallery("点击退出相册"));
defaultGalleryButton.addEventListener("click", () => openGallery(activeFolderKey));
newFolderButton.addEventListener("click", createFolder);
authButton.addEventListener("click", configureGithubToken);
cjUploadButton.addEventListener("click", () => cjUpload.click());
deletePhotoButton.addEventListener("click", deleteCurrentPhoto);
cameraRetryButton.addEventListener("click", () => setCameraPreviewCollapsed(false));
cameraCheckButton.addEventListener("click", () => setupHands({ force: true }));
galleryPrev.addEventListener("click", () => switchGalleryPhoto(-1));
galleryNext.addEventListener("click", () => switchGalleryPhoto(1));
cjUpload.addEventListener("change", handleCjUpload);
folderSelect.addEventListener("change", () => {
  if (folders[folderSelect.value]) openGallery(folderSelect.value);
});
sensitivityButton.addEventListener("click", () => setSensitivityPanelOpen(!sensitivityPanel.classList.contains("open")));
rotationSensitivityButton.addEventListener("click", () => setSensitivityMode("rotation"));
spreadSensitivityButton.addEventListener("click", () => setSensitivityMode("spread"));
sensitivityControl.addEventListener("input", () => {
  const value = Number(sensitivityControl.value);
  if (sensitivityMode === "rotation") {
    rotationSensitivity = value;
    localStorage.setItem(ROTATION_SENSITIVITY_KEY, String(value));
  } else {
    spreadSensitivity = value;
    localStorage.setItem(SPREAD_SENSITIVITY_KEY, String(value));
    targetSpread = THREE.MathUtils.clamp(targetSpread, 0, getSpreadResponse());
  }
  updateSensitivityPanel();
});

window.addEventListener("keydown", (event) => {
  if (galleryState !== "open" && ["1", "2", "3"].includes(event.key)) {
    handleNumberAction(Number(event.key), `键盘 ${event.key}`);
    return;
  }
  if (event.key === "Escape" && activeFeature) {
    exitFeature("已退出功能。");
    return;
  }
  if (event.key === "Escape") closeGallery("键盘退出相册");
  if (event.key === "ArrowLeft" && galleryState === "open") switchGalleryPhoto(-1);
  if (event.key === "ArrowRight" && galleryState === "open") switchGalleryPhoto(1);
});

window.addEventListener("pointermove", (event) => {
  if (hasHands) return;
  if (activeFeature) return;
  targetSpread = Math.min(1, Math.max(0, event.clientX / window.innerWidth)) * getSpreadResponse();
  setStatusText(motionStatus, spreadLabel(targetSpread));
});

animate();
renderFolderControls();
loadRemoteFolders();
setupHands();
initStatusPanel();
initCameraPreviewPanel();

async function setupHands({ force = false } = {}) {
  if (!window.Hands) {
    setStatusText(cameraStatus, "组件未加载");
    showToast("手势组件没有加载成功，请确认网络可访问 jsDelivr。");
    return;
  }

  try {
    if (force) stopActiveCamera();
    setStatusText(cameraStatus, "请求授权");
    setStatusText(debugStatus, "请求中");

    const stream = await openCameraStream();
    activeStream = stream;
    video.srcObject = stream;
    await video.play();

    handsModel = handsModel ?? createHandsModel();
    handLoopRunning = true;
    pumpVideoToHands();
    setStatusText(cameraStatus, "已开启");
    const devices = await listCameraDevices();
    const trackLabel = stream.getVideoTracks()[0]?.label;
    const name = trackLabel || devices[0]?.label || "摄像头";
    setStatusText(debugStatus, `设备 ${devices.length || 1}`);
    showToast(`摄像头已连接：${name}。普通模式手势 1 / 2 / 3 切文字；相册内请使用左右箭头切图。`);
  } catch (error) {
    setStatusText(cameraStatus, readableCameraError(error).title);
    setStatusText(gestureStatus, "手动演示");
    setStatusText(debugStatus, error?.name || "未知错误");
    showToast(readableCameraError(error).message);
    console.warn(error);
  }
}

function initStatusPanel() {
  const collapsed = localStorage.getItem(STATUS_COLLAPSED_KEY) === "true";
  setStatusPanelCollapsed(collapsed);
  statusToggle.addEventListener("click", () => {
    setStatusPanelCollapsed(!statusPanel.classList.contains("collapsed"));
  });
}

function setStatusPanelCollapsed(collapsed) {
  statusPanel.classList.toggle("collapsed", collapsed);
  statusToggle.textContent = collapsed ? "状态" : "收起";
  statusToggle.setAttribute("aria-expanded", String(!collapsed));
  statusToggle.setAttribute("aria-label", collapsed ? "展开状态栏" : "收起状态栏");
  localStorage.setItem(STATUS_COLLAPSED_KEY, String(collapsed));
}

function initCameraPreviewPanel() {
  const collapsed = localStorage.getItem(CAMERA_PREVIEW_COLLAPSED_KEY) !== "false";
  setCameraPreviewCollapsed(collapsed);
  cameraPreviewToggle.addEventListener("click", () => {
    setCameraPreviewCollapsed(true);
  });
}

function setCameraPreviewCollapsed(collapsed) {
  cameraPreview.classList.toggle("collapsed", collapsed);
  cameraPreview.setAttribute("aria-hidden", String(collapsed));
  cameraPreviewToggle.textContent = "收起";
  cameraPreviewToggle.setAttribute("aria-expanded", String(!collapsed));
  cameraPreviewToggle.setAttribute("aria-label", "收起摄像头画面");
  cameraRetryButton.classList.toggle("active", !collapsed);
  localStorage.setItem(CAMERA_PREVIEW_COLLAPSED_KEY, String(collapsed ? "true" : "false"));
}

function createHandsModel() {
  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.66,
    minTrackingConfidence: 0.62,
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

  const now = performance.now();
  if (now - lastHandFrameAt < HAND_FRAME_INTERVAL) {
    if (handLoopRunning) requestAnimationFrame(pumpVideoToHands);
    return;
  }
  lastHandFrameAt = now;

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
      message: "Edge 没有获得摄像头权限。请点地址栏左侧的权限图标，允许摄像头后打开摄像头面板点“检查”重试。",
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
      message: "摄像头可能正被微信、会议软件或另一个浏览器标签占用。关闭占用后打开摄像头面板点“检查”重试。",
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
      setStatusText(gestureStatus, galleryState === "open" ? "相册模式" : "等待手势");
      setStatusText(cameraStatus, "已开启");
    }
    if (!isTextViewLocked()) {
      targetHandRotationY *= 0.94;
      targetHandRotationX *= 0.94;
    }
    return;
  }

  lastGestureAt = performance.now();
  const fingerCounts = hands.map(countExtendedFingers);
  const rawHandSpread = computeTwoHandSpread(hands);
  const rawOpenness = hands.reduce((sum, hand) => sum + computeHandOpenness(hand), 0) / hands.length;
  if (isTextViewLocked()) resetViewRotation();
  else updateHandRotation(hands);
  const handSpread = dampGestureValue(rawHandSpread, "spread", 0.04);
  const openness = dampGestureValue(rawOpenness, "openness", 0.035);
  const rawPrimaryCount = [5, 4, 3, 2, 1].find((count) => fingerCounts.includes(count)) ?? fingerCounts[0];
  const primaryCount = smoothFingerCount(rawPrimaryCount);

  if (galleryState === "open") {
    updateGalleryMotion(handSpread, openness);
    return;
  }

  if (activeFeature) {
    setStatusText(gestureStatus, `功能 ${FEATURE_LABELS[activeFeature]}`);
    targetSpread = softenSpread(Math.max(handSpread, openness * 0.72));
    targetSpread = THREE.MathUtils.clamp(targetSpread, 0, 1);
    setStatusText(motionStatus, spreadLabel(targetSpread));
    return;
  }

  if (primaryCount >= 1 && primaryCount <= 3) {
    setActiveShape(shapeKeyFromNumber(primaryCount));
  } else {
    setStatusText(gestureStatus, `${Math.min(2, hands.length)} 手 / ${primaryCount} 指`);
  }

  const textGestureActive = primaryCount >= 1 && primaryCount <= 3;
  if (textGestureActive && isTextViewLocked()) {
    targetSpread = 0;
  } else {
    targetSpread = softenSpread(Math.max(handSpread, openness * 0.72));
  }
  if (textGestureActive && !isTextViewLocked()) {
    targetSpread = handSpread > 0.34 ? THREE.MathUtils.smoothstep(handSpread, 0.34, 0.92) * getSpreadResponse() : 0;
  }
  targetSpread = THREE.MathUtils.clamp(targetSpread, 0, 1);
  setStatusText(motionStatus, spreadLabel(targetSpread));
}

function countExtendedFingers(landmarks) {
  const palmSize = distance2D(landmarks[0], landmarks[9]) || 0.1;
  const fingers = [
    [5, 6, 8],
    [9, 10, 12],
    [13, 14, 16],
    [17, 18, 20],
  ];
  const palmCenter = averagePoint([landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]);
  let longFingerCount = 0;

  for (const [mcpIndex, pipIndex, tipIndex] of fingers) {
    const mcp = landmarks[mcpIndex];
    const pip = landmarks[pipIndex];
    const tip = landmarks[tipIndex];
    const tipFromWrist = distance2D(tip, landmarks[0]);
    const pipFromWrist = distance2D(pip, landmarks[0]);
    const straightness = jointCosine(mcp, pip, tip);
    const pointsUp = tip.y < pip.y - palmSize * 0.08;
    const reachesOut = tipFromWrist > pipFromWrist + palmSize * 0.14;
    const clearLength = distance2D(tip, mcp) > distance2D(pip, mcp) * 1.28;
    if ((reachesOut && straightness < -0.18) || (pointsUp && clearLength)) longFingerCount += 1;
  }

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const thumbStraightness = jointCosine(thumbMcp, thumbIp, thumbTip);
  const thumbLength = distance2D(thumbTip, thumbMcp);
  const thumbAwayFromPalm = distance2D(thumbTip, palmCenter) > distance2D(thumbIp, palmCenter) + palmSize * 0.04;
  const thumbAwayFromIndex = distance2D(thumbTip, landmarks[5]) > palmSize * 0.55;
  const thumbSideways = Math.abs(thumbTip.x - thumbIp.x) > palmSize * 0.12;
  const thumbExtended = thumbLength > palmSize * 0.58
    && thumbStraightness < 0.18
    && (thumbAwayFromPalm || thumbAwayFromIndex || thumbSideways);

  if (longFingerCount === 4 && (thumbExtended || computeHandOpenness(landmarks) > 0.62)) return 5;
  return longFingerCount + (thumbExtended ? 1 : 0);
}

function smoothFingerCount(rawCount) {
  const now = performance.now();
  if (rawCount === 5) lastFiveFingerAt = now;
  if (stableFingerCount === 5 && rawCount >= 3 && now - lastFiveFingerAt < 360) return 5;
  if (rawCount === stableFingerCount) {
    pendingFingerCount = rawCount;
    pendingFingerCountAt = now;
    return stableFingerCount;
  }

  if (rawCount !== pendingFingerCount) {
    pendingFingerCount = rawCount;
    pendingFingerCountAt = now;
  }

  const delay = rawCount === 5 ? 60 : 110;
  if (!stableFingerCount || now - pendingFingerCountAt > delay) {
    stableFingerCount = rawCount;
  }
  return stableFingerCount || rawCount;
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

function dampGestureValue(value, channel, deadZone = 0.035) {
  const currentValue = channel === "openness" ? smoothedHandOpenness : smoothedHandSpread;
  const next = Math.abs(value - currentValue) < deadZone
    ? currentValue
    : currentValue + (value - currentValue) * getGestureDamping(channel);
  const clamped = THREE.MathUtils.clamp(next, 0, 1);
  if (channel === "openness") smoothedHandOpenness = clamped;
  else smoothedHandSpread = clamped;
  return clamped;
}

function softenSpread(value) {
  return THREE.MathUtils.smoothstep(value, 0.12, 0.96) * getSpreadResponse();
}

function getSpreadResponse() {
  return THREE.MathUtils.lerp(0.34, 1, spreadSensitivity / 100);
}

function getRotationLimit() {
  return THREE.MathUtils.lerp(0.36, 1.72, rotationSensitivity / 100);
}

function getGestureDamping(channel) {
  const value = channel === "openness" ? spreadSensitivity : rotationSensitivity;
  return THREE.MathUtils.lerp(0.1, 0.28, value / 100);
}

function updateHandRotation(hands) {
  const points = hands.flat();
  if (!points.length) return;
  const center = averagePoint(points);
  const rawX = THREE.MathUtils.clamp((center.x - 0.5) / 0.42, -1, 1);
  const rawY = THREE.MathUtils.clamp((center.y - 0.52) / 0.38, -1, 1);
  const deadX = Math.abs(rawX) < 0.11 ? 0 : rawX;
  const deadY = Math.abs(rawY) < 0.13 ? 0 : rawY;
  targetHandRotationY = -deadX * getRotationLimit();
  targetHandRotationX = -deadY * getRotationLimit() * 0.42;
}

function resetViewRotation() {
  targetHandRotationY = 0;
  targetHandRotationX = 0;
}

function isTextViewLocked() {
  return galleryState !== "open" && !activeFeature && !!lockedTextShape;
}

function animate() {
  requestAnimationFrame(animate);
  frameIndex += 1;

  const elapsed = (performance.now() - clockStart) / 1000;
  const gestureRecentlySeen = performance.now() - lastGestureAt < 1200;
  const textGestureRecentlySeen = performance.now() - lastTextGestureAt < 1600;
  rotationBlend += ((gestureRecentlySeen || galleryState === "open" ? 0 : 1) - rotationBlend) * 0.075;
  textViewLockBlend += ((isTextViewLocked() ? 1 : 0) - textViewLockBlend) * 0.16;
  const expanding = targetSpread > 0.18;
  const stableTarget = galleryState === "open" ? 0.58 : activeFeature && !expanding ? 0.92 : textGestureRecentlySeen && !expanding ? 1 : 0;
  stableTextBlend += (stableTarget - stableTextBlend) * 0.14;
  smoothedSpread += (targetSpread - smoothedSpread) * (expanding ? 0.105 : 0.07);
  smoothedHandRotationY += (targetHandRotationY - smoothedHandRotationY) * (isTextViewLocked() ? 0.16 : 0.08);
  smoothedHandRotationX += (targetHandRotationX - smoothedHandRotationX) * (isTextViewLocked() ? 0.16 : 0.08);
  const stillness = stableTextBlend;
  const breath = Math.sin(elapsed * 1.4) * 0.05 * (1 - stillness);
  const rawSpread = smoothedSpread + breath;
  const visualSpread = Math.max(0, rawSpread * (1 - stillness * 0.72));
  const burst = THREE.MathUtils.smoothstep(visualSpread, 0.04, 0.9);
  const twist = visualSpread * THREE.MathUtils.lerp(0.45, 1.15, burst) * (1 - stillness);
  const targetScale = 1 + visualSpread * THREE.MathUtils.lerp(1.15, 2.8, burst);
  const pull = THREE.MathUtils.lerp(0.022, 0.105, stillness);
  const damping = THREE.MathUtils.lerp(0.74, 0.36, stillness);
  const updateColors = frameIndex % COLOR_UPDATE_STRIDE === 0;
  const colorMix = updateColors ? 0.12 : 0;
  const lockedText = isTextViewLocked();

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const sx = activeTargets[offset];
    const sy = activeTargets[offset + 1];
    const sz = activeTargets[offset + 2];
    const isTextFloat = lockedText && i >= TEXT_CORE_PARTICLES;
    const floatMotion = isTextFloat ? 1 : 0;
    const wave = Math.sin(elapsed * 1.9 + i * 0.019) * (isTextFloat ? 0.26 : 0.22 * burst);
    const drift = isTextFloat ? 0.42 : visualSpread;
    const rx = scatterTargets[offset] * drift * (isTextFloat ? 0.2 : 2.75) + wave;
    const ry = scatterTargets[offset + 1] * drift * (isTextFloat ? 0.16 : 2.05) + Math.cos(elapsed * 1.43 + i * 0.013) * (isTextFloat ? 0.22 : 0.16 * burst);
    const rz = scatterTargets[offset + 2] * drift * (isTextFloat ? 0.28 : 3.35);

    const angle = lockedText ? 0 : twist * sy + elapsed * 0.05 * (1 - stillness);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = lockedText ? 1 : targetScale;
    const tx = (sx * scale + rx * (lockedText ? floatMotion : 1)) * cos - (sz + rz * (lockedText ? floatMotion : 1)) * sin;
    const ty = sy * scale + ry * (lockedText ? floatMotion : 1);
    const tz = (sx * scale + rx * (lockedText ? floatMotion : 1)) * sin + (sz + rz * (lockedText ? floatMotion : 1)) * cos;
    const localPull = lockedText && !isTextFloat ? 0.14 : pull;
    const localDamping = lockedText && !isTextFloat ? 0.28 : damping;

    velocity[offset] = (velocity[offset] + (tx - current[offset]) * localPull) * localDamping;
    velocity[offset + 1] = (velocity[offset + 1] + (ty - current[offset + 1]) * localPull) * localDamping;
    velocity[offset + 2] = (velocity[offset + 2] + (tz - current[offset + 2]) * localPull) * localDamping;
    current[offset] += velocity[offset];
    current[offset + 1] += velocity[offset + 1];
    current[offset + 2] += velocity[offset + 2];

    positionArray[offset] = current[offset];
    positionArray[offset + 1] = current[offset + 1];
    positionArray[offset + 2] = current[offset + 2];

    if (updateColors) {
      getDefaultParticleColor(i, elapsed, reusableParticleColor);
      colorArray[offset] += (reusableParticleColor.r - colorArray[offset]) * colorMix;
      colorArray[offset + 1] += (reusableParticleColor.g - colorArray[offset + 1]) * colorMix;
      colorArray[offset + 2] += (reusableParticleColor.b - colorArray[offset + 2]) * colorMix;
    }
  }

  geometry.attributes.position.needsUpdate = true;
  if (updateColors) geometry.attributes.color.needsUpdate = true;
  const unlockedView = 1 - textViewLockBlend;
  group.rotation.y = (Math.sin(elapsed * 0.32) * 0.12 * rotationBlend * (1 - stableTextBlend) + smoothedHandRotationY) * unlockedView;
  group.rotation.x = (Math.sin(elapsed * 0.23) * 0.045 * rotationBlend * (1 - stableTextBlend) + smoothedHandRotationX) * unlockedView;
  renderer.render(scene, camera);
}

function makeTextTargets(text, options = {}) {
  const floatRatio = options.floatRatio ?? 0.26;
  const textCanvas = document.createElement("canvas");
  const width = options.width ?? 1380;
  const height = options.height ?? 430;
  const scaleX = options.scaleX ?? 15.4;
  const scaleY = options.scaleY ?? 5.05;
  const yOffset = options.yOffset ?? 0;
  const zRange = options.zRange ?? 0.22;
  textCanvas.width = width;
  textCanvas.height = height;
  const ctx = textCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = options.fontSize ?? (text.length > 9 ? 166 : text.length > 5 ? 198 : 258);
  ctx.font = `900 ${fontSize}px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif`;
  while (ctx.measureText(text).width > width * 0.94 && fontSize > 64) {
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
  const textParticleCount = Math.max(0, Math.floor(PARTICLE_COUNT * (text ? 1 - floatRatio : 0)));
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    if (i < textParticleCount) {
      const source = points[i % points.length];
      targets[offset] = source[0] + rand(-0.018, 0.018);
      targets[offset + 1] = source[1] + rand(-0.018, 0.018);
      targets[offset + 2] = source[2];
    } else {
      const halo = makeTextFloatPoint(scaleX, scaleY, yOffset);
      targets[offset] = halo[0];
      targets[offset + 1] = halo[1];
      targets[offset + 2] = halo[2];
    }
  }
  return targets;
}

function makeTextFloatPoint(scaleX, scaleY, yOffset) {
  const clusterCenters = [
    [-0.62, 0.34],
    [-0.38, -0.62],
    [0.08, 0.72],
    [0.42, -0.48],
    [0.68, 0.2],
  ];
  const center = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.pow(Math.random(), 0.42) * rand(0.16, 0.58);
  const spiral = Math.sin(radius * 8 + center[0] * 3) * 0.1;
  const stretchX = rand(0.72, 1.45);
  const stretchY = rand(0.55, 1.28);
  const x = (center[0] + Math.cos(angle + spiral) * radius * stretchX + rand(-0.08, 0.08)) * scaleX;
  const y = yOffset + (center[1] + Math.sin(angle) * radius * stretchY + rand(-0.08, 0.08)) * scaleY;
  return [
    x,
    y,
    rand(-1.15, 1.15),
  ];
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

function makeFilledHeartTargets() {
  return makeParametricHeartTargets({
    scale: 0.34,
    yOffset: -0.52,
    zRange: 1.08,
    jitter: 0.045,
  });
}

function makeParametricHeartTargets(options = {}) {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  const scale = options.scale ?? 0.34;
  const yOffset = options.yOffset ?? -0.48;
  const zRange = options.zRange ?? 0.95;
  const jitter = options.jitter ?? 0.04;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const t = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    const outlineX = 16 * Math.sin(t) ** 3;
    const outlineY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    targets[offset] = outlineX * radius * scale + rand(-jitter, jitter);
    targets[offset + 1] = outlineY * radius * scale + yOffset + rand(-jitter, jitter);
    targets[offset + 2] = rand(-zRange, zRange);
  }
  return targets;
}

function makeParametricHeartPoint(scale = 0.34, yOffset = -0.48) {
  const t = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random());
  const outlineX = 16 * Math.sin(t) ** 3;
  const outlineY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [
    outlineX * radius * scale,
    outlineY * radius * scale + yOffset,
  ];
}

function loadFeatureImageTargets() {
  loadImageTargets(FEATURE_IMAGES.tomorrow, {
    invert: true,
    threshold: 132,
    scaleX: 7.35,
    scaleY: 6.6,
    yOffset: -0.06,
    zRange: 0.58,
    floatRatio: 0.08,
  }).then((targets) => {
    featureTargets.tomorrow = targets;
    if (activeFeature === "tomorrow") activeTargets = targets;
  }).catch((error) => console.warn(error));

  loadImageTargets(FEATURE_IMAGES.dragon, {
    preferPink: true,
    threshold: 64,
    scaleX: 7.45,
    scaleY: 6.05,
    yOffset: -0.12,
    zRange: 0.62,
    floatRatio: 0.08,
  }).then((targets) => {
    featureTargets.dragon = targets;
    if (activeFeature === "dragon") activeTargets = targets;
  }).catch((error) => console.warn(error));
}

function loadImageTargets(src, options = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(makeImageTargets(image, options));
    image.onerror = reject;
    image.src = src;
  });
}

function makeImageTargets(image, options = {}) {
  const width = options.width ?? 460;
  const height = options.height ?? 460;
  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = width;
  imageCanvas.height = height;
  const ctx = imageCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  const data = ctx.getImageData(0, 0, width, height).data;
  const points = [];
  const step = options.step ?? 2;
  const threshold = options.threshold ?? 118;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha < 24) continue;
      const brightness = (r + g + b) / 3;
      const pinkScore = r - Math.max(g, b) * 0.58 + Math.max(0, b - g) * 0.22;
      const chosen = options.preferPink ? pinkScore > threshold : options.invert ? brightness < threshold : brightness > threshold;
      if (!chosen) continue;
      points.push([
        (x / width - 0.5) * (options.scaleX ?? 7),
        (0.5 - y / height) * (options.scaleY ?? 6) + (options.yOffset ?? 0),
      ]);
    }
  }

  if (!points.length) return makeImagePlaceholderTargets();
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  const shapedCount = Math.floor(PARTICLE_COUNT * (1 - (options.floatRatio ?? 0.08)));
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    if (i < shapedCount) {
      const point = points[i % points.length];
      targets[offset] = point[0] + rand(-0.025, 0.025);
      targets[offset + 1] = point[1] + rand(-0.025, 0.025);
      targets[offset + 2] = rand(-(options.zRange ?? 0.56), options.zRange ?? 0.56);
    } else {
      const halo = makeTextFloatPoint(0.75, 0.62, 0);
      targets[offset] = halo[0];
      targets[offset + 1] = halo[1];
      targets[offset + 2] = halo[2];
    }
  }
  return targets;
}

function makeImagePlaceholderTargets() {
  return makeFilled2DTargets((x, y) => {
    const star = capsuleDistance(x, y, 0, -2.3, 0, 2.3) < 0.22
      || capsuleDistance(x, y, -2.2, -1.45, 2.2, 1.45) < 0.22
      || capsuleDistance(x, y, -2.2, 1.45, 2.2, -1.45) < 0.22;
    const core = ellipseContains(x, y, 0, 0, 0.7, 1.15);
    return star || core;
  }, {
    scale: 1.25,
    zRange: 0.6,
    jitter: 0.04,
  });
}

function makeFilledLightningTargets() {
  const bolt = [
    [-0.34, 1.16],
    [0.45, 1.16],
    [0.1, 0.23],
    [0.58, 0.23],
    [-0.34, -1.28],
    [-0.08, -0.36],
    [-0.56, -0.36],
  ];
  return makePolygonTargets(bolt, {
    scaleX: 6.35,
    scaleY: 3.65,
    zRange: 0.78,
    jitter: 0.038,
  });
}

function makeCrystalHeartTargets() {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  const lightning = [
    [-0.18, 0.88],
    [0.34, 0.88],
    [0.06, 0.16],
    [0.42, 0.16],
    [-0.28, -0.86],
    [-0.04, -0.22],
    [-0.42, -0.22],
  ];

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 220; attempt += 1) {
      const point = makeParametricHeartPoint(0.31, -0.5);
      x = point[0];
      y = point[1];
      const lx = x / 3.9;
      const ly = y / 2.7;
      if (pointInPolygon(lx, ly, lightning) && i % 4 !== 0) continue;
      break;
    }

    const block = 0.26;
    const facetedX = Math.round(x / block) * block + rand(-0.07, 0.07);
    const facetedY = Math.round(y / block) * block + rand(-0.07, 0.07);
    const ridge = Math.abs(facetedX) * 0.12 + Math.max(0, 1.7 - Math.abs(facetedY)) * 0.06;
    targets[offset] = facetedX;
    targets[offset + 1] = facetedY;
    targets[offset + 2] = rand(-0.84, 0.84) + ridge;
  }
  return targets;
}

function makeSphereTargets() {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const shell = i > PARTICLE_COUNT * 0.72;
    const radius = shell ? rand(4.65, 4.9) : Math.cbrt(Math.random()) * 2.58;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(rand(-1, 1));
    targets[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    targets[offset + 1] = Math.cos(phi) * radius;
    targets[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  return targets;
}

function makeFilled2DTargets(test, options = {}) {
  const targets = new Float32Array(PARTICLE_COUNT * 3);
  const scale = options.scale ?? 1;
  const zRange = options.zRange ?? 0.7;
  const jitter = options.jitter ?? 0.035;
  const minX = options.minX ?? -3.6;
  const maxX = options.maxX ?? 3.6;
  const minY = options.minY ?? -2.8;
  const maxY = options.maxY ?? 2.8;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    let x = 0;
    let y = 0;
    let hit = false;
    for (let attempt = 0; attempt < 260; attempt += 1) {
      x = rand(minX, maxX);
      y = rand(minY, maxY);
      if (test(x, y)) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      x = rand(-0.5, 0.5);
      y = rand(-0.5, 0.5);
    }
    targets[offset] = x * scale + rand(-jitter, jitter);
    targets[offset + 1] = y * scale + rand(-jitter, jitter);
    targets[offset + 2] = rand(-zRange, zRange);
  }
  return targets;
}

function makePolygonTargets(points, options = {}) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const targets = makeFilled2DTargets((x, y) => pointInPolygon(x, y, points), {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    scale: 1,
    zRange: options.zRange,
    jitter: options.jitter,
  });
  const scaleX = options.scaleX ?? 1;
  const scaleY = options.scaleY ?? 1;
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    targets[offset] *= scaleX;
    targets[offset + 1] *= scaleY;
  }
  return targets;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / (yj - yi || 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ellipseContains(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

function capsuleDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby || 1;
  const t = THREE.MathUtils.clamp((apx * abx + apy * aby) / len2, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  return Math.hypot(px - x, py - y);
}

function getDefaultParticleColor(i, elapsed = 0, target = reusableParticleColor) {
  const tone = i / PARTICLE_COUNT;
  const shimmer = (Math.sin(elapsed * 1.8 + i * 0.017) + 1) * 0.5;
  const baseHue = THEME_PRESETS[activeTheme]?.[5] ?? THEME_PRESETS.pink[5];
  const hue = (baseHue + THREE.MathUtils.lerp(-0.04, 0.04, (tone * 1.7 + shimmer * 0.24) % 1) + 1) % 1;
  const saturation = THREE.MathUtils.lerp(0.74, 0.98, shimmer);
  const lightness = THREE.MathUtils.lerp(0.58, 0.76, Math.sin(tone * Math.PI * 6) * 0.5 + 0.5);
  return target.setHSL(hue, saturation, lightness);
}

function setDefaultParticleColor(i, offset) {
  getDefaultParticleColor(i, 0, reusableParticleColor);
  colorArray[offset] = reusableParticleColor.r;
  colorArray[offset + 1] = reusableParticleColor.g;
  colorArray[offset + 2] = reusableParticleColor.b;
}

function setSensitivityPanelOpen(open) {
  if (open) setFeaturePanelOpen(false, { preserveActive: true });
  sensitivityPanel.classList.toggle("open", open);
  sensitivityPanel.setAttribute("aria-hidden", String(!open));
  sensitivityButton.classList.toggle("active", open);
}

function setSensitivityMode(mode) {
  sensitivityMode = mode;
  updateSensitivityPanel();
}

function updateSensitivityPanel() {
  const isRotation = sensitivityMode === "rotation";
  const value = isRotation ? rotationSensitivity : spreadSensitivity;
  rotationSensitivityButton.classList.toggle("active", isRotation);
  spreadSensitivityButton.classList.toggle("active", !isRotation);
  sensitivityLabel.textContent = isRotation ? "旋转灵敏度" : "扩散灵敏度";
  sensitivityControl.value = String(value);
  sensitivityValue.textContent = String(value);
}

function applyTheme(name, persist = false) {
  const themeName = THEME_PRESETS[name] ? name : "pink";
  const [main, rose, deep, soft, background] = THEME_PRESETS[themeName];
  activeTheme = themeName;
  document.documentElement.style.setProperty("--pink", main);
  document.documentElement.style.setProperty("--rose", rose);
  document.documentElement.style.setProperty("--deep", deep);
  document.documentElement.style.setProperty("--soft", soft);
  document.documentElement.style.setProperty("--theme-button", toAlpha(main, 0.12));
  document.documentElement.style.setProperty("--theme-button-active", toAlpha(main, 0.24));
  document.documentElement.style.setProperty("--theme-border", toAlpha(rose, 0.78));
  document.documentElement.style.setProperty("--theme-glow", toAlpha(main, 0.18));
  document.documentElement.style.setProperty("--theme-background", background);
  renderer.setClearColor(new THREE.Color(background), 1);
  scene.fog.color.set(background);
  colorPalette.querySelectorAll("[data-theme-color]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeColor === themeName);
  });
  if (persist) {
    localStorage.setItem(THEME_COLOR_KEY, themeName);
    showToast(`已切换为${themeColorName(themeName)}。`);
  }
}

function themeColorName(name) {
  return { blue: "蓝色", green: "绿色", red: "红色", yellow: "黄色", purple: "紫色", pink: "粉色" }[name] ?? "粉色";
}

function toAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadStoredNumber(key, fallback) {
  const stored = localStorage.getItem(key);
  if (stored === null || stored === "") return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 100) : fallback;
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
  if (activeFeature) exitFeature();
  if (galleryState === "open") {
    showToast("相册图片已取消手势和数字切换，请使用左右箭头。");
    return;
  }

  if (number >= 1 && number <= 3) {
    const shape = shapeKeyFromNumber(number);
    setActiveShape(shape, `${messagePrefix}：${TEXTS[shape]}`);
  } else {
    showToast("普通模式下手势 1/2/3 切文字。");
  }
}

function shapeKeyFromNumber(number) {
  return ["one", "two", "three"][number - 1] ?? "one";
}

function setActiveShape(shape, message) {
  if (galleryState === "open") return;
  const shapeChanged = activeShape !== shape || activeFeature;
  activeFeature = null;
  setFeaturePanelOpen(false);
  galleryState = "closed";
  activeShape = shape;
  lockedTextShape = shape;
  if (shapeChanged) resetViewRotation();
  activeTargets = shapeTargets[shape];
  if (shapeChanged) lastTextGestureAt = performance.now();
  textOneButton.classList.toggle("active", shape === "one");
  textTwoButton.classList.toggle("active", shape === "two");
  numberThreeButton.classList.toggle("active", shape === "three");
  featureButton.classList.remove("active");
  updateFeatureButtonState();
  exitGalleryButton.classList.remove("active");
  defaultGalleryButton.classList.remove("active");
  newFolderButton.classList.remove("active");
  authButton.classList.toggle("active", hasGithubToken());
  deletePhotoButton.classList.remove("active");
  setStatusText(gestureStatus, `手势 ${numberFromShapeKey(shape)}`);
  if (message) showToast(message);
}

function setFeaturePanelOpen(open, options = {}) {
  if (open) setSensitivityPanelOpen(false);
  if (!open) {
    colorPalette.hidden = true;
    colorButton.classList.remove("active");
  }
  featurePanel.classList.toggle("open", open);
  featurePanel.setAttribute("aria-hidden", String(!open));
  featureButton.classList.toggle("active", open || (!!activeFeature && options.preserveActive !== false));
}

function setFeatureShape(shape) {
  if (!featureTargets[shape]) return;
  if (galleryState === "open") closeGallery();
  activeFeature = shape;
  lockedTextShape = null;
  activeTargets = featureTargets[shape];
  targetSpread = 0;
  smoothedSpread = Math.min(smoothedSpread, 0.18);
  lastTextGestureAt = performance.now();
  textOneButton.classList.remove("active");
  textTwoButton.classList.remove("active");
  numberThreeButton.classList.remove("active");
  defaultGalleryButton.classList.remove("active");
  exitGalleryButton.classList.remove("active");
  setFeaturePanelOpen(true);
  updateFeatureButtonState();
  setStatusText(gestureStatus, `功能 ${FEATURE_LABELS[shape]}`);
  setStatusText(motionStatus, "聚合");
  showToast(`已切换到${FEATURE_LABELS[shape]}。`);
}

function exitFeature(message) {
  if (!activeFeature) {
    setFeaturePanelOpen(false);
    return;
  }
  activeFeature = null;
  setFeaturePanelOpen(false);
  setActiveShape(activeShape || "one", message);
}

function updateFeatureButtonState() {
  featurePanel.querySelectorAll("[data-feature-shape]").forEach((button) => {
    button.classList.toggle("active", button.dataset.featureShape === activeFeature);
  });
}

function numberFromShapeKey(shape) {
  return { one: 1, two: 2, three: 3 }[shape] ?? 1;
}

function openGallery(folderKey = activeFolderKey) {
  activeFeature = null;
  lockedTextShape = null;
  setFeaturePanelOpen(false);
  updateFeatureButtonState();
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
  featureButton.classList.remove("active");
  exitGalleryButton.classList.add("active");
  defaultGalleryButton.classList.add("active");
  setStatusText(motionStatus, "相册");
  setStatusText(gestureStatus, "相册模式");
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
  setStatusText(motionStatus, "收缩");
  showToast(message);
}

function updateGalleryMotion(handSpread, openness) {
  setStatusText(gestureStatus, "相册模式");
  targetSpread = Math.max(0.18, softenSpread(Math.max(handSpread, openness * 0.62)));
  targetSpread = THREE.MathUtils.clamp(targetSpread, 0, 1);
  setStatusText(motionStatus, "相册");
}

function switchGalleryPhoto(direction) {
  const images = getActiveImages();
  if (!images.length) {
    showToast("当前相册还没有照片。");
    return;
  }
  galleryIndex = (galleryIndex + direction + images.length) % images.length;
  lastPhotoSwitchAt = performance.now();
  updateGalleryPhoto(direction);
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
  const previousIndex = galleryIndex;
  galleryIndex = index;
  lastPhotoSwitchAt = performance.now();
  updateGalleryPhoto(index > previousIndex ? 1 : -1);
  if (message) showToast(message);
}

function updateGalleryPhoto(direction = 0) {
  const folder = folders[activeFolderKey];
  const images = getActiveImages();
  const token = ++galleryPhotoToken;
  galleryTitle.textContent = folder.title;
  galleryFrame.classList.remove("from-prev", "from-next");
  galleryFrame.classList.add("switching");
  if (direction > 0) galleryFrame.classList.add("from-next");
  if (direction < 0) galleryFrame.classList.add("from-prev");

  if (!images.length) {
    window.setTimeout(() => {
      if (token !== galleryPhotoToken) return;
      galleryImage.removeAttribute("src");
      galleryImage.hidden = true;
      galleryEmpty.hidden = false;
      galleryEmpty.textContent = folder.title;
      galleryCounter.textContent = "0 / 0";
      activeTargets = makeAlbumTargets("0/0");
      updateNumberButtonState();
      galleryFrame.classList.remove("switching", "from-prev", "from-next");
    }, 140);
    return;
  }

  galleryIndex = THREE.MathUtils.clamp(galleryIndex, 0, images.length - 1);
  const src = images[galleryIndex];
  const nextImage = new Image();
  nextImage.onload = () => {
    if (token !== galleryPhotoToken) return;
    galleryImage.src = src;
    galleryImage.alt = `${folder.title}照片 ${galleryIndex + 1}`;
    galleryImage.hidden = false;
    galleryEmpty.hidden = true;
    galleryCounter.textContent = `${galleryIndex + 1} / ${images.length}`;
    activeTargets = makeAlbumTargets(`${galleryIndex + 1}/${images.length}`);
    updateNumberButtonState();
    galleryFrame.classList.remove("switching");
    window.setTimeout(() => galleryFrame.classList.remove("from-prev", "from-next"), 260);
    preloadNearbyGalleryImages(images, galleryIndex);
  };
  nextImage.onerror = () => {
    if (token !== galleryPhotoToken) return;
    galleryFrame.classList.remove("switching", "from-prev", "from-next");
    showToast("这张照片暂时加载失败，请切换下一张。");
  };
  nextImage.src = src;
}

function preloadNearbyGalleryImages(images, index) {
  if (images.length < 2) return;
  [index - 1, index + 1].forEach((rawIndex) => {
    const nextIndex = (rawIndex + images.length) % images.length;
    const image = new Image();
    image.src = images[nextIndex];
  });
}

function updateNumberButtonState() {
  const isOpen = galleryState === "open";
  textOneButton.classList.remove("active");
  textTwoButton.classList.remove("active");
  numberThreeButton.classList.remove("active");
  featureButton.classList.toggle("active", !!activeFeature);
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
    setStatusText(debugStatus, "上传处理中");
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
    setStatusText(debugStatus, `${folders[targetKey].title} ${folders[targetKey].images.length} 张`);
    showToast(`已上传 ${uploaded.length} 张照片到 ${folders[targetKey].title}，其他设备稍后刷新即可看到。`);
  } catch (error) {
    console.warn(error);
    setStatusText(debugStatus, "上传失败");
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
    setStatusText(debugStatus, "删除处理中");
    const repoPath = toRepoPath(photoUrl);
    images.splice(galleryIndex, 1);
    galleryIndex = Math.min(galleryIndex, Math.max(0, images.length - 1));

    if (repoPath && repoPath.startsWith(`assets/gallery/${activeFolderKey}/`)) {
      await deleteGithubFile(repoPath, `Delete ${folder.title} photo`, token);
    }
    await saveFoldersEverywhere(`Update ${folder.title} album after delete`, token);
    renderFolderControls();
    updateGalleryPhoto();
    setStatusText(debugStatus, `${folder.title} ${images.length} 张`);
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
    setStatusText(debugStatus, "相册已同步");
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
    const path = parsed.pathname.replace(/^\/(?:gesture-particle-demo|qingniancaijun)\//, "").replace(/^\//, "");
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

function averagePoint(points) {
  const sum = points.reduce((acc, point) => {
    acc.x += point.x;
    acc.y += point.y;
    return acc;
  }, { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function jointCosine(a, b, c) {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const length = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (!length) return 1;
  return (bax * bcx + bay * bcy) / length;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function setStatusText(element, value) {
  const text = String(value ?? "");
  if (element.textContent !== text) element.textContent = text;
}

let toastTimer = 0;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 4200);
}
