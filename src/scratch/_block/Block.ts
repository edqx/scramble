import { Shadowed } from "../shadow";
import { FieldValue } from "../values";

export abstract class Block {
    constructor(public readonly opcode: string) {}

    abstract getFields(): Record<string, FieldValue>;
    abstract getInputs(): Record<string, Shadowed>;
}