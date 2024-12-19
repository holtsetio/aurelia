import * as THREE from "three/webgpu";
import {noise3D} from "./common/noise";
import chroma from "chroma-js";
import {conf} from "./conf";
import {Fn, vec3, screenUV, positionWorld, cameraPosition, float, acos, normalWorld, rand, time, sin} from "three/tsl";

export class Background {

    static fogFunction = Fn(() => {
        const colorTop = vec3(.1, .4, .9);
        const colorBottom = vec3(.1, .5, .6);

        const camDir = positionWorld.sub(cameraPosition).normalize();

        const wave = sin(camDir.x.add(time.mul(0.2))).mul(0.05);
        const y = camDir.y.mul(0.5).add(0.5).pow(2.0).add(wave);
        const color = colorTop.mul(y);
        const uv = screenUV.toVar();
        color.x.addAssign(rand(uv).sub(0.5).mul(1.0/255));
        color.y.addAssign(rand(uv.yx).sub(0.5).mul(1.0/255));
        color.z.addAssign(rand(uv.mul(1.234)).sub(0.5).mul(1.0/255));
        return color;
    })();

    constructor(renderer) {
        /*this.renderer = renderer;
        this.renderTarget = new THREE.WebGLCubeRenderTarget( 256 );
        this.renderTarget.texture.type = THREE.HalfFloatType;
        this.renderTarget.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.renderTarget.texture.magFilter = THREE.LinearFilter;
        this.renderTarget.texture.generateMipmaps = true;

        this.camera = new THREE.CubeCamera( 1, 1000, this.renderTarget );
        this.texture = this.renderTarget.texture;

        this.scene = new THREE.Scene();
        const light = new THREE.PointLight('#ff00ff', 1000);
        this.scene.add(light);

        this.box = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardNodeMaterial());
        this.box.position.setX(5);
        this.scene.add(this.box);*/
    }

    update(elapsed) {
        //this.box.position.set(Math.sin(elapsed*0.01) * 5, 0, Math.cos(elapsed*0.01) * 5);
        //this.camera.update(this.renderer, this.scene);
    }
}

