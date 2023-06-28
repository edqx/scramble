import { Block, BlockRef } from "../../scratch";
import { BroadcastDefinition } from "./Broadcast";
import { Definition } from "./Definition";
import { ListDefinition } from "./List";
import { VariableDefinition } from "./Variable";

export class Stack {
    orderedStackBlocks: Block[];

    constructor(public readonly sprite: Sprite) {
        this.orderedStackBlocks = [];
    }

    applySubstack(subStack: Stack) {
        this.orderedStackBlocks.push(...subStack.orderedStackBlocks);
    }
}

export class Sprite {
    variables: Map<string, VariableDefinition>;
    lists: Map<string, ListDefinition>;
    broadcasts: Map<string, BroadcastDefinition>;
    blocks: Map<string, Block>;

    globals: Map<string, ListDefinition|VariableDefinition>;

    constructor() {
        this.variables = new Map;
        this.lists = new Map;
        this.broadcasts = new Map;
        this.blocks = new Map;

        this.globals = new Map;
    }

    createGlobal<T extends ListDefinition|VariableDefinition>(name: string, creator: () => T) {
        const existingGlobal = this.globals.get(name);
        if (existingGlobal !== undefined) return existingGlobal as T;

        const newGlobal = creator();
        this.globals.set(name, newGlobal);
        return newGlobal;
    }
    
    createVariable(id: string, name: string) {
        const variable = new VariableDefinition(name, id);
        this.variables.set(id, variable);
        return variable;
    }
    
    createList(id: string, name: string, size: number) {
        const list = new ListDefinition(name, id, 0, size);
        this.lists.set(id, list);
        return list;
    }
    
    createBroadcast(id: string, name: string) {
        const broadcast = new BroadcastDefinition(name, id);
        this.broadcasts.set(id, broadcast);
        return broadcast;
    }

    createStack() {
        return new Stack(this);
    }

    protected _applySubBlocks(block: Block) {
        const inputs = Object.entries(block.inputs);
        for (const [ , input ] of inputs) {
            if (input.base instanceof BlockRef) {
                this.blocks.set(input.base.block.id, input.base.block);
                this._applySubBlocks(input.base.block);
            }
            if (input.overlay instanceof BlockRef) {
                this.blocks.set(input.overlay.block.id, input.overlay.block);
                this._applySubBlocks(input.overlay.block);
            }
        }
    }

    applyStack(stack: Stack, hatBlock?: Block) {
        let last: Block|undefined = hatBlock;
        if (hatBlock !== undefined) {
            this.blocks.set(hatBlock.id, hatBlock);
            this._applySubBlocks(hatBlock);
        }
        for (const block of stack.orderedStackBlocks) {
            if (last !== undefined) {
                last.setNextId(block.id);
                block.setParentId(last.id);
            }
            this.blocks.set(block.id, block);
            this._applySubBlocks(block);
            last = block;
        }
    }
}