import { Shadowed } from "./shadow";

export class Block {
    constructor(public readonly opcode: string, public readonly inputs: Record<string, Shadowed> = {}, fields: Record<string, Shadowed> = {}) {}
}