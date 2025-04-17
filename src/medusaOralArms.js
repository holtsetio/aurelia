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
    cos, sin, uv, smoothstep, float, positionLocal, mix, triNoise3D, time, mrt
} from "three/tsl";

import {conf} from "./conf";
import {Background} from "./background";
import {Medusa} from "./medusa";


export class MedusaOralArms {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    static createMaterial(physics) {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        MedusaOralArms.material = new THREE.MeshPhysicalNodeMaterial({
            //side: THREE.DoubleSide,
            roughness, metalness, transmission, color, iridescence, iridescenceIOR,
            opacity: 0.1,
            transparent: true,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        MedusaOralArms.material.positionNode = Fn(() => {
            const tangent = vec3().toVar();
            const bitangent = vec3().toVar();
            const position = vec3().toVar();
            const normal = vec3().toVar();
            const side = attribute('sideData');

            const vertexIds = attribute('vertexIds');
            const p0 = physics.positionData.element(vertexIds.x).xyz.toVar();
            const p1 = physics.positionData.element(vertexIds.y).xyz.toVar();
            const p2 = physics.positionData.element(vertexIds.z).xyz.toVar();
            const p3 = physics.positionData.element(vertexIds.w).xyz.toVar();
            const top = p0.add(p1).mul(0.5);
            const bottom = p2.add(p3).mul(0.5);
            const left = p0.add(p2).mul(0.5);
            const right = p1.add(p3).mul(0.5);
            bitangent.assign(right.sub(left));
            tangent.assign(bottom.sub(top));
            const pos = top.add(bottom).mul(0.5);
            position.assign(pos);

            normal.assign(tangent.cross(bitangent).normalize().mul(side.z));
            normal.addAssign(tangent.normalize().mul(side.y));
            normal.addAssign(bitangent.normalize().mul(side.x));
            position.addAssign(normal.mul(side.w));

            vNormal.assign(transformNormalToView(normal));
            return position;
        })();
        //MedusaOralArms.material.normalNode = normalMap(texture(Medusa.normalMap), Medusa.uniforms.normalMapScale); //transformNormalToView(vNormal);
        MedusaOralArms.material.opacityNode = Fn(() => {
            const fog = Background.getFog;
            return smoothstep(0.05, 0.20, uv().y).mul(0.5).mul(fog);
        })();

        const emissive = float().toVar("medusaOralArmsEmission");
        MedusaOralArms.material.colorNode = Fn(() => {
            const noise = triNoise3D(vec3(uv().mul(2.0), 1.34), 0.0, time).toVar(); //mx_perlin_noise_float(vUv.mul(6));
            const white = vec3(0.85,0.85,1.0).sub(noise);
            const orange = vec3(1,0.5,0.1).sub(noise);
            const red = vec3(1,0.2,0.1).sub(noise);

            const a = uv().x.add(noise.mul(0.3));
            const limit = sin(uv().y.mul(100)).mul(0.03).add(0.3);
            const value = smoothstep(limit,0.6,a).oneMinus();
            emissive.assign(value.oneMinus());
            emissive.addAssign(Medusa.uniforms.charge.mul(0.5));
            const color = vec3().toVar("fragmentColor");
            color.assign(mix(orange, white, value));

            return color;
        })();

        MedusaOralArms.material.emissiveNode = Fn(() => {
            const red = vec3(1,0.2,0.1);
            const orange = vec3(1,0.5,0.1);
            return red.mul(emissive.mul(0.5));
        })();

        MedusaOralArms.material.mrtNode = mrt( {
            bloomIntensity: Background.getFog
        } );

        //MedusaOralArms.material.normalNode = vNormal.normalize();
    }

    createGeometry() {
        const { physics, medusaId, bridge } = this.medusa;

        /* ##################################
        tentacles
        #################################### */
        const armsNum = 4;
        const armsLength = 35;
        const armsWidth = 5;
        const arms = [];
        for (let i = 0; i < armsNum; i++) {
            const arm = [];
            const springStrength = 0.005;

            const azimuth = (i / armsNum) * Math.PI * 2;
            const offset = new THREE.Vector3(0, 0.05, 0);
            for (let y = 0; y < armsLength; y++) {
                const armRow = [];
                for (let x = 0; x < armsWidth; x++) {
                    offset.x = (Math.random() - 0.5) * 0.1;
                    const zenith = 0.2 + ((x / (armsWidth - 1) - 0.5) * 2) * (0.05 + (1.0 - y / armsLength) * 0.1);
                    const vertex = physics.addVertex(new THREE.Vector3(), y === 0);
                    bridge.registerVertex(medusaId, vertex, zenith, azimuth, true, offset.clone(), 0, y === 0);
                    armRow.push(vertex);
                }
                offset.y -= 0.1 * (1.0 + Math.random() * 0.5);
                arm.push(armRow);
            }
            arms.push(arm);

            for (let y = 1; y < armsLength; y++) {
                for (let x = 0; x < armsWidth; x++) {
                    const v0 = arm[y][x];
                    const v1 = arm[y-1][x];
                    physics.addSpring(v0, v1, springStrength, 1);
                    if (x > 0) {
                        const v2 = arm[y][x-1];
                        physics.addSpring(v0, v2, springStrength, 1);
                    }
                    if (x > 1) {
                        const v2 = arm[y][x-2];
                        physics.addSpring(v0, v2, springStrength, 1);
                    }
                    if (y > 1) {
                        const v2 = arm[y-2][x];
                        physics.addSpring(v0, v2, springStrength, 1);
                    }

                    if (y > 5 && (y-3) % 5 === 0) {
                        const v2 = arm[y-5][x];
                        const lengthFactor = 0.3 + Math.random() * 0.2;
                        physics.addSpring(v0, v2, springStrength*0.2, lengthFactor);
                    }
                }
            }
        }

        /* ##################################
        create geometry
        #################################### */

        const armsPositionArray = [];
        const armsVertexIdArray = [];
        const armsSideArray = [];
        const armsUvArray = [];
        const armsIndices = [];

        let armsVertexCount = 0;
        const addArmsVertex = (v0, v1, v2, v3, side, width, uvx, uvy) => {
            const ptr = armsVertexCount;

            armsPositionArray[ptr * 3 + 0] = 0;
            armsPositionArray[ptr * 3 + 1] = 0;
            armsPositionArray[ptr * 3 + 2] = 0;
            armsVertexIdArray[ptr * 4 + 0] = v0 ? v0.id : 0;
            armsVertexIdArray[ptr * 4 + 1] = v1 ? v1.id : 0;
            armsVertexIdArray[ptr * 4 + 2] = v2 ? v2.id : 0;
            armsVertexIdArray[ptr * 4 + 3] = v3 ? v3.id : 0;
            armsUvArray[ptr * 2 + 0] = uvx;
            armsUvArray[ptr * 2 + 1] = uvy;

            armsSideArray[ptr*4+0] = side.x;
            armsSideArray[ptr*4+1] = side.y;
            armsSideArray[ptr*4+2] = side.z;
            armsSideArray[ptr*4+3] = width;

            armsVertexCount++;
            return ptr;
        };

        const outerSide = new THREE.Vector3(0,0,1);
        const innerSide = new THREE.Vector3(0,0,-1);
        const rightSide = new THREE.Vector3(1,0,0);
        const leftSide = new THREE.Vector3(-1,0,0);

        for (let i = 0; i < armsNum; i++) {
            const arm = arms[i];
            const armVertexRows = [];


            for (let y = 1; y < armsLength; y++) {
                const armVertexRow = [];
                const backSideRow = [];
                for (let x = 0; x < armsWidth - 1; x++) {
                    const width = y === armsLength - 1 ? 0 : (0.02 + (1.0 - y/armsLength) * 0.02);
                    const v0 = arm[y - 1][x];
                    const v1 = arm[y - 1][x + 1];
                    const v2 = arm[y][x];
                    const v3 = arm[y][x + 1];
                    if (x === 0) {
                        const vertex = addArmsVertex(v0, v1, v2, v3, leftSide, width, 0, y * 0.05);
                        armVertexRow.push(vertex);
                    }
                    {
                        const vertex = addArmsVertex(v0, v1, v2, v3, outerSide, width, 0.1 + x * 0.1, y * 0.05);
                        armVertexRow.push(vertex);
                        const backVertex = addArmsVertex(v0, v1, v2, v3, innerSide, width, 0.1 + x * 0.1, y * 0.05);
                        backSideRow.push(backVertex);
                    }
                    if (x === armsWidth - 2) {
                        const vertex = addArmsVertex(v0, v1, v2, v3, rightSide, width, 0.2 + x * 0.1, y * 0.05);
                        armVertexRow.push(vertex);
                    }
                }
                armVertexRow.push(...backSideRow.reverse());
                armVertexRow.push(armVertexRow[0]);
                armVertexRows.push(armVertexRow);
            }

            for (let y = 1; y < armsLength - 1; y++) {
                for (let x = 0; x < armVertexRows[y].length - 1; x++) {
                    const v0 = armVertexRows[y - 1][x];
                    const v1 = armVertexRows[y - 1][x + 1];
                    const v2 = armVertexRows[y][x];
                    const v3 = armVertexRows[y][x + 1];
                    armsIndices.push(v2, v1, v0);
                    armsIndices.push(v1, v2, v3);
                }
            }
        }

        const armsPositionBuffer =  new THREE.BufferAttribute(new Float32Array(armsPositionArray), 3, false);
        const armsVertexIdBuffer =  new THREE.BufferAttribute(new Uint32Array(armsVertexIdArray), 4, false);
        const armsSideBuffer =  new THREE.BufferAttribute(new Float32Array(armsSideArray), 4, false);
        const armsUvBuffer =  new THREE.BufferAttribute(new Float32Array(armsUvArray), 2, false);
        const armsGeometry = new THREE.BufferGeometry();
        armsGeometry.setAttribute('position', armsPositionBuffer);
        armsGeometry.setAttribute('vertexIds', armsVertexIdBuffer);
        armsGeometry.setAttribute('sideData', armsSideBuffer);
        armsGeometry.setAttribute('uv', armsUvBuffer);
        armsGeometry.setIndex(armsIndices);

        this.object = new THREE.Mesh(armsGeometry, MedusaOralArms.material);
        this.object.frustumCulled = false;
        this.object.renderOrder = 21;
        this.object.onBeforeRender = () => {
            Medusa.uniforms.charge.value = this.medusa.charge;
        }
    }
}