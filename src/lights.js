import * as THREE from "three/webgpu";

export class Lights {
    static lightDir = new THREE.Vector3(0, 300, 0).multiplyScalar(-1).normalize();

    constructor() {
        this.object = new THREE.Object3D();

        const light = new THREE.DirectionalLight( 0xffffff, 2.0);
        light.position.set(100, 300, 0);
        this.object.add(light);

        this.ambientLight = new THREE.HemisphereLight( 0xffffff, new THREE.Color(.1, .4, .9), 1 );
        this.object.add(this.ambientLight);
    }

    update(elapsed) {

    }
}

