import * as THREE from "three/webgpu"
import TestApp from "./testApp/testApp";
THREE.ColorManagement.enabled = true

const updateLoadingProgressBar = async (frac, delay=200) => {
  return new Promise(resolve => {
    const progress = document.getElementById("progress")
    // 200px is the width of the progress bar defined in index.html
    progress.style.width = `${frac * 200}px`
    setTimeout(resolve, delay)
  })
}

const createRenderer = () => {
  const renderer = new THREE.WebGPURenderer({
    antialias: false
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

const run = async ()=>{
  console.warn = (lol)=>{
    window.alert(lol);
  };

  const renderer = createRenderer();
  const container = document.getElementById("container");
  container.appendChild(renderer.domElement);

  const app = new TestApp(renderer);
  await app.init(updateLoadingProgressBar);
  window.addEventListener("resize", ()=>{
    renderer.setSize(window.innerWidth, window.innerHeight);
    app.resize(window.innerWidth, window.innerHeight);
  });
  const veil = document.getElementById("veil");
  veil.style.opacity = 0;
  const progressBar = document.getElementById("progress-bar");
  progressBar.style.opacity = 0;
  const clock = new THREE.Clock();
  const animate = async ()=>{
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    await app.update(delta, elapsed);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

run().catch(error => {
  console.error(error);
});