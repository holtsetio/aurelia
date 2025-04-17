# Aurelia

Realtime procedural jellyfish in the browser using three.js WebGPURenderer

![aurelia](https://github.com/user-attachments/assets/21b278f3-f42b-4b43-aa06-1ed5d734c949)

## Implementation details

The bell is formed by a sinusoidally contracting hemisphere, while the bell seam, oral arms and tentacles are simulated using a verlet particle system that is evaluated on the GPU with compute shaders. All textures and the fake volumetric lighting are also procedurally generated in the shaders.

## How to run
```
npm install
npm run dev
```
