import {cos, float, mix, sin, vec3} from "three/tsl";

export const getBellPosition = (time, t, angle) => {
    const phase = time.mul(0.2).mul(Math.PI*2).toVar();
    const yoffset = sin(phase.add(2.8)).mul(0.5);
    phase.subAssign(mix(0.0, t.mul(0.95), t));
    phase.addAssign(Math.PI * 0.5);
    const xr = sin(phase).mul(0.3).add(1.3);
    const yr = float(1.0);
    const polarAngle = sin(phase.add(3.0)).mul(0.15).add(0.5).mul(t).mul(Math.PI);
    const result = vec3(0).toVar();
    result.x.assign(sin(polarAngle).mul(xr));
    result.y.assign(cos(polarAngle).mul(yr).add(yoffset));
    result.z.assign(cos(angle).mul(result.x));
    result.x.assign(sin(angle).mul(result.x));
    return result;
};