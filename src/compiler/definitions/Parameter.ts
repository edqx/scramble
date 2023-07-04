import { ArrayReferenceExpression } from "../../expression";
import { Block, BlockInput, BlockRef } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { ArrayType, ClassInstanceType, Type } from "../types";
import { CompositeDefinition } from "./Composite";
import { Definition } from "./Definition";

export class ParameterDefinition extends Definition {
    protected static defineExpandedFromImplFields(parentName: string, type: ClassInstanceType, uniqueIds: IdGenerator) {
        const params: Definition[] = [];
        for (const [ , field ] of type.fields) {
            const fieldName = parentName + "_" + field.fieldSymbol.name;
            if (field.type instanceof ClassInstanceType) {
                params.push(new CompositeDefinition(field.type, this.defineExpandedFromImplFields(fieldName, field.type, uniqueIds)));
            } else if (field.type instanceof ArrayType) {
                params.push(new CompositeDefinition(field.type, this.defineExpandedFromImplArray(fieldName, field.type, uniqueIds)));
            } else {
                params.push(new ParameterDefinition(fieldName, uniqueIds.nextId()));
            }
        }
        return params;
    }

    protected static defineExpandedFromImplArray(parentName: string, type: ArrayType, uniqueIds: IdGenerator) {
        if (type.capacity === undefined) throw new Error("Assertion failed; cannot expand dynamic array");

        const params: Definition[] = [];
        for (let i = 0; i < type.capacity; i++) {
            const fieldName = parentName + "_" + i;
            if (type.elementType instanceof ClassInstanceType) {
                params.push(new CompositeDefinition(type.elementType, this.defineExpandedFromImplFields(fieldName, type.elementType, uniqueIds)));
            } else if (type.elementType instanceof ArrayType) {
                params.push(new CompositeDefinition(type.elementType, this.defineExpandedFromImplArray(fieldName, type.elementType, uniqueIds)));
            } else {
                params.push(new ParameterDefinition(fieldName, uniqueIds.nextId()));
            }
        }
        return params;
    }

    static defineParametersForType(name: string, type: Type, uniqueIds: IdGenerator) {
        console.log(name, type);
        if (type instanceof ClassInstanceType) {
            return new CompositeDefinition(type, this.defineExpandedFromImplFields(name, type, uniqueIds));
        }

        if (type instanceof ArrayType) {
            return new CompositeDefinition(type, this.defineExpandedFromImplArray(name, type, uniqueIds));
        }

        if (type.getSize() === 1) {
            return new CompositeDefinition(type, [ new ParameterDefinition(name, uniqueIds.nextId()) ]);
        }

        const paramDefinitions: ParameterDefinition[] = [];
        for (let i = 0; i < type.getSize(); i++) {
            paramDefinitions.push(new ParameterDefinition(name + "_" + i, uniqueIds.nextId()));
        }
        return new CompositeDefinition(type, paramDefinitions);
    }

    constructor(public readonly name: string, public readonly id: string) { super(1); }

    generateInputs(uniqueIds: IdGenerator): BlockInput[] {
        return [ this.generateInputAtOffset(uniqueIds, 0) ];
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput {
        const block = new Block(
            uniqueIds.nextId(),
            "argument_reporter_string_number",
            {},
            {
                VALUE: [ this.name, null ]
            },
            true,
            false
        );

        return new BlockRef(block);
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[] {
        throw new Error("Assertion failed; cannot set parameter value");
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        throw new Error("Assertion failed; cannot set parameter value");
    }
}