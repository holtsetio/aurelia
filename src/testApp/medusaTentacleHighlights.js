import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    transformNormalToView,
    normalMap,
    texture,
    vec2,
    If,
    uniform,
    cos, sin, positionGeometry
} from "three/tsl";

import {noise2D, noise3D} from "../testApp/common/noise";
import {conf} from "./conf";
import {Medusa} from "./medusa";


export class MedusaTentacleHighlights {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    static createMaterial(physics) {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        MedusaTentacleHighlights.material = new THREE.MeshPhysicalNodeMaterial({
            roughness, metalness, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness,
            emissive: new THREE.Color(0xFFFFFF).multiplyScalar(0.2),
            transparent: true,
            //normalMap: Medusa.normalMap,
            //side: THREE.Single,
            //roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness,
        });

        MedusaTentacleHighlights.material.positionNode = Fn(() => {
            const vertexIds = attribute('vertexIds');
            const radius = attribute('radius');
            const p0 = physics.positionData.buffer.element(vertexIds.x).xyz;
            const p1 = physics.positionData.buffer.element(vertexIds.y).xyz;
            const position = p0.add(p1).mul(0.5).add(positionGeometry.xyz.mul(radius));
            return position;
        })();
        //Medusa.tentacleMaterial.normalNode = normalMap(texture(Medusa.normalMap), vec2(0.8,-0.8)); //transformNormalToView(vNormal);
        //MedusaTentacleHighlights.material.normalNode = vNormal.normalize();

    }

    createGeometry() {
        const { tentacles } = this.medusa.tentacles;

        const vertexIdArray = [];
        const radiusArray = [];

        for (let i = 0; i < tentacles.length; i++) {
            vertexIdArray.push(tentacles[i][1].id, tentacles[i][2].id);
            radiusArray.push(0.03);
            vertexIdArray.push(tentacles[i][2].id, tentacles[i][3].id);
            radiusArray.push(0.025);
            vertexIdArray.push(tentacles[i][3].id, tentacles[i][4].id);
            radiusArray.push(0.02);
        }
        const vertexIdBuffer =  new THREE.InstancedBufferAttribute(new Uint32Array(vertexIdArray), 2, false);
        const radiusBuffer =  new THREE.InstancedBufferAttribute(new Float32Array(radiusArray), 1, false);

        const sphere = new THREE.IcosahedronGeometry(1,1);
        this.geometry = new THREE.InstancedBufferGeometry().copy(sphere);
        this.geometry.instanceCount = vertexIdArray.length / 2;
        this.geometry.setAttribute('vertexIds', vertexIdBuffer);
        this.geometry.setAttribute('radius', radiusBuffer);

        this.object = new THREE.Mesh(this.geometry, MedusaTentacleHighlights.material);
        this.object.frustumCulled = false;
    }
}