import { Block, BroadcastDefinition, ListDefinition, VariableDefinition } from ".";

export class Stack {
    orderedStackBlocks: Block[];
    subBlocks: Block[];

    constructor(public readonly sprite: Sprite) {
        this.orderedStackBlocks = [];
        this.subBlocks = [];
    }

    applySubstack(subStack: Stack) {
        this.orderedStackBlocks.push(...subStack.orderedStackBlocks);
        this.subBlocks.push(...subStack.subBlocks);
    }
}

export class Sprite {
    variables: Map<string, VariableDefinition>;
    lists: Map<string, ListDefinition>;
    broadcasts: Map<string, BroadcastDefinition>;
    blocks: Map<string, Block>;

    constructor() {
        this.variables = new Map;
        this.lists = new Map;
        this.broadcasts = new Map;
        this.blocks = new Map;
    }
    
    createVariable(id: string, name: string) {
        const variable = new VariableDefinition(id, name, "");
        this.variables.set(id, variable);
        return variable;
    }
    
    createList(id: string, name: string) {
        const list = new ListDefinition(id, name, []);
        this.lists.set(id, list);
        return list;
    }
    
    createBroadcast(id: string, name: string) {
        const broadcast = new BroadcastDefinition(id, name);
        this.broadcasts.set(id, broadcast);
        return broadcast;
    }

    createStack() {
        return new Stack(this);
    }

    applyStack(stack: Stack, hatBlock?: Block) {
        let last: Block|undefined = hatBlock;
        for (const block of stack.orderedStackBlocks) {
            if (last !== undefined) {
                last.setNextId(block.id);
                block.setParentId(last.id);
            }
            this.blocks.set(block.id, block);
            last = block;
        }
        for (const block of stack.subBlocks) {
            this.blocks.set(block.id, block);
        }
    }
}