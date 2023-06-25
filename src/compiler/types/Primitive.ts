import { Type } from "./Type";

export class PrimitiveType extends Type {
    static DEFINITIONS: Record<string, PrimitiveType> = {
        string: new PrimitiveType("string"),
        number: new PrimitiveType("number"),
        boolean: new PrimitiveType("boolean")
    };

    constructor(public readonly type: string) { super(); }

    getName(): string {
        return this.type;
    }

    isEquivalentTo(other: Type): boolean {
        return other instanceof PrimitiveType ? other.type === this.type : false;
    }
}