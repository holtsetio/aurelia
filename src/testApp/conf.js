import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

class Conf {
    gui = null;


    roughness = 0.55;
    metalness = 0.2;
    transmission = 0.7;
    color = 0xffffff; //0xf4aaff;
    iridescence = 0.0;
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

    constructor() { }

    init() {
        const gui = new Pane()
        gui.registerPlugin(EssentialsPlugin);

        const stats = gui.addFolder({
            title: "stats",
            expanded: false,
        });
        this.fpsGraph = stats.addBlade({
            view: 'fpsgraph',
            label: 'fps',
            rows: 2,
        });

        /*const settings = gui.addFolder({
            title: "settings",
            expanded: false,
        });
        settings.addBinding(this, "wireframe");*/

        this.gui = gui;
    }

    update() {
    }

    begin() {
        this.fpsGraph.begin();
    }
    end() {
        this.fpsGraph.end();
    }

}
export const conf = new Conf();