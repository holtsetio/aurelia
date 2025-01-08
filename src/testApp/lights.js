import * as THREE from "three/webgpu";
import {noise3D} from "./common/noise";
import chroma from "chroma-js";
import {conf} from "./conf";
import {Fn,vec3,uv} from "three/tsl";
import {Vector3} from "three";

export class Lights {
    static lightDir = new Vector3(0, 300, 0).multiplyScalar(-1).normalize();

    lights = [];

    lightNum = 0;

    constructor() {
        this.object = new THREE.Object3D();


        const light = new THREE.DirectionalLight( 0xffffff, 2.0);
        light.position.set(100, 300, 0);
        this.object.add(light);
        const bottomLight = new THREE.DirectionalLight( 0xffffff, 0.3);
        bottomLight.position.setY(-300);
        //this.object.add(bottomLight);

        this.ambientLight = new THREE.HemisphereLight( 0xffffff, new THREE.Color(.1, .4, .9), 1 );
        this.object.add(this.ambientLight);
        conf.gui.add(this.ambientLight, "intensity", 0, 10, 0.01);
        //this.object.add(new THREE.SpotLightHelper(light));


        /*for (let i=0; i<this.lightNum; i++) {
            const light = new THREE.PointLight(new THREE.Color(), 5, 0, 0);
            light.position.set(0, 0, 0);
            light.noiseCoord = Math.random() * 100;*/

            /*light.castShadow = true; // default false
            light.shadow.mapSize.width = 512; // default
            light.shadow.mapSize.height = 512; // default
            light.shadow.camera.near = 0.5; // default
            light.shadow.camera.far = 500;*/

            /*this.lights.push(light);
            this.object.add(light);
            this.object.add(new THREE.PointLightHelper(light));
        }*/
    }

    update(elapsed) {
        const { light1, light2, light3, light4 } = conf;
        /*this.lights[0].color.set(light1);
        this.lights[1].color.set(light2);
        this.lights[2].color.set(light3);
        this.lights[3].color.set(light4);*/

        /*const t = elapsed * 0.05;
        for (let i=0; i<this.lightNum; i++) {
            const light = this.lights[i];
            light.position.set(
                noise3D(light.noiseCoord, 17.23, t),
                noise3D(light.noiseCoord, 43.33, t),
                noise3D(light.noiseCoord, 84.43, t)
            ).multiplyScalar(500);
        }*/
    }
}

