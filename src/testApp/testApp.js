import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader";

/*import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"*/

import { Lights } from "./lights";
import { conf } from "./conf";
import { VerletPhysics } from "./physics/verletPhysics";
import { VertexVisualizer } from "./physics/vertexVisualizer";
import {SpringVisualizer} from "./physics/springVisualizer";
import {Medusa} from "./medusa";
import hdriFile from "../assets/qwantani_puresky_2k.hdr";
import {TestGeometry} from "./testGeometry";
import {MedusaVerletBridge} from "./medusaVerletBridge";

const loadHdr = (file) => {
    return new Promise((resolve, reject) => {
        new RGBELoader().load( file, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            //texture.minFilter = THREE.LinearMipmapLinearFilter;
            //texture.generateMipmaps = true;
            resolve(texture);
        });
    })
};

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
        this.renderer.init();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(0, 0, -5);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        await progressCallback(0.1);

        this.physics = new VerletPhysics(this.renderer);

        await progressCallback(0.3);

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        const hdriTexture = await loadHdr(hdriFile);
        this.scene.environment = hdriTexture;
        this.scene.background = hdriTexture;
        this.scene.backgroundBlurriness = 0.3;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        await progressCallback(0.4);

        console.time("textures");
        await Medusa.initStatic(this.physics);
        console.timeEnd("textures");

        await progressCallback(0.5);

        this.bridge = new MedusaVerletBridge(this.physics);

        console.time("Medusae");
        for (let i=0; i<20; i++) {
            const medusa = new Medusa(this.renderer, this.physics, this.bridge);
            this.scene.add(medusa.object);
            this.physics.addObject(medusa);
        }
        this.physics.addObject(this.bridge);
        console.timeEnd("Medusae");

        console.time("Baking");
        await this.physics.bake();
        console.timeEnd("Baking");

        this.vertexVisualizer = new VertexVisualizer(this.physics);
        //this.scene.add(this.vertexVisualizer.object);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);

        //this.testGeometry = new TestGeometry();
        //this.scene.add(this.testGeometry.object);


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

        //this.testGeometry.update(elapsed);

        this.renderer.render(this.scene, this.camera);

        //console.log(this.renderer.info);
    }
}
export default TestApp;