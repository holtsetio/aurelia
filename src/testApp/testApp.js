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
import {SpringVisualizer} from "./physics/springVisualizer";
import {Medusa} from "./medusa";

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

        this.physics = new VerletPhysics(this.renderer);

        for (let i=0; i<10; i++) {
            const medusa = new Medusa(this.renderer, this.physics);
            this.scene.add(medusa.object);
        }


        await this.physics.bake();
        this.vertexVisualizer = new VertexVisualizer(this.physics);
        this.scene.add(this.vertexVisualizer.object);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);



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
        conf.update();
        this.controls.update(delta);
        this.stats.update();
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);
        this.renderer.render(this.scene, this.camera);
    }
}
export default TestApp;