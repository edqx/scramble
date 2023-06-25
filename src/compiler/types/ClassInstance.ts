import { ClassSymbol, FieldSymbol, ProcedureSymbol } from "../definitions";
import { Type } from "./Type";

export class ClassInstanceTypeField {
    constructor(
        public readonly offset: number,
        public readonly fieldSymbol: FieldSymbol,
        public readonly type: Type
    ) { }
}

export class ClassInstanceTypeMethod {
    constructor(
        public readonly methodSymbol: ProcedureSymbol,
        public readonly type: Type
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
        this.size = lastField === undefined ? 1 : Math.max(1, lastField.offset + lastField.type.size);
    }
    
    isEquivalentTo(other: Type): boolean {
        return false;
    }

    getName(): string {
        return this.classSymbol.name;
    }
}