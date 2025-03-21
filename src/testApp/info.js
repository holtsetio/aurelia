import {Pane} from 'tweakpane';
import * as InfodumpPlugin from 'tweakpane-plugin-infodump';

export class Info {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);
        container.style.position = 'absolute';
        container.style.left = '8px';
        container.style.bottom = '8px';
        container.style.maxWidth = '512px';
        container.style.width = 'calc(100% - 16px)';

        const pane = new Pane({ container })
        pane.registerPlugin(InfodumpPlugin);
        this.pane = pane;

        const info = pane.addFolder({
            title: "info",
            expanded: false,
        });
        info.addBlade({
            view: "infodump",
            content: "Completely procedural jellyfish, with verlet physics and fake volumetric lighting. Rendered in WebGPU using [ThreeJS](https://threejs.org) TSL.\n\n" +
                "Fake caustics based on this [shadertoy](https://www.shadertoy.com/view/MdKXDm) by Dave Hoskins.\n\n" +
                "[> Other experiments](https://holtsetio.com)",
            markdown: true,
        })
    }
}