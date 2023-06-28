import { Block, BlockInput } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { Definition } from "./Definition";

export class BroadcastDefinition extends Definition {
    constructor(public readonly name: string, public readonly id: string) { 
        super(1);
    }

    generateInputs(uniqueIds: IdGenerator): BlockInput[] {
        throw new Error("Assertion failed; cannot get value of broadcast definition");
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput {
        throw new Error("Assertion failed; cannot get value of broadcast definition");
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[] {
        throw new Error("Assertion failed; cannot instantiate broadcast definition");
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        throw new Error("Assertion failed; cannot set value of broadcast definition");
    }
}