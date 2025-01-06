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
    cameraFar, positionView, smoothstep, cameraPosition, triNoise3D, cross, mat4, dot
} from "three/tsl";
import {Background} from "./background";
import {getBellPosition} from "./medusaBellFormula";
import {Lights} from "./lights";


export class Godrays {
    bridge = null;

    constructor(bridge){
        this.bridge = bridge;
        this.buildMaterial();
        this.buildGeometry();
    }

    buildMaterial() {
        this.material = new THREE.MeshBasicNodeMaterial({
            color: 0x000000,
            opacity: 0.05,
            transparent: true,
            fog: false,
            depthWrite: false,
        });

        const lightDir = uniform(Lights.lightDir);
        const vNormal = varying(vec3(0), "v_normalView");
        const vOffset = varying(float(0), "v_offset");
        const fog = varying(float(0), 'vFog');

        this.material.positionNode = Fn(() => {
            const params = attribute('params');
            const zenith = params.x;
            const azimuth = params.y;
            const offset = params.z;

            const medusaId = instanceIndex;
            const medusaTransform = this.bridge.medusaTransformData.element(medusaId);
            const phase = this.bridge.medusaPhaseData.element(medusaId);

            const bellPosition = getBellPosition(phase, zenith, azimuth, 0).toVar();
            bellPosition.xz.mulAssign(1.4);
            //bellPosition.y.subAssign(0.1);
            const position = medusaTransform.mul(bellPosition).xyz.toVar();
            position.addAssign(lightDir.mul(offset).mul(10));
            const normal = medusaTransform.mul(vec4(bellPosition.x, 0, bellPosition.z, 0.0)).xyz;
            vNormal.assign(transformNormalToView(normal));
            vOffset.assign(offset);

            const projectedZ = cameraViewMatrix.mul(vec4(position, 1.0)).z.mul(-1);
            fog.assign(smoothstep(Background.fogNear, Background.fogFar, projectedZ).oneMinus());
            fog.mulAssign(smoothstep(1, 3, projectedZ));

            //const down = medusaTransform.mul(vec4(0,-1,0,0)).xyz;
            //fog.mulAssign(down.dot(lightDir))
            /*const lookAngle = cameraPosition.sub(position).normalize();
            const lookDot = dot(lookAngle, lightDir).abs().oneMinus();
            fog.divAssign(lookDot.max(0.1));*/

            return position;
        })();
        /*this.material.colorNode = Fn(() => {
            return vNormal.normalize();
        })();*/
        /*this.material.opacityNode = Fn(() => {
            //return 1;
            const cameraRay = positionView.xyz.normalize().mul(-1);
            const normal = vNormal.normalize();

            const normalFactor = dot(cameraRay, normal).sub(0.1).max(0.0).mul(1.0/0.9).toVar();
            normalFactor.mulAssign(normalFactor);
            normalFactor.mulAssign(normalFactor);
            const offsetFactor = vOffset.oneMinus().mul(smoothstep(0.00,0.08,vOffset));


            return normalFactor.mul(offsetFactor).mul(fog).mul(0.4); //dot(cameraRay, normal).pow(2).mul(vOffset.oneMinus()).mul(0.95);
        })();*/
        this.material.fragmentNode = Fn(() => {
            const cameraRay = positionView.xyz.normalize().mul(-1);
            const normal = vNormal.normalize();
            const normalFactor = dot(cameraRay, normal).sub(0.1).max(0.0).mul(1.0/0.9).toVar();
            normalFactor.mulAssign(normalFactor);
            normalFactor.mulAssign(normalFactor);

            

            const offsetFactor = vOffset.oneMinus().mul(smoothstep(0.00,0.08,vOffset));
            const opacity = normalFactor.mul(offsetFactor).mul(fog).mul(0.4); //dot(cameraRay, normal).pow(2).mul(vOffset.oneMinus()).mul(0.95);
            return vec4(0,0,0,opacity);
        })();
    }

    buildGeometry() {
        const positionArray = [];
        const paramArray = [];
        const indices = [];
        let vertexCount = 0;

        const addVertex = (zenith, azimuth, offset) => {
            const ptr = vertexCount;

            positionArray[ptr * 3 + 0] = 0;
            positionArray[ptr * 3 + 1] = 0;
            positionArray[ptr * 3 + 2] = 0;
            paramArray[ptr * 3 + 0] = zenith;
            paramArray[ptr * 3 + 1] = azimuth;
            paramArray[ptr * 3 + 2] = offset;
            vertexCount++;
            return ptr;
        }

        const circleResolution = 32;
        const topRow = [];
        const bottomRow = [];
        for (let x=0; x<circleResolution; x++) {
            const azimuth = (x / circleResolution) * Math.PI * 2;
            topRow.push(addVertex(1, azimuth, 0));
            bottomRow.push(addVertex(1, azimuth, 1));
        }
        topRow.push(topRow[0]);
        bottomRow.push(bottomRow[0]);
        for (let x=0; x<circleResolution; x++) {
            const v0 = topRow[x];
            const v1 = topRow[x+1];
            const v2 = bottomRow[x];
            const v3 = bottomRow[x+1];
            indices.push(v2,v1,v0);
            indices.push(v1,v2,v3);
        }
        const positionBuffer =  new THREE.BufferAttribute(new Float32Array(positionArray), 3, false);
        const paramBuffer =  new THREE.BufferAttribute(new Float32Array(paramArray), 3, false);
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('params', paramBuffer);
        geometry.setIndex(indices);

        geometry.instanceCount = this.bridge.medusae.length;

        this.object = new THREE.Mesh(geometry, this.material);
        this.object.frustumCulled = false;
        this.object.renderOrder = -1;
    }

    async update(delta, elapsed) {

    }
}