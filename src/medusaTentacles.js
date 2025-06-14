import * as THREE from "three/webgpu";
import {
    Fn,
    attribute,
    varying,
    vec3,
    transformNormalToView,
    cos, sin, float, mrt, vec4
} from "three/tsl";

import {conf} from "./conf";
import {Medusa} from "./medusa";
import {Background} from "./background";


export class MedusaTentacles {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
    }

    static createMaterial(physics) {
        const { roughness, metalness, transmission, color, iridescence, iridescenceIOR, clearcoat, clearcoatRoughness } = conf;
        MedusaTentacles.material = new THREE.MeshPhysicalNodeMaterial({
            //side: THREE.Single,
            roughness, metalness, iridescence, iridescenceIOR,
            color: 0xddddff,
            opacity: 0.2,
            transparent: true,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        MedusaTentacles.material.positionNode = Fn(() => {
            const vertexIds = attribute('vertexIds');
            const angle = attribute('angle');
            const width = attribute('width');
            const p0 = physics.positionData.element(vertexIds.x).xyz.toVar();
            const p1 = physics.positionData.element(vertexIds.y).xyz.toVar();
            const tangent = p1.sub(p0);
            const bitangent = tangent.cross(vec3(1,0,0)).normalize();
            const bitangent2 = tangent.cross(bitangent).normalize();

            const normal = sin(angle).mul(bitangent).toVar();
            normal.addAssign(cos(angle).mul(bitangent2));
            normal.assign(normal.normalize());

            const position = p0.add(p1).mul(0.5).add(normal.mul(width));
            vNormal.assign(transformNormalToView(normal));
            return position;
        })();
        //Medusa.tentacleMaterial.normalNode = normalMap(texture(Medusa.normalMap), vec2(0.8,-0.8)); //transformNormalToView(vNormal);
        MedusaTentacles.material.normalNode = vNormal.normalize();
        MedusaTentacles.material.emissiveNode = Fn(() => {
            return Medusa.uniforms.charge.mul(0.5);
        })();
        MedusaTentacles.material.opacityNode = Fn(() => {
            const fog = Background.getFog;
            return float(0.5).mul(fog);
        })();
        MedusaTentacles.material.mrtNode = mrt( {
            bloomIntensity: Fn(() => {
                const glowIntensity = Background.getFog * (1.0 + Medusa.uniforms.charge * 2);
                const charge = Medusa.uniforms.charge;
                return vec4(glowIntensity, charge, 0, 1);
            })()
        } );

    }

    createGeometry() {
        const { bell, physics, medusaId, bridge } = this.medusa;
        const { bellMarginRows, bellMarginWidth } = bell.margin;
        /* ##################################
        tentacles
        #################################### */
        const tentacleNum = 20;
        const tentacleLength = 20;
        const tentacles = [];
        for (let x = 0; x < tentacleNum; x++) {
            const tentacle = [];
            const springStrength = 0.005;

            tentacle.push(bellMarginRows[bellMarginRows.length - 3][Math.floor(x * (bellMarginWidth / tentacleNum))]);

            const prePivot = bellMarginRows[bellMarginRows.length - 2][Math.floor(x * (bellMarginWidth / tentacleNum))];
            tentacle.push(prePivot);

            const pivot = bellMarginRows[bellMarginRows.length - 1][Math.floor(x * (bellMarginWidth / tentacleNum))];
            const { offset, zenith, azimuth } = pivot;
            tentacle.push(pivot);
            const segmentLength = 0.24 + Math.random()*0.06;
            for (let y = 3; y < tentacleLength; y++) {
                const vertex = physics.addVertex(new THREE.Vector3(), false);
                offset.y -= segmentLength;
                bridge.registerVertex(medusaId, vertex, zenith, azimuth, false, offset.clone(), 0, false);
                physics.addSpring(tentacle[y-1], vertex, springStrength, 1);
                if (y > 1) {
                    physics.addSpring(tentacle[y-2], vertex, springStrength, 1);
                }
                tentacle.push(vertex);
            }
            tentacles.push(tentacle);
        }
        this.tentacles = tentacles;

        const tentaclePositionArray = [];
        const tentacleVertexIdArray = [];
        const tentacleWidthArray = [];
        const tentacleAngleArray = [];
        const tentacleIndices = [];
        let tentacleVertexCount = 0;
        const addTentacleVertex = (v0, v1, angle, width) => {
            const ptr = tentacleVertexCount;

            tentaclePositionArray[ptr * 3 + 0] = 0;
            tentaclePositionArray[ptr * 3 + 1] = 0;
            tentaclePositionArray[ptr * 3 + 2] = 0;
            tentacleVertexIdArray[ptr * 2 + 0] = v0.id;
            tentacleVertexIdArray[ptr * 2 + 1] = v1.id;
            tentacleAngleArray[ptr] = angle;
            tentacleWidthArray[ptr] = width;

            tentacleVertexCount++;
            return ptr;
        };

        const tentacleRadialSegments = 6;
        const tentacleRadius = 0.015;
        for (let i = 0; i < tentacleNum; i++) {
            const tentacleVerticeRows = [];
            for (let y = 1; y < tentacleLength; y++) {
                const row = [];
                const v0 = tentacles[i][y-1];
                const v1 = tentacles[i][y];
                for (let x = 0; x < tentacleRadialSegments; x++) {
                    const angle = (x / tentacleRadialSegments) * Math.PI * 2;
                    const width = y === 1 ? 0 : Math.sqrt(1.0 - (y / (tentacleLength-1))) * tentacleRadius;
                    const vertex = addTentacleVertex(v0,v1,angle,width);
                    row.push(vertex);
                }
                row.push(row[0]);
                tentacleVerticeRows.push(row);
            }

            for (let y = 1; y < tentacleLength - 1; y++) {
                for (let x = 0; x < tentacleRadialSegments; x++) {
                    const v0 = tentacleVerticeRows[y - 1][x];
                    const v1 = tentacleVerticeRows[y - 1][x + 1];
                    const v2 = tentacleVerticeRows[y][x];
                    const v3 = tentacleVerticeRows[y][x + 1];
                    tentacleIndices.push(v2, v1, v0);
                    tentacleIndices.push(v1, v2, v3);
                }
            }
        }

        const tentaclePositionBuffer =  new THREE.BufferAttribute(new Float32Array(tentaclePositionArray), 3, false);
        const tentacleVertexIdBuffer =  new THREE.BufferAttribute(new Uint32Array(tentacleVertexIdArray), 2, false);
        const tentacleWidthBuffer =  new THREE.BufferAttribute(new Float32Array(tentacleWidthArray), 1, false);
        const tentacleAngleBuffer =  new THREE.BufferAttribute(new Float32Array(tentacleAngleArray), 1, false);
        const tentacleGeometry = new THREE.BufferGeometry();
        tentacleGeometry.setAttribute('position', tentaclePositionBuffer);
        tentacleGeometry.setAttribute('vertexIds', tentacleVertexIdBuffer);
        tentacleGeometry.setAttribute('width', tentacleWidthBuffer);
        tentacleGeometry.setAttribute('angle', tentacleAngleBuffer);
        tentacleGeometry.setIndex(tentacleIndices);

        this.object = new THREE.Mesh(tentacleGeometry, MedusaTentacles.material);
        this.object.frustumCulled = false;

        this.object.renderOrder = 22;
        this.object.onBeforeRender = () => {
            Medusa.uniforms.charge.value = this.medusa.charge;
        }

    }
}