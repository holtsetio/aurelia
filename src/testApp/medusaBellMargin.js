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
    If
} from "three/tsl";

import {Medusa} from "./medusa";
import {getBellPosition} from "./medusaBellFormula";
import {conf} from "./conf";

export class MedusaBellMargin {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    static createMaterial(physics) {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        MedusaBellMargin.material = new THREE.MeshPhysicalNodeMaterial({
            //side: THREE.Single,
            roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness
        });

        const vNormal = varying(vec3(0), "v_normalView");
        MedusaBellMargin.material.positionNode = Fn(() => {
            const tangent = vec3().toVar();
            const bitangent = vec3().toVar();
            const position = vec3().toVar();
            const normal = vec3().toVar();
            const params = attribute('params');
            const side = attribute('sideData');

            If(params.x.greaterThan(0.0), () => {
                const zenith = params.x;
                const azimuth = params.y;
                position.assign(getBellPosition(Medusa.uniforms.phase, zenith, azimuth, 0.0));
                position.assign(Medusa.uniforms.matrix.mul(position).xyz);
                const p0 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.sub(0.001), 0.0)).xyz;
                const p1 = Medusa.uniforms.matrix.mul(getBellPosition(Medusa.uniforms.phase, zenith.add(0.001), azimuth.add(0.001), 0.0)).xyz;
                tangent.assign(p0.sub(position));
                bitangent.assign(p1.sub(position));
            }).Else(() => {
                const vertexIds = attribute('vertexIds');
                const p0 = physics.positionData.buffer.element(vertexIds.x).xyz.toVar();
                const p1 = physics.positionData.buffer.element(vertexIds.y).xyz.toVar();
                const p2 = physics.positionData.buffer.element(vertexIds.z).xyz.toVar();
                const p3 = physics.positionData.buffer.element(vertexIds.w).xyz.toVar();
                const top = p0.add(p1).mul(0.5);
                const bottom = p2.add(p3).mul(0.5);
                const left = p0.add(p2).mul(0.5);
                const right = p1.add(p3).mul(0.5);
                bitangent.assign(right.sub(left));
                tangent.assign(bottom.sub(top));
                const pos = top.add(bottom).mul(0.5);
                position.assign(pos);
            });

            normal.assign(tangent.cross(bitangent).normalize().mul(side.z));
            normal.addAssign(tangent.normalize().mul(side.y));
            position.addAssign(normal.mul(side.w));

            vNormal.assign(transformNormalToView(normal));
            return position;
        })();
        MedusaBellMargin.material.normalNode = normalMap(texture(Medusa.normalMap), Medusa.uniforms.normalMapScale); //transformNormalToView(vNormal);
        //MedusaBellMargin.material.normalNode = vNormal.normalize();
    }

    createGeometry() {
        const { bell, subdivisions, physics, bridge, medusaId } = this.medusa;
        const { vertexRows } = bell;

        /* ##################################
            create Verlet geometry
        #################################### */

        const bellMarginWidth = 5 * subdivisions;
        const bellMarginHeight = 8;
        const bellMarginRows = [];
        for (let y = 0; y < bellMarginHeight; y++) {
            const row = [];
            for (let x = 0; x < bellMarginWidth; x++) {
                const pivot = vertexRows[vertexRows.length - 1][x];
                const zenith = pivot.zenith;
                const azimuth = pivot.azimuth;
                const vertex = physics.addVertex(new THREE.Vector3(), y === 0);
                const offset = new THREE.Vector3(Math.sin(azimuth) * y * 0.06, y * -0.06, Math.cos(azimuth) * y * 0.06);
                offset.multiplyScalar(0.7);
                //if (y <= 1) { offset.multiplyScalar(0); }
                vertex.offset = offset.clone();
                vertex.zenith = zenith;
                vertex.azimuth = azimuth;
                bridge.registerVertex(medusaId, vertex, zenith, azimuth, false, offset.clone(), 0, y === 0);
                row.push(vertex);

                //muscle vertex
                const zeroOffset = new THREE.Vector3(0,0,0);
                if (y>=1 && y <= 3) {
                    const muscleVertex = physics.addVertex(new THREE.Vector3(), true);
                    bridge.registerVertex(medusaId, muscleVertex, zenith, azimuth, false, zeroOffset, -offset.y, true);
                    physics.addSpring(vertex, muscleVertex, 0.01 / Math.pow(y, 3), 0);
                }
            }
            row.push(row[0]);
            bellMarginRows.push(row);
        }
        for (let y = 1; y < bellMarginHeight; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const springStrength = 0.002;
                const v0 = bellMarginRows[y][x];
                const v1 = bellMarginRows[y-1][x];
                const v2 = bellMarginRows[y][x+1];
                const v3 = bellMarginRows[y-1][x+1];

                physics.addSpring(v0, v1, springStrength, 1);
                physics.addSpring(v0, v2, springStrength, 1);
                physics.addSpring(v1, v2, springStrength, 1);
                physics.addSpring(v0, v3, springStrength, 1);

                //this.physics.addSpring(v0, v4, 0.1, 1);
                //this.physics.addSpring(v0, v4, springStrength, 1);
            }
        }

        /* ##################################
            create Bell Margin geometry
        #################################### */

        const marginPositionArray = [];
        const marginVertexIdArray = [];
        const marginParamsArray = [];
        const marginSideArray = [];
        const marginUvArray = [];
        const marginIndices = [];
        const marginOuterVertexRows = [];
        const marginInnerVertexRows = [];
        let marginVertexCount = 0;
        const normalizeAzimuth = (a) => { return a < 0 ? a + Math.PI * 2 : a; }
        const addMarginVertex = (referenceVertex, v0, v1, v2, v3, side, width) => {
            const ptr = marginVertexCount;
            let azimuth, zenith;

            if (referenceVertex) {
                zenith = referenceVertex.zenith;
                azimuth = referenceVertex.azimuth;
            } else {
                azimuth = (normalizeAzimuth(v0.azimuth) + normalizeAzimuth(v1.azimuth) + normalizeAzimuth(v2.azimuth) + normalizeAzimuth(v3.azimuth)) * 0.25;
                zenith = (v0.zenith + v1.zenith + v2.zenith + v3.zenith) * 0.25;
                zenith -= (v0.offset.y + v1.offset.y + v2.offset.y + v3.offset.y) * 0.25;
                zenith += side.y * width;
            }
            const uvx = Math.sin(azimuth) * zenith * 4;
            const uvy = Math.cos(azimuth) * zenith * 4;

            marginPositionArray[ptr * 3 + 0] = 0;
            marginPositionArray[ptr * 3 + 1] = 0;
            marginPositionArray[ptr * 3 + 2] = 0;
            marginVertexIdArray[ptr * 4 + 0] = v0 ? v0.id : 0;
            marginVertexIdArray[ptr * 4 + 1] = v1 ? v1.id : 0;
            marginVertexIdArray[ptr * 4 + 2] = v2 ? v2.id : 0;
            marginVertexIdArray[ptr * 4 + 3] = v3 ? v3.id : 0;
            marginUvArray[ptr * 2 + 0] = uvx;
            marginUvArray[ptr * 2 + 1] = uvy;

            marginParamsArray[ptr * 2 + 0] = referenceVertex ? zenith : 0;
            marginParamsArray[ptr * 2 + 1] = referenceVertex ? azimuth : 0;
            marginSideArray[ptr*4+0] = side.x;
            marginSideArray[ptr*4+1] = side.y;
            marginSideArray[ptr*4+2] = side.z;
            marginSideArray[ptr*4+3] = width;

            marginVertexCount++;
            return ptr;
        };

        const outerSide = new THREE.Vector3(0,0,1);
        const innerSide = new THREE.Vector3(0,0,-1);
        const downSide = new THREE.Vector3(0,1,0);

        {
            // first bell margin row
            const innerRow = []
            const outerRow = []
            for (let x = 0; x < bellMarginWidth; x++) {
                const refVertex = vertexRows[vertexRows.length - 1][x];
                const outerVertex = addMarginVertex(refVertex, null, null, null, null, outerSide, 0);
                const innerVertex = addMarginVertex(refVertex, null, null, null, null, innerSide, 0);
                outerRow.push(outerVertex);
                innerRow.push(innerVertex);
            }
            outerRow.push(outerRow[0]);
            innerRow.push(innerRow[0]);
            marginOuterVertexRows.push(outerRow);
            marginInnerVertexRows.push(innerRow);
        }

        const downRow = [];
        const marginDepth = 0.025;
        for (let y = 2; y < bellMarginHeight; y++) {
            const innerRow = []
            const outerRow = []
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = bellMarginRows[y-1][x];
                const v1 = bellMarginRows[y-1][x+1];
                const v2 = bellMarginRows[y][x];
                const v3 = bellMarginRows[y][x+1];
                const outerVertex = addMarginVertex(null,v0,v1,v2,v3, outerSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                const innerVertex = addMarginVertex(null,v0,v1,v2,v3, innerSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                outerRow.push(outerVertex);
                innerRow.push(innerVertex);
                if (y === bellMarginHeight - 1) {
                    const downVertex = addMarginVertex(null,v0,v1,v2,v3, downSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                    downRow.push(downVertex);
                }
            }
            outerRow.push(outerRow[0]);
            innerRow.push(innerRow[0]);
            marginOuterVertexRows.push(outerRow);
            marginInnerVertexRows.push(innerRow);
        }
        downRow.push(downRow[0]);

        const marginVertexRows = [...marginOuterVertexRows, downRow, ...(marginInnerVertexRows.toReversed())];
        for (let y = 1; y < marginVertexRows.length; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = marginVertexRows[y - 1][x];
                const v1 = marginVertexRows[y - 1][x + 1];
                const v2 = marginVertexRows[y][x];
                const v3 = marginVertexRows[y][x + 1];
                marginIndices.push(v2, v1, v0);
                marginIndices.push(v1, v2, v3);

            }
        }

        const marginPositionBuffer =  new THREE.BufferAttribute(new Float32Array(marginPositionArray), 3, false);
        const marginVertexIdBuffer =  new THREE.BufferAttribute(new Uint32Array(marginVertexIdArray), 4, false);
        const marginParamsBuffer =  new THREE.BufferAttribute(new Float32Array(marginParamsArray), 2, false);
        const marginSideBuffer =  new THREE.BufferAttribute(new Float32Array(marginSideArray), 4, false);
        const marginUvBuffer =  new THREE.BufferAttribute(new Float32Array(marginUvArray), 2, false);
        const marginGeometry = new THREE.BufferGeometry();
        marginGeometry.setAttribute('position', marginPositionBuffer);
        marginGeometry.setAttribute('vertexIds', marginVertexIdBuffer);
        marginGeometry.setAttribute('params', marginParamsBuffer);
        marginGeometry.setAttribute('sideData', marginSideBuffer);
        marginGeometry.setAttribute('uv', marginUvBuffer);
        marginGeometry.setIndex(marginIndices);

        this.object = new THREE.Mesh(marginGeometry, MedusaBellMargin.material);
        this.object.frustumCulled = false;

        this.object.onBeforeRender = () => {
            Medusa.uniforms.phase.value = this.medusa.phase;
            Medusa.uniforms.matrix.value.copy(this.medusa.transformationObject.matrix);
        }

        this.bellMarginRows = bellMarginRows;
        this.bellMarginWidth = bellMarginWidth;
    }
}