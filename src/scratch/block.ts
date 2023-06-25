import { Shadowed } from "./shadow";

export class Block {
    parentId: string|undefined;
    nextId: string|undefined;

    constructor(
        public readonly id: string,
        public readonly opcode: string,
        public readonly inputs: Record<string, Shadowed> = {},
        public readonly fields: Record<string, [ string, string|null ]> = {},
        public readonly shadow = false,
        public readonly topLevel = false,
        public readonly mutation: Record<string, any>|undefined = undefined
    ) {}

    setParentId(parentId: string) {
        this.parentId = parentId;
    }

    setNextId(nextId: string) {
        this.nextId = nextId;
    }

    toJSON() {
        return {
            opcode: this.opcode,
            next: this.nextId || null,
            parent: this.parentId || null,
            inputs: this.inputs,
            fields: this.fields,
            shadow: this.shadow,
            topLevel: this.topLevel,
            x: 0,
            y: 0,
            mutation: this.mutation
        }
    }
}