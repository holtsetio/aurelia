import * as THREE from "three/tsl";

export class WgpuBuffer {
    length = 0;
    name = "";
    wgputype = "";
    itemsize = 0;
    typeclass = null;
    array = null;
    buffer = null;
    storageObject = null;
    attributeObject = null;
    constructor(_length, _wgputype, _itemsize, _typeclass = Float32Array, _name = "", instanced = false) {
        this.length = _length;
        this.name = _name;
        this.wgputype = _wgputype;
        this.itemsize = _itemsize;
        this.typeclass = _typeclass;
        this.array = new this.typeclass(this.length * this.itemsize);
        if (instanced) {
            this.buffer = new THREE.StorageInstancedBufferAttribute(this.array, this.itemsize, this.typeclass);
        } else {
            this.buffer = new THREE.StorageBufferAttribute(this.array, this.itemsize, this.typeclass);
        }
        this.buffer.name = this.name;
    }
    async read(renderer) {
        return new this.typeclass(await renderer.getArrayBufferAsync(this.buffer));
    }
    get storage() {
        if (!this.storageObject) {
            this.storageObject = THREE.storage(this.buffer, this.wgputype, this.length);
        }
        return this.storageObject;
    }
    toReadOnly() {
        this.storage.toReadOnly();
    }
    toReadWrite() {
        this.storage.setAccess("storage");
    }
    get attribute() {
        if (!this.attributeObject) {
            this.attributeObject = this.storage.toAttribute();
        }
        return this.attributeObject;
    }
}