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
    cameraFar, positionView, smoothstep, cameraPosition
} from "three/tsl";
import {mx_perlin_noise_vec3} from "three/src/nodes/materialx/lib/mx_noise";
import {Background} from "./background";

export const triple32 = /*#__PURE__*/ Fn( ( [ x_immutable ] ) => {
    const x = uint( x_immutable ).toVar();
    x.bitXorAssign( x.shiftRight( uint( 17 ) ) );
    x.mulAssign( uint( 0xed5ad4bb) );
    x.bitXorAssign( x.shiftRight( uint( 11 ) ) );
    x.mulAssign( uint( 0xac4c1b51 ) );
    x.bitXorAssign( x.shiftRight( uint( 15 ) ) );
    x.mulAssign( uint( 0x31848bab ) );
    x.bitXorAssign( x.shiftRight( uint( 14 ) ) );
    return x;
} ).setLayout( {
    name: 'triple32',
    type: 'uint',
    inputs: [
        { name: 'x', type: 'uint' }
    ]
} );

export const hash = /*#__PURE__*/ Fn( ( [ x_immutable ] ) => {
    const x = uint( x_immutable ).toVar();
    return float( triple32( x ) ).div( float( uint( 0xffffffff ) ) );
} ).setLayout( {
    name: 'hash',
    type: 'float',
    inputs: [
        { name: 'x', type: 'uint' }
    ]
} );


export class Plankton {
    renderer = null;
    object = null;
    uniforms = {};

    constructor(renderer){
        this.renderer = renderer;

        this.uniforms.bounds = uniform(0, 'float');

        this.material = new THREE.MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, fog: false });
        const fog = varying(float(0), 'vFog');
        this.material.vertexNode = Fn(() => {
            const id = instanceIndex.mul(3).add(1);
            const pos = vec3(hash(id), hash(id.add(1)), hash(id.add(2))).mul(this.uniforms.bounds).toVar();

            pos.addAssign(mx_perlin_noise_vec3(vec3(pos.xy, time.mul(0.1))).mul(0.5));

            const cameraCenterPos = cameraWorldMatrix.mul(vec4(0.0, 0.0, cameraFar.mul(-0.5), 1.0)).xyz;
            const offset = pos.sub(cameraCenterPos).div(this.uniforms.bounds).round().mul(this.uniforms.bounds).mul(-1);
            pos.addAssign(offset);

            const projectedZ = cameraViewMatrix.mul(vec4(pos, 1.0)).z.mul(-1);
            fog.assign(smoothstep(Background.fogNear, Background.fogFar, projectedZ).oneMinus());
            fog.mulAssign(smoothstep(1, 3, projectedZ));

            return billboarding({ position: pos, horizontal: true, vertical: true });
        })();

        this.material.colorNode = vec3(1,1,1);

        this.material.opacityNode = Fn(() => {
            const vUv = uv().mul(2.0).sub(1.0);
            return vUv.length().oneMinus().max(0.0).pow(2.0).mul(fog).mul(0.05);
        })();

        const plane = new THREE.PlaneGeometry(0.1,0.1);
        this.geometry = new THREE.InstancedBufferGeometry().copy(plane);
        this.geometry.instanceCount = 1000;
        this.object  = new THREE.Mesh(this.geometry, this.material);
        this.object.frustumCulled = false;
        this.object.onBeforeRender = (renderer, scene, camera) => {
            const minBounds = new THREE.Vector3();
            const maxBounds = new THREE.Vector3();
            camera.getViewBounds(camera.far, minBounds, maxBounds);
            const bounds = maxBounds.sub(minBounds).setZ(camera.far).length();
            this.uniforms.bounds.value = bounds;
            const volume = bounds*bounds*bounds;
            console.log(bounds, volume);
            this.geometry.instanceCount = Math.floor(volume * 0.02);
        };
        this.object.renderOrder = 100;
    }

    async update(delta, elapsed) {

    }
}