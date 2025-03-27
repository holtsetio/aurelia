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
    cameraFar, positionView, smoothstep, cameraPosition, triNoise3D, cross, mat4, dot, uniformArray, atan, mrt
} from "three/tsl";
import {Background} from "./background";
import {getBellPosition} from "./medusaBellFormula";
import {Lights} from "./lights";


export class Godrays {
    bridge = null;

    uniforms = {};

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
        const vOffset = varying(float(0), "v_offset");
        const vAzimuth = varying(float(0), "v_azimuth");
        this.uniforms.matrixInverse = uniformArray(new Array(this.bridge.medusae.length).fill(0).map(() => { return new THREE.Matrix4(); }));

        this.material.positionNode = Fn(() => {
            const params = attribute('params');
            const zenith = params.x;
            const azimuth = params.y;
            const offset = params.z;

            const medusaId = instanceIndex;
            const medusaTransform = this.bridge.medusaTransformData.element(medusaId);
            const medusaTransformInverse = this.uniforms.matrixInverse.element(medusaId);
            const phase = this.bridge.medusaPhaseData.element(medusaId);

            const up = vec3(0,1,0);
            const camera = medusaTransformInverse.mul(vec4(cameraPosition.x, medusaTransform[3].y, cameraPosition.z, 1.0)).xyz.normalize();
            const ortho =  cross(up, camera).normalize();
            const angle = atan(ortho.x, ortho.z).add(Math.PI);

            const bellPosition = getBellPosition(phase, zenith, azimuth.add(angle), 0).toVar();
            bellPosition.xz.mulAssign(1.5);
            //bellPosition.y.subAssign(0.1);
            bellPosition.addAssign(camera.mul(0.8));
            const position = medusaTransform.mul(bellPosition).xyz.toVar();
            position.addAssign(lightDir.mul(offset).mul(20));

            vOffset.assign(offset);
            vAzimuth.assign(azimuth);

            return position;
        })();

        this.material.opacityNode = Fn(() => {
            const normalFactor = sin(vAzimuth).abs().pow(2);

            const fog = smoothstep(Background.fogNear, Background.fogFar, positionView.z.mul(-1)).oneMinus().toVar();
            fog.mulAssign(smoothstep(1, 3, positionView.z.mul(-1)));

            const offsetFactor = vOffset.oneMinus().mul(smoothstep(0.00,0.04,vOffset));
            const opacity = normalFactor.mul(offsetFactor).mul(fog).mul(0.33);
            return opacity;
        })();

        this.material.mrtNode = mrt( {
            bloomIntensity: 0
        } );
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

        const circleResolution = 2;
        const topRow = [];
        const bottomRow = [];
        for (let x=0; x<circleResolution; x++) {
            const azimuth = (x / (circleResolution-1)) * Math.PI * 2 * 0.5;
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
        const normalBuffer =  new THREE.BufferAttribute(new Float32Array(positionArray), 3, false);
        const paramBuffer =  new THREE.BufferAttribute(new Float32Array(paramArray), 3, false);
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('normal', normalBuffer);
        geometry.setAttribute('params', paramBuffer);
        geometry.setIndex(indices);

        geometry.instanceCount = this.bridge.medusae.length;

        this.object = new THREE.Mesh(geometry, this.material);
        this.object.frustumCulled = false;
        this.object.renderOrder = -1;

        this.object.onBeforeRender = () => {
            this.bridge.medusae.forEach((medusa, index) => {
                const matrix = medusa.transformationObject.matrix;
                this.uniforms.matrixInverse.array[index].copy(matrix).invert();
            });
        };
    }

    async update(delta, elapsed) {

    }
}