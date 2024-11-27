import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";

/*import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"*/

import { Lights } from "./lights";
import { conf } from "./conf";
import { VerletPhysics } from "./physics/verletPhysics";
import { VertexVisualizer } from "./physics/vertexVisualizer";
import {SpringVisualizer} from "./physics/springVisualizer";

export class Medusa {
    renderer = null;
    physics = null;
    object = null;

    constructor(renderer, physics){
        this.renderer = renderer;
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.createGeometry();
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
        vertexRows.push([this.physics.addVertex(icoVertexTop.clone().normalize(), true)]);
        for (let y=1; y<=subdivisions; y++) {
            const vertexRow = [];
            for (let f=0; f<5; f++) {
                const e0 = icoVertexTop.clone().lerp(icoVertexRowTop[f], y/subdivisions);
                const e1 = icoVertexTop.clone().lerp(icoVertexRowTop[f+1], y/subdivisions);
                for (let x=0; x<y; x++) {
                    const pos = e0.clone().lerp(e1, x/y).normalize();
                    vertexRow.push(this.physics.addVertex(pos, true));
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
                    vertexRow.push(this.physics.addVertex(pos, true));
                }
                for (let x=0; x < y; x++) {
                    const pos = e1.clone().lerp(e2, x/y).normalize();
                    vertexRow.push(this.physics.addVertex(pos, true));
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
        for (let y = 1; y<=subdivisions; y++) {
            const verletTriangleRow = [];
            for (let f=0; f<5; f++) {
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromTopFace(f, y, x);
                    const v1 = getVertexFromTopFace(f, y-1, x);
                    const v2 = getVertexFromTopFace(f, y, x+1);
                    verletTriangleRow.push([v0,v1,v2]);
                    if (x > 0) {
                        this.physics.addSpring(v0, v1, 0.3, 1);
                    }
                    this.physics.addSpring(v0, v2, 0.3, 1);
                    this.physics.addSpring(v1, v2, 0.3, 1);
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
                    this.physics.addSpring(v0, v1, 0.3, 1);
                    this.physics.addSpring(v0, v2, 0.3, 1);
                    this.physics.addSpring(v1, v2, 0.3, 1);
                }
                for (let x=0; x < y; x++) {
                    const v0 = getVertexFromBottomUplookingFace(f, y, x);
                    const v1 = getVertexFromBottomUplookingFace(f, y-1, x);
                    const v2 = getVertexFromBottomUplookingFace(f, y, x+1);
                    verletTriangleRow.push([v0,v1,v2]);
                    this.physics.addSpring(v0, v1, 0.3, 1);
                    this.physics.addSpring(v0, v2, 0.3, 1);
                    this.physics.addSpring(v1, v2, 0.3, 1);
                }
            }
            verletTriangleRows.push(verletTriangleRow);
        }

    }

    async init() {

    }

    resize(width, height) {
    }

    async update(delta, elapsed) {

    }
}