import { ParameterSymbol, ProcedureSymbol } from "../symbols";
import { UnresolvedType } from "./This";
import { Type } from "./Type";

export class ProcedureSignatureTypeParameter {
    constructor(
        public readonly parameterSymbol: ParameterSymbol|undefined,
        public readonly type: Type|UnresolvedType
    ) { }
}

export class ProcedureSignatureType extends Type {
    constructor(
        public readonly functionSymbol: ProcedureSymbol|undefined,
        public readonly params: ProcedureSignatureTypeParameter[],
        public readonly returnType: Type|UnresolvedType
    ) { super(); }

    getName(): string {
        return "proc(" + this.params.map(arg => arg.type.getName()).join(", ") + "): " + this.returnType.getName();
    }

    isEquivalentTo(other: Type): boolean {
        if (other instanceof ProcedureSignatureType) {
            if (this.returnType instanceof UnresolvedType) throw new Error("Edward you need to handle this somehow.");
            if (!other.returnType.isEquivalentTo(this.returnType)) return false;
            if (other.params.length !== this.params.length) return false;

            for (let i = 0; i < this.params.length; i++) {
                const paramType = other.params[i].type;
                if (paramType instanceof UnresolvedType) throw new Error("Edward you need to handle this somehow.");
                if (!this.params[i].type.isEquivalentTo(paramType)) return false;
            }

            return true;
        }

        return false;
    }
}