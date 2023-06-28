import { KeywordExpression, StructFieldsExpression } from "../../expression";
import { Block, BlockInput } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { Definition } from "./Definition";

export class PresetDefinition extends Definition {
    constructor(public readonly value: BlockInput) { 
        super(1);
    }

    generateInputs(uniqueIds: IdGenerator) {
        return [ this.value ];
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput {
        return this.value;
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[] {
        throw new Error("Assertion failed; cannot instantiate preset definition");
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        throw new Error("Assertion failed; cannot set value of preset definition");
    }
}