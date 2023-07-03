import { ClassSymbol, FieldSymbol, ProcedureSymbol } from "../symbols";
import { ProcedureSignatureType } from "./ProcedureSignature";
import { UnresolvedType } from "./This";
import { Type } from "./Type";

export class ClassInstanceTypeField {
    constructor(
        public readonly offset: number,
        public readonly fieldSymbol: FieldSymbol,
        public readonly type: Type|UnresolvedType
    ) { }
}

export class ClassInstanceTypeMethod {
    constructor(
        public readonly methodSymbol: ProcedureSymbol,
        public readonly type: ProcedureSignatureType
    ) { }
}

export class ClassInstanceType extends Type {
    constructor(
        public readonly classSymbol: ClassSymbol,
        public readonly fields: Map<string, ClassInstanceTypeField>,
        public readonly methods: Map<string, ClassInstanceTypeMethod>
    ) {
        super();

        const allFields = [...fields.values()]; // use offset of last field to get total size
        const lastField = allFields[allFields.length - 1];
        if (lastField.type instanceof UnresolvedType) throw new Error("Assertion error; cannot calculate size of fields with recursive types");
        this.size = lastField === undefined ? 1 : Math.max(1, lastField.offset + lastField.type.getSize());
    }
    
    isEquivalentTo(other: Type): boolean {
        return this === other;
    }

    getName(): string {
        return this.classSymbol.name;
    }
}