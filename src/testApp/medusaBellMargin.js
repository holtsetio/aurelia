import * as THREE from "three/webgpu";

export class MedusaBellMargin {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    createGeometry() {
        const { bell, subdivisions, physics, bridge, medusaId } = this.medusa;
        const { geometryOutside, geometryInside } = bell;
        const { vertexRows } = bell.top;

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

        const marginOuterVertexRows = [];
        const marginInnerVertexRows = [];

        const outerSide = new THREE.Vector3(0,0,1);
        const innerSide = new THREE.Vector3(0,0,-1);
        const downSide = new THREE.Vector3(0,1,0);

        {
            // first bell margin row
            const innerRow = []
            const outerRow = []
            for (let x = 0; x < bellMarginWidth; x++) {
                const outerVertex = vertexRows[vertexRows.length - 1][x];
                const innerVertex = geometryInside.addVertexFromParams(outerVertex.zenith, outerVertex.azimuth, innerSide, 0);
                outerRow.push(outerVertex.ptr);
                innerRow.push(innerVertex);
            }
            outerRow.push(outerRow[0]);
            innerRow.push(innerRow[0]);
            marginOuterVertexRows.push(outerRow);
            marginInnerVertexRows.push(innerRow);
        }

        const downRowOutside = [];
        const downRowInside = [];
        const marginDepth = 0.025;
        for (let y = 2; y < bellMarginHeight; y++) {
            const innerRow = []
            const outerRow = []
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = bellMarginRows[y-1][x];
                const v1 = bellMarginRows[y-1][x+1];
                const v2 = bellMarginRows[y][x];
                const v3 = bellMarginRows[y][x+1];
                const outerVertex = geometryOutside.addVertexFromVertices(v0,v1,v2,v3, outerSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                const innerVertex = geometryInside.addVertexFromVertices(v0,v1,v2,v3, innerSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                outerRow.push(outerVertex);
                innerRow.push(innerVertex);
                if (y === bellMarginHeight - 1) {
                    const downVertexOutside = geometryOutside.addVertexFromVertices(v0,v1,v2,v3, downSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                    const downVertexInside = geometryInside.addVertexFromVertices(v0,v1,v2,v3, downSide, (y-1) / (bellMarginHeight - 2) * marginDepth);
                    downRowOutside.push(downVertexOutside);
                    downRowInside.push(downVertexInside);
                }
            }
            outerRow.push(outerRow[0]);
            innerRow.push(innerRow[0]);
            marginOuterVertexRows.push(outerRow);
            marginInnerVertexRows.push(innerRow);
        }
        downRowOutside.push(downRowOutside[0]);
        downRowInside.push(downRowInside[0]);

        const marginVertexRowsOutside = [...marginOuterVertexRows, downRowOutside];
        for (let y = 1; y < marginVertexRowsOutside.length; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = marginVertexRowsOutside[y - 1][x];
                const v1 = marginVertexRowsOutside[y - 1][x + 1];
                const v2 = marginVertexRowsOutside[y][x];
                const v3 = marginVertexRowsOutside[y][x + 1];
                geometryOutside.addFace(v2, v1, v0);
                geometryOutside.addFace(v1, v2, v3);
            }
        }

        const marginVertexRowsInside = [downRowInside, ...(marginInnerVertexRows.toReversed())];
        for (let y = 1; y < marginVertexRowsInside.length; y++) {
            for (let x = 0; x < bellMarginWidth; x++) {
                const v0 = marginVertexRowsInside[y - 1][x];
                const v1 = marginVertexRowsInside[y - 1][x + 1];
                const v2 = marginVertexRowsInside[y][x];
                const v3 = marginVertexRowsInside[y][x + 1];
                geometryInside.addFace(v2, v1, v0);
                geometryInside.addFace(v1, v2, v3);
            }
        }

        this.bellMarginRows = bellMarginRows;
        this.bellMarginWidth = bellMarginWidth;
    }
}