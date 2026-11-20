import '../style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
grist.ready({
  requiredAccess: 'read table'
});


grist.ready({
  requiredAccess: 'read table'
});

grist.onRecord(async (record) => {
  const statusElement = document.querySelector('#status');
  const attachmentValue = record.PIECE_JOINTE;

  if (!attachmentValue) {
    statusElement.textContent = 'Aucune pièce jointe sur cette ligne.';
    return;
  }

  let attachmentId = Array.isArray(attachmentValue)
    ? (attachmentValue[0] === 'L' ? attachmentValue[1] : attachmentValue[0])
    : attachmentValue;

  statusElement.textContent = 'Récupération du fichier...';

  try {
    const tokenInfo = await grist.docApi.getAccessToken({
      readOnly: true
    });

    const url = `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${encodeURIComponent(tokenInfo.token)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const file = await response.blob();

    statusElement.textContent =
      `Fichier récupéré ✓ (${file.size} octets)`;

  } catch (error) {
    console.error(error);
    statusElement.textContent =
      `Erreur de récupération : ${error.message}`;
  }
});

const container = document.querySelector('#viewer');

container.innerHTML = `
  <div class="toolbar">
    <label for="fileInput">Ouvrir un modèle 3D (.glb / .gltf)</label>
    <input type="file" id="fileInput" accept=".glb,.gltf" />
  </div>
  <div id="canvas-container"></div>
  <p id="status">En attente d'un modèle 3D…</p>
`;

const canvasContainer = document.querySelector('#canvas-container');
const status = document.querySelector('#status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

const camera = new THREE.PerspectiveCamera(
  45,
  canvasContainer.clientWidth / 600,
  0.1,
  1000
);
camera.position.set(4, 3, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(canvasContainer.clientWidth, 600);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 7);
scene.add(light);

const loader = new GLTFLoader();

document.querySelector('#fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  status.textContent = 'Chargement du modèle…';

  const url = URL.createObjectURL(file);

  loader.load(
    url,
    (gltf) => {
      scene.children
        .filter(child => child.userData.model)
        .forEach(child => scene.remove(child));

      const model = gltf.scene;
      model.userData.model = true;
      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      model.position.sub(center);
      camera.position.set(maxDim * 1.8, maxDim * 1.2, maxDim * 1.8);
      controls.target.set(0, 0, 0);
      controls.update();

      status.textContent = `Modèle chargé : ${file.name}`;
      URL.revokeObjectURL(url);
    },
    undefined,
    (error) => {
      console.error(error);
      status.textContent = 'Erreur lors du chargement du modèle.';
      URL.revokeObjectURL(url);
    }
  );
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const width = canvasContainer.clientWidth;
  camera.aspect = width / 600;
  camera.updateProjectionMatrix();
  renderer.setSize(width, 600);
});
