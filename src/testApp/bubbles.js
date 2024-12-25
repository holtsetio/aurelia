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
    cameraFar, positionView, smoothstep, cameraPosition, dot, normalGeometry, positionGeometry, mix, cross
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
            const downFactor = dot(normalGeometry, vec3(0,-1,0)).max(0).pow(2);

            const noisePos = vec3(position.xz.mul(2), time.mul(2).add(position.y));
            const noiseOffset = vec3(0.001, -0.001, 0);
            const n0 = mx_perlin_noise_float(noisePos.add(noiseOffset.xzz)).mul(0.5).add(0.5);
            const n1 = mx_perlin_noise_float(noisePos.add(noiseOffset.yzz)).mul(0.5).add(0.5);
            const n2 = mx_perlin_noise_float(noisePos.add(noiseOffset.zxz)).mul(0.5).add(0.5);
            const n3 = mx_perlin_noise_float(noisePos.add(noiseOffset.zyz)).mul(0.5).add(0.5);
            const noiseTangent = n0.sub(n1);
            const noiseBitangent = n2.sub(n3);
            const noiseNormal = vec3(noiseTangent, noiseOffset.x.mul(-2), noiseBitangent).normalize(); // cross(noiseBitangent, noiseTangent).normalize();
            const noiseStrength = downFactor.mul(0.8);
            vNormal.assign(transformNormalToView(mix(normalGeometry, noiseNormal, noiseStrength)));
            const noiseValue = n0.add(n1).add(n2).add(n3).div(4);

            position.subAssign(normalGeometry.mul(noiseStrength).mul(noiseValue));
            return position;
        })();
        this.material.normalNode = vNormal.normalize();

        this.geometry = new THREE.IcosahedronGeometry(1, 20);
        this.object  = new THREE.Mesh(this.geometry, this.material);
        this.object.frustumCulled = false;

    }

    async update(delta, elapsed) {

    }
}