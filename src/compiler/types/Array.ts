import { UnresolvedType } from "./This";
import { Type } from "./Type";

export class ArrayType extends Type {
    constructor(
        public readonly elementType: Type,
        public readonly capacity: number|undefined
    ) {
        super();

        this.size = this.capacity === undefined ? 0 : this.elementType.getSize() * this.capacity;
    }

    getSize(): number {
        if (this.capacity === undefined) throw new Error("Cannot calculate size of dynamic array");

        return this.size;
    }
    
    isEquivalentTo(other: Type): boolean {
        if (!(other instanceof ArrayType)) return false;

        if (!this.elementType.isEquivalentTo(other.elementType)) return false;

        if (other.capacity === undefined || this.capacity === undefined) return true;

        return this.capacity === other.capacity;
    }

    getName(): string {
        return this.elementType.getName() + "[" + (this.capacity === undefined ? "" : this.capacity) + "]";
    }
}