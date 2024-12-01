import * as THREE from "three/webgpu";

import {MedusaVerletBridge} from "./medusaVerletBridge";
import {noise3D} from "../testApp/common/noise";

export class Medusa {
    renderer = null;
    physics = null;
    object = null;
    bridge = null;
    noiseSeed = 0;

    constructor(renderer, physics){
        this.renderer = renderer;
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.noiseSeed = Math.random() * 100.0;
        this.bridge = new MedusaVerletBridge(this.physics, this);
        this.createGeometry();
        this.physics.addObject(this);
        this.updatePosition(0,0);
    }

    addVertex(position, fixed) {
        const vertex = this.physics.addVertex(position, false);

        const width = Math.sqrt(position.x*position.x+position.z*position.z);
        const zenith = Math.atan2(width, position.y) / (Math.PI * 0.5);
        const azimuth = Math.atan2(position.x, position.z);

        const offset = position.clone().multiplyScalar(0.3);
        const muscleVertex = this.physics.addVertex(position, true);
        this.bridge.registerVertex(vertex, zenith, azimuth, new THREE.Vector3(0), false);
        this.bridge.registerVertex(muscleVertex, zenith, azimuth, offset, true);
        this.physics.addSpring(vertex, muscleVertex, 0.05, 1);
        return vertex;
    }

    createGeometry() {
        const subdivisions = 20; //has to be even

        const icoEdgeLength = 1.0;
        const icoCircumradius = 0.951057;
        const icoRadius = 1 / (2 * Math.sin(36 * (Math.PI / 180)));
        const alpha = Math.acos(icoRadius);
        const h = icoCircumradius - Math.sin(alpha);

        const icoVertexTop = new THREE.Vector3(0, icoCircumradius, 0);
        const icoVertexRowTop = [];
        const icoVertexRowBottom = [];
        for (let i = 0; i<=5; i++) {
            const topAngle = i * (2.0 * Math.PI / 5);
            const bottomAngle = (0.5 + i) * (2.0 * Math.PI / 5);
            icoVertexRowTop.push(new THREE.Vector3(Math.sin(topAngle) * icoRadius, h, Math.cos(topAngle) * icoRadius));
            icoVertexRowBottom.push(new THREE.Vector3(Math.sin(bottomAngle) * icoRadius, -h, Math.cos(bottomAngle) * icoRadius));
        }

        //icoVertexRowTop.forEach(v => { this.physics.addVertex(v, true); });
        //icoVertexRowBottom.forEach(v => { this.physics.addVertex(v, true); });

        const vertexRows = [];
        vertexRows.push([this.addVertex(icoVertexTop.clone().normalize(), true)]);
        for (let y=1; y<=subdivisions; y++) {
            const vertexRow = [];
            for (let f=0; f<5; f++) {
                const e0 = icoVertexTop.clone().lerp(icoVertexRowTop[f], y/subdivisions);
                const e1 = icoVertexTop.clone().lerp(icoVertexRowTop[f+1], y/subdivisions);
                for (let x=0; x<y; x++) {
                    const pos = e0.clone().lerp(e1, x/y).normalize();
                    vertexRow.push(this.addVertex(pos, true));
                }
            }
            vertexRow.push(vertexRow[0]);
            vertexRows.push(vertexRow);
        }
        for (let y=1; y<=subdivisions/2; y++) {
            const vertexRow = [];
            for (let f=0; f<5; f++) {
                const e0 = icoVertexRowTop[f].clone().lerp(icoVertexRowBottom[f], y/subdivisions);
                const e1 = icoVertexRowTop[f+1].clone().lerp(icoVertexRowBottom[f], y/subdivisions);
                const e2 = icoVertexRowTop[f+1].clone().lerp(icoVertexRowBottom[f+1], y/subdivisions);
                for (let x=0; x < subdivisions-y; x++) {
                    const pos = e0.clone().lerp(e1, x/(subdivisions-y)).normalize();
                    vertexRow.push(this.addVertex(pos, true));
                }
                for (let x=0; x < y; x++) {
                    const pos = e1.clone().lerp(e2, x/y).normalize();
                    vertexRow.push(this.addVertex(pos, true));
                }
            }
            vertexRow.push(vertexRow[0]);
            vertexRows.push(vertexRow);
        }
        const getVertexFromTopFace = (face, row, index) => {
            return vertexRows[row][face * row + index];
        };
        const getVertexFromBottomDownlookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + index];
        }
        const getVertexFromBottomUplookingFace = (face, row, index) => {
            return vertexRows[subdivisions + row][face * subdivisions + (subdivisions - row) + index];
        }

        const verletTriangleRows = [];
        const springStrength = 0.05;
        const springLengthFactor = 0.7;
        for (let y = 1; y<=subdivisions; y++) {
            const verletTriangleRow = [];
            for (let f=0; f<5; f++) {
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromTopFace(f, y, x);
                    const v1 = getVertexFromTopFace(f, y-1, x);
                    const v2 = getVertexFromTopFace(f, y, x+1);
                    verletTriangleRow.push([v0,v1,v2]);
                    if (x > 0) {
                        this.physics.addSpring(v0, v1, springStrength, springLengthFactor);
                    }
                    this.physics.addSpring(v0, v2, springStrength, springLengthFactor);
                    this.physics.addSpring(v1, v2, springStrength, springLengthFactor);
                }
            }
            verletTriangleRows.push(verletTriangleRow);
        }

        for (let y = 1; y<=subdivisions/2; y++) {
            const verletTriangleRow = [];
            for (let f=0; f<5; f++) {
                for (let x=0; x < subdivisions - y; x++) {
                    const v0 = getVertexFromBottomDownlookingFace(f, y, x);
                    const v1 = getVertexFromBottomDownlookingFace(f, y-1, x+1);
                    const v2 = getVertexFromBottomDownlookingFace(f, y, x+1);
                    verletTriangleRow.push([v0,v1,v2]);
                    this.physics.addSpring(v0, v1, springStrength, springLengthFactor);
                    this.physics.addSpring(v0, v2, springStrength, springLengthFactor);
                    this.physics.addSpring(v1, v2, springStrength, springLengthFactor);
                }
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromBottomUplookingFace(f, y, x);
                    const v1 = getVertexFromBottomUplookingFace(f, y-1, x);
                    const v2 = getVertexFromBottomUplookingFace(f, y, x+1);
                    verletTriangleRow.push([v0,v1,v2]);
                    this.physics.addSpring(v0, v1, springStrength, springLengthFactor);
                    this.physics.addSpring(v0, v2, springStrength, springLengthFactor);
                    this.physics.addSpring(v1, v2, springStrength, springLengthFactor);
                }
            }
            verletTriangleRows.push(verletTriangleRow);
        }

    }

    async init() {

    }

    resize(width, height) {
    }

    async bake() {
        return await this.bridge.bake();
    }

    updatePosition(delta, elapsed) {
        const time = elapsed * 0.2;
        const rotX = noise3D(this.noiseSeed, 13.37, time * 0.01) * Math.PI;
        const rotY = noise3D(this.noiseSeed, 12.37, time * 0.01) * Math.PI * 0.1;
        const rotZ = noise3D(this.noiseSeed, 11.37, time * 0.01) * Math.PI;
        this.object.rotation.set(rotX,rotY,rotZ, "XZY");
        const offset = new THREE.Vector3(0,delta,0).applyEuler(this.object.rotation);
        this.object.position.add(offset);
        this.object.updateMatrix();
    }

    async update(delta, elapsed) {
        this.updatePosition(delta, elapsed);
        return await this.bridge.update();


    }
}