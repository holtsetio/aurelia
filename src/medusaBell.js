import * as THREE from "three/webgpu";

import {MedusaBellGeometry} from "./medusaBellGeometry";
import {MedusaBellBottom} from "./medusaBellBottom";
import {MedusaBellMargin} from "./medusaBellMargin";
import {MedusaBellTop} from "./medusaBellTop";

export class MedusaBell {
    object = null;

    constructor(medusa) {
        this.medusa = medusa;
        this.top = new MedusaBellTop(medusa);
        this.bottom = new MedusaBellBottom(medusa);
        this.margin = new MedusaBellMargin(medusa);
        this.geometryOutside = new MedusaBellGeometry(medusa, true);
        this.geometryInside = new MedusaBellGeometry(medusa, false);
    }

    createGeometry() {
        this.top.createGeometry();
        this.bottom.createGeometry();
        this.margin.createGeometry();

        this.object = new THREE.Object3D();

        this.geometryOutside.bakeGeometry();
        this.geometryInside.bakeGeometry();

        this.geometryInside.object.renderOrder = 20;
        this.geometryOutside.object.renderOrder = 23;

        this.object.add(this.geometryOutside.object);
        this.object.add(this.geometryInside.object);
        this.object.frustumCulled = false;
    }
}