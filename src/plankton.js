import * as THREE from "three/webgpu";
import {
    Fn,
    varying,
    vec3,
    uniform,
    billboarding,
    uv,
    instanceIndex,
    cameraViewMatrix,
    positionLocal,
    time,
    vec4,
    float,
    uint,
    cameraWorldMatrix,
    cameraFar, smoothstep, triNoise3D, mrt, mx_noise_vec3
} from "three/tsl";
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
        const flickering = varying(float(0), 'vFlickering');
        this.material.vertexNode = Fn(() => {
            const id = instanceIndex.mul(4).add(1).toVar();
            const pos = vec3(hash(id), hash(id.add(1)), hash(id.add(2))).mul(this.uniforms.bounds).toVar();
            const noise = mx_noise_vec3(vec3(pos.xy, time.mul(0.1))).toVar();
            pos.addAssign(noise);
            //const noisex = triNoise3D(pos.xyz, 0.1, time).sub(0.5);
            //const noisey = triNoise3D(pos.yzx, 0.1, time).sub(0.5);
            //const noisez = triNoise3D(pos.zxy, 0.1, time).sub(0.5);
            //pos.addAssign(vec3(noisex, noisey, noisez));

            const cameraCenterPos = cameraWorldMatrix.mul(vec4(0.0, 0.0, cameraFar.mul(-0.5), 1.0)).xyz;
            const offset = pos.sub(cameraCenterPos).div(this.uniforms.bounds).round().mul(this.uniforms.bounds).mul(-1);
            pos.addAssign(offset);

            const projectedZ = cameraViewMatrix.mul(vec4(pos, 1.0)).z.mul(-1);
            fog.assign(smoothstep(Background.fogNear, Background.fogFar, projectedZ).oneMinus());
            fog.mulAssign(smoothstep(1, 3, projectedZ));

            flickering.assign(triNoise3D(vec3(float(instanceIndex), 13.12, 13.37), 0.5, time));

            positionLocal.xy.mulAssign(hash(id.add(3)).mul(0.8).add(0.6));
            return billboarding({ position: pos, horizontal: true, vertical: true });
        })();

        this.material.colorNode = vec3(1,1,1);

        this.material.opacityNode = Fn(() => {
            const vUv = uv().mul(2.0).sub(1.0);
            const opacity = vUv.length().oneMinus().max(0.0).pow(3.0).mul(fog).mul(0.2);
            opacity.mulAssign(flickering);
            return opacity;
        })();

        this.material.mrtNode = mrt( {
            bloomIntensity: 0.0
        } );

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
            this.geometry.instanceCount = Math.floor(volume * 0.02);
        };
        this.object.renderOrder = 100;
    }

    async update(delta, elapsed) {

    }
}