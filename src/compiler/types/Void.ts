import { Type } from "./Type";

export class VoidType extends Type {
    static DEFINITION = new VoidType;

    getName(): string {
        return "void";
    }

    isEquivalentTo(other: Type): boolean {
        return other instanceof VoidType;
    }
}