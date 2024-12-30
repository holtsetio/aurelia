import * as THREE from 'three';
import dat from "dat.gui/src/dat";
import chroma from "chroma-js";
import {noise3D} from "./common/noise";

dat.GUI.prototype.addLog = function (object, property, min, max, step) {
    const num_controller = this.add(object, property, min, max, step);
    const minv = Math.log(min);
    const maxv = Math.log(max);
    const scale = (maxv - minv) / (max - min);

    const onChangeFunc = num_controller.onChange;
    num_controller.onChange = (func) => {
        onChangeFunc(value => {
            const ret = Math.exp(minv + scale * (value - min));
            object[property] = ret;
            func && func(ret);
        })
    }
    num_controller.onChange();


    const updateDisplay = num_controller.updateDisplay;
    num_controller.updateDisplay = () => {
        updateDisplay();
        const invertLog = (Math.log(num_controller.getValue()) - minv) / scale + min;
        const pct = (invertLog - min) / (max - min);
        num_controller.__foreground.style.width = pct * 100 + '%';
    }

    num_controller.updateDisplay();
    return num_controller;
}

class Conf {
    gui = null;


    roughness = 0.55;
    metalness = 0.4;
    transmission = 0.85;
    color = 0xf4aaff;
    iridescence = 0.5;
    iridescenceIOR = 1.5;
    clearcoat = 0.0;
    clearcoatRoughness = 0.3;
    clearcoatColor = 0xFFFFFF;
    normalMapScale = 0.1;

    lightSeed = 0;

    animateLights = true;

    bloom = true;
    bloomStrength = 0.05;
    bloomRadius = 0.4;
    bloomThreshold = 0;


    runSimulation = true;
    showVerletSprings = false;

    constructor() {
        const gui = new dat.GUI()
        this.gui = gui;

        this.gui.add(this, "runSimulation");
        this.gui.add(this, "showVerletSprings");

        const materialFolder = gui.addFolder(`Material`);
        materialFolder.addColor(this, "color");
        materialFolder.add(this, "transmission", 0, 1, 0.01);
        materialFolder.add(this, "metalness", 0, 1, 0.01);
        materialFolder.add(this, "roughness", 0, 1, 0.01);
        materialFolder.add(this, "iridescence", 0, 1, 0.01);
        materialFolder.add(this, "iridescenceIOR", 1.0, 2.333, 0.01);
        materialFolder.add(this, "clearcoat", 0, 1, 0.01);
        materialFolder.add(this, "clearcoatRoughness", 0, 1, 0.01);
        materialFolder.addColor(this, "clearcoatColor");
        materialFolder.add(this, "normalMapScale", 0, 1, 0.01);


        const postProcessingFolder = gui.addFolder(`Post Processing`);
        postProcessingFolder.add(this, "bloom").onChange((value) => value ? this.bloomFolder.show() : this.bloomFolder.hide());
        this.bloomFolder = postProcessingFolder.addFolder(`Bloom`);
        this.bloomFolder.add(this, "bloomStrength", 0, 1, 0.01);
        this.bloomFolder.add(this, "bloomRadius", 0, 1, 0.01);
        this.bloomFolder.add(this, "bloomThreshold", 0, 1, 0.01);
    }

    update() {

    }

}
export const conf = new Conf();