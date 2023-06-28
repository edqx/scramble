import { Block, BlockRef } from "../../scratch";
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
    broadcasts: Map<string, [ string, string ]>;
    blocks: Map<string, Block>;

    globals: Map<string, string>;

    constructor() {
        this.variables = new Map;
        this.lists = new Map;
        this.broadcasts = new Map;
        this.blocks = new Map;

        this.globals = new Map;
    }

    createGlobal(name: string, id: string) {
        this.globals.set(id, name);
    }
    
    createVariable(id: string, name: string) {
        const variable = new VariableDefinition(id, name);
        this.variables.set(id, variable);
        return variable;
    }
    
    createList(id: string, name: string, size: number) {
        const list = new ListDefinition(id, name, 0, size);
        this.lists.set(id, list);
        return list;
    }
    
    createBroadcast(id: string, name: string) {
        const broadcast: [ string, string ] = [ id, name ];
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
            }
            if (input.overlay instanceof BlockRef) {
                this.blocks.set(input.overlay.block.id, input.overlay.block);
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