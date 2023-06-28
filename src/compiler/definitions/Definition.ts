import { Block, BlockInput } from "../../scratch";
import { IdGenerator } from "../IdGenerator";

export abstract class Definition {
    constructor(public readonly size: number) {}

    abstract generateInputs(uniqueIds: IdGenerator): BlockInput[];
    abstract generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput;

    abstract generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[];
    abstract generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[];
}