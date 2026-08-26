import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

import { OrbitControls } from
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

import { GLTFLoader } from
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";


let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let animationFrame = null;
let car = null;

let initialized = false;


function initShowroom3D() {

  const container = document.getElementById("car3d");

  if (!container) return;


  /*
   * Если сцена уже существует,
   * просто показываем её.
   */

  if (initialized) {

    resize();

    return;
  }


  initialized = true;


  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x070707);


  /*
   * КАМЕРА
   */

  camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth /
      Math.max(container.clientHeight, 1),
    0.1,
    100
  );

  camera.position.set(
    4.5,
    2.2,
    6.5
  );


  /*
   * RENDERER
   */

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.7)
  );

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  renderer.toneMappingExposure = 1.15;


  container.appendChild(
    renderer.domElement
  );


  /*
   * УПРАВЛЕНИЕ ПАЛЬЦЕМ
   */

  controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;

  controls.dampingFactor = 0.06;

  controls.enablePan = false;

  controls.rotateSpeed = 0.55;

  controls.zoomSpeed = 0.65;

  controls.minDistance = 3.5;

  controls.maxDistance = 9;

  controls.minPolarAngle = 0.65;

  controls.maxPolarAngle = 1.55;

  controls.target.set(
    0,
    0.9,
    0
  );


  /*
   * СВЕТ
   */

  const ambient =
    new THREE.HemisphereLight(
      0xffffff,
      0x111111,
      2.2
    );

  scene.add(ambient);


  const keyLight =
    new THREE.DirectionalLight(
      0xffffff,
      4.5
    );

  keyLight.position.set(
    5,
    7,
    6
  );

  scene.add(keyLight);


  const fillLight =
    new THREE.DirectionalLight(
      0xffffff,
      2.5
    );

  fillLight.position.set(
    -5,
    3,
    2
  );

  scene.add(fillLight);


  const rimLight =
    new THREE.DirectionalLight(
      0xffffff,
      4
    );

  rimLight.position.set(
    -3,
    5,
    -6
  );

  scene.add(rimLight);


  /*
   * ПОЛ
   */

  const floorGeometry =
    new THREE.CircleGeometry(
      8,
      64
    );

  const floorMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 0.72,
      metalness: 0.25
    });

  const floor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y = -0.02;

  scene.add(floor);


  /*
   * ЗАГРУЗКА GLB
   */

  const loader =
    new GLTFLoader();


  loader.load(

    "/models/g63-brabus.glb",

    (gltf) => {

      car = gltf.scene;

      /*
       * На случай, если модель
       * слишком большая/маленькая.
       */

      normalizeModel(car);


      scene.add(car);


      /*
       * Скрываем загрузчик.
       */

      const loading =
        document.getElementById(
          "car3dLoading"
        );

      if (loading) {
        loading.style.opacity = "0";

        setTimeout(() => {
          loading.remove();
        }, 400);
      }


      /*
       * Начальная камера.
       */

      controls.target.set(
        0,
        0.9,
        0
      );

      controls.update();

    },

    (progress) => {

      if (
        progress.total > 0
      ) {

        const percent =
          Math.round(
            progress.loaded /
            progress.total *
            100
          );

        const loading =
          document.querySelector(
            "#car3dLoading span"
          );

        if (loading) {
          loading.textContent =
            `Загрузка автомобиля... ${percent}%`;
        }

      }

    },

    (error) => {

      console.error(
        "Heavy Motors 3D error:",
        error
      );


      const loading =
        document.getElementById(
          "car3dLoading"
        );

      if (loading) {

        loading.innerHTML = `
          <strong>Не удалось загрузить автомобиль</strong>
          <small>Проверьте файл g63-brabus.glb</small>
        `;

      }

    }

  );


  /*
   * RESIZE
   */

  window.addEventListener(
    "resize",
    resize
  );


  /*
   * ANIMATION
   */

  animate();

}


function normalizeModel(model) {

  /*
   * Получаем размеры модели.
   */

  const box =
    new THREE.Box3()
      .setFromObject(model);

  const size =
    new THREE.Vector3();

  const center =
    new THREE.Vector3();

  box.getSize(size);

  box.getCenter(center);


  /*
   * Центрируем автомобиль.
   */

  model.position.x -= center.x;

  model.position.z -= center.z;


  /*
   * Масштабируем модель
   * до нормального размера.
   */

  const maxSize =
    Math.max(
      size.x,
      size.y,
      size.z
    );


  if (maxSize > 0) {

    const targetSize = 4.8;

    const scale =
      targetSize / maxSize;

    model.scale.setScalar(
      scale
    );

  }


  /*
   * После масштабирования
   * ставим автомобиль на пол.
   */

  const box2 =
    new THREE.Box3()
      .setFromObject(model);

  const minY =
    box2.min.y;

  model.position.y -= minY;


  /*
   * Улучшаем материалы.
   */

  model.traverse(
    (object) => {

      if (
        object.isMesh
      ) {

        object.castShadow = true;

        object.receiveShadow = true;


        if (
          object.material
        ) {

          object.material.needsUpdate =
            true;

        }

      }

    }
  );

}


function resize() {

  if (
    !renderer ||
    !camera
  ) {
    return;
  }


  const container =
    document.getElementById(
      "car3d"
    );

  if (!container) {
    return;
  }


  const width =
    container.clientWidth;

  const height =
    Math.max(
      container.clientHeight,
      1
    );


  camera.aspect =
    width / height;

  camera.updateProjectionMatrix();


  renderer.setSize(
    width,
    height,
    false
  );

}


function animate() {

  animationFrame =
    requestAnimationFrame(
      animate
    );


  if (controls) {
    controls.update();
  }


  if (
    renderer &&
    scene &&
    camera
  ) {

    renderer.render(
      scene,
      camera
    );

  }

}


/*
 * Публичная функция.
 * Её будет вызывать app.js.
 */

window.HeavyShowroom3D = {

  open() {

    initShowroom3D();

    setTimeout(
      resize,
      50
    );

  },

  resize() {

    resize();

  }

};
