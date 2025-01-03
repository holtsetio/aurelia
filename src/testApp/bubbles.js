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
    cos,
    sin,
    billboarding,
    uv,
    instanceIndex,
    cameraProjectionMatrix,
    cameraViewMatrix,
    positionLocal,
    sign,
    time,
    rand,
    vec4,
    float,
    uint,
    int,
    cameraWorldMatrix,
    cameraFar, positionView, smoothstep, cameraPosition, dot, normalGeometry, positionGeometry, mix, cross, triNoise3D
} from "three/tsl";
import {mx_perlin_noise_float, mx_perlin_noise_vec3} from "three/src/nodes/materialx/lib/mx_noise";



export class Bubbles {
    renderer = null;
    object = null;
    uniforms = {};

    constructor(renderer){
        this.renderer = renderer;

        this.material = new THREE.MeshPhysicalNodeMaterial({
            //side: THREE.DoubleSide,
            roughness: 0,
            metalness: 0.00,
            transmission: 1.0,
            color: 0xFFFFFF,
            iridescence: 1.0,
            iridescenceIOR: 1.5,
            thickness: 0.1,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        this.material.positionNode = Fn(() => {
            const position = positionGeometry.toVar()
            const downFactor = normalGeometry.y.mul(-1).max(0).pow(1.3);

            const noisePos = position.xyz.mul(0.1);
            const noiseOffset = vec3(0.001, -0.001, 0);
            const n0 = triNoise3D(noisePos.add(noiseOffset.xzz), 1, time).mul(2).add(0.5);
            const n1 = triNoise3D(noisePos.add(noiseOffset.yzz), 1, time).mul(2).add(0.5);
            const n2 = triNoise3D(noisePos.add(noiseOffset.zxz), 1, time).mul(2).add(0.5);
            const n3 = triNoise3D(noisePos.add(noiseOffset.zyz), 1, time).mul(2).add(0.5);
            const noiseTangent = n0.sub(n1);
            const noiseBitangent = n2.sub(n3);
            const noiseNormal = vec3(noiseTangent, noiseOffset.x.mul(-2), noiseBitangent).normalize(); // cross(noiseBitangent, noiseTangent).normalize();
            const noiseStrength = downFactor.mul(0.8);
            vNormal.assign(transformNormalToView(mix(normalGeometry, noiseNormal, noiseStrength)));
            const noiseValue = n0.add(n1).add(n2).add(n3).div(4);

            position.y.subAssign(float(-1).mul(noiseStrength).mul(noiseValue));
            return position;
        })();
        this.material.normalNode = vNormal.normalize();

        this.geometry = new THREE.IcosahedronGeometry(1, 10);
        this.object  = new THREE.Mesh(this.geometry, this.material);
        this.object.frustumCulled = false;

    }

    async update(delta, elapsed) {

    }
}