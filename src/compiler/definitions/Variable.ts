import { Block, BlockInput, Shadowed, VariableValue } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { Definition } from "./Definition";

export class VariableDefinition extends Definition {
    constructor(public readonly name: string, public readonly id: string) { super(1); }
    
    toJSON() {
        return [ this.name, "" ];
    }

    generateInputs(uniqueIds: IdGenerator): BlockInput[] {
        return [ this.generateInputAtOffset(uniqueIds, 0) ];
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput {
        return new VariableValue(this.name, this.id);
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[] {
        if (values[0] === undefined) throw new Error("Assertion failed; not enough values");
        return this.generateSetValueAtOffset(uniqueIds, values[0], 0);
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        const block = new Block(uniqueIds.nextId(), "data_setvariableto", {
            VALUE: new Shadowed(undefined, value)
        }, { VARIABLE: [ this.name, this.id ] });
        return [ block ];
    }
}