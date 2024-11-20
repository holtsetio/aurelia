import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";

/*import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"*/

import { Lights } from "./lights";
import { conf } from "./conf";
import { VerletPhysics } from "./physics/verletPhysics";
import { VertexVisualizer } from "./physics/vertexVisualizer";

class TestApp {
    renderer = null;

    camera = null;

    scene = null;

    controls = null;

    lights = null;

    stats = null;

    physics = null;

    vertexVisualizer = null;

    springVisualizer = null;

    constructor(renderer){
        this.renderer = renderer;
    }

    async init(progressCallback) {
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(0, 0, -5);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        await progressCallback(0.1);

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        /*const hdriTexture = await loadHdrjpg(this.renderer, hdrjpg);
        this.scene.environment = hdriTexture;
        this.scene.background = hdriTexture;
        this.scene.backgroundBlurriness = 0.5;*/
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        await progressCallback(0.5);

        this.cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({
            metalness: 0.9,
            roughness: 0.4
        }));
        this.scene.add(this.cube);

        this.physics = new VerletPhysics(this.renderer);

        const w = 1000;
        const h = 1000;
        const verletVertices = new Array(w).fill(0).map((i)=>{
            return new Array(h).fill(0);
        });

        for(let x = 0; x < w; x++) {
            for(let y = 0; y < h; y++) {
                verletVertices[x][y] = this.physics.addVertex(x * 0.05, y * 0.05, y * 0.03, y === 0);
            }
        }
        for(let x = 0; x < w; x++) {
            for(let y = 0; y < h; y++) {
                if (x > 0) {
                    this.physics.addSpring(verletVertices[x][y], verletVertices[x - 1][y], 0.52, 1);
                }
                if (y > 0) {
                    this.physics.addSpring(verletVertices[x][y], verletVertices[x][y - 1], 0.52, 1);
                    if (x > 0) {
                        this.physics.addSpring(verletVertices[x][y], verletVertices[x - 1][y - 1], 0.52, 1);
                        this.physics.addSpring(verletVertices[x - 1][y], verletVertices[x][y - 1], 0.52, 1);
                    }
                }
            }
        }

        await this.physics.bake();
        this.vertexVisualizer = new VertexVisualizer(this.physics);
        this.scene.add(this.vertexVisualizer.object);

        /*this.time = 0;
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(0, 0, -5);
        this.camera.lookAt(0,0,0);
        this.camera.updateProjectionMatrix()

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        await progressCallback(0.1)



        this.lights = new Lights();
        this.scene.add(this.lights.object);


        this.physics = new VerletPhysics(this.renderer);

        const lineMedusa = new MedusaLine(this.physics);
        this.physics.addObject(lineMedusa);
        this.medusae.push(lineMedusa);

        for (let i = 0; i<1; i++) {
            const solidMedusa = new Medusa(this.physics, i*0.1);
            this.physics.addObject(solidMedusa);
            this.medusae.push(solidMedusa);
        }

        this.physics.bake();
        this.physics.springs.recalculateLengths();
        for (let i=0; i<this.medusae.length; i++) {
            const medusa = this.medusae[i];
            await medusa.init();
            this.scene.add(medusa.object);
        }

        //

        this.vertexVisualizer.js = new VertexVisualizer(this.physics);
        this.scene.add(this.vertexVisualizer.js.object);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);


        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.4, 0.0);
        const renderScene = new RenderPass(this.scene, this.camera);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        */
        this.stats = new Stats();
        this.stats.showPanel(0); // Panel 0 = fps
        this.stats.domElement.style.cssText = "position:absolute;top:0px;left:0px;";
        this.renderer.domElement.parentElement.appendChild(this.stats.domElement);
        await progressCallback(1.0, 100);
    }
    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
    async update(delta, elapsed) {
        /*
        const { bloom, bloomStrength, bloomRadius, bloomThreshold } = conf;

        this.bloomPass.strength = bloomStrength;
        this.bloomPass.radius = bloomRadius;
        this.bloomPass.threshold = bloomThreshold;

        if (bloom && !this.bloomEnabled) {
            this.bloomEnabled = true;
            this.composer.addPass(this.bloomPass);
        } else if (!bloom && this.bloomEnabled) {
            this.bloomEnabled = false;
            this.composer.removePass(this.bloomPass);
        }

        conf.update();
        this.controls.update(delta);
        this.stats.update();
        this.time += 0.01666;
        //this.medusa.update(this.time);
        this.physics.update(0.01666, this.time);
        this.lights.update(elapsed);

        this.composer.render();
        //this.renderer.render(this.scene, this.camera);

         */
        conf.update();
        this.controls.update(delta);
        this.stats.update();
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);
        this.renderer.render(this.scene, this.camera);
    }
}
export default TestApp;