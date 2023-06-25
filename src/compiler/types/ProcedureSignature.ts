import { ParameterSymbol, ProcedureSymbol } from "../definitions";
import { Type } from "./Type";

export class ProcedureSignatureTypeParameter {
    constructor(
        public readonly parameterSymbol: ParameterSymbol|undefined,
        public readonly type: Type
    ) { }
}

export class ProcedureSignatureType extends Type {
    constructor(
        public readonly functionSymbol: ProcedureSymbol|undefined,
        public readonly params: ProcedureSignatureTypeParameter[],
        public readonly returnType: Type
    ) { super(); }

    getName(): string {
        return "proc(" + this.params.map(arg => arg.type.getName()).join(", ") + "): " + this.returnType.getName();
    }

    isEquivalentTo(other: Type): boolean {
        if (other instanceof ProcedureSignatureType) {
            if (!other.returnType.isEquivalentTo(this.returnType)) return false;
            if (other.params.length !== this.params.length) return false;

            for (let i = 0; i < this.params.length; i++) {
                if (!this.params[i].type.isEquivalentTo(other.params[i].type)) return false;
            }

            return true;
        }

        return false;
    }
}