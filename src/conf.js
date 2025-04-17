import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

class Conf {
    gui = null;

    roughness = 0.4;
    metalness = 0.2;
    transmission = 0.7;
    color = 0xffffff; //0xf4aaff;
    iridescence = 0.0;
    iridescenceIOR = 2.33;

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
        });*/
        //settings.addBinding(this, "wireframe");
        //settings.addBinding(this, "iridescence", { min: 0.01, max: 1.0, step: 0.01 });
        //settings.addBinding(this, "iridescenceIOR", { min: 1.00, max: 2.33, step: 0.01 });

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