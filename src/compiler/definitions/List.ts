import { Block, BlockInput, BlockRef, NumberValue, Shadowed } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { Definition } from "./Definition";

export class ListDefinition extends Definition {
    constructor(public readonly name: string, public readonly id: string, public readonly sliceStart: number, public readonly sliceSize: number) { 
        super(sliceSize);
    }

    toJSON() {
        return [ this.name, [] ];
    }

    sliceAtOffset(sliceStart: number, sliceSize: number) {
        return new ListDefinition(this.name, this.id, this.sliceStart + sliceStart, sliceSize);
    }

    generateInputs(uniqueIds: IdGenerator) {
        const items = [];
        for (let i = 0; i < this.sliceSize; i++) {
            items.push(this.generateInputAtOffset(uniqueIds, i));
        }
        return items;
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockRef {
        return new BlockRef(
            new Block(
                uniqueIds.nextId(),
                "data_itemoflist",
                { INDEX: new Shadowed(undefined, new NumberValue(this.sliceStart + offset + 1)) },
                { LIST: [ this.name, this.id ] }
            )
        );
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[], requireValues = true): Block[] {
        const blocks = [];
        blocks.push(
            new Block(
                uniqueIds.nextId(),
                "data_deletealloflist",
                { },
                { LIST: [ this.name, this.id ] }
            )
        );
        for (let i = 0; i < this.size; i++) {
            if (values[i] === undefined) {
                if (requireValues) throw new Error("Assertion failed; not enough values");
                break;
            }
            const block = new Block(
                uniqueIds.nextId(),
                "data_addtolist",
                {
                    ITEM: new Shadowed(undefined, values[i])
                },
                { LIST: [ this.name, this.id ] }
            );
            blocks.push(block);
        }
        return blocks;
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        const block = new Block(
            uniqueIds.nextId(),
            "data_replaceitemoflist",
            {
                INDEX: new Shadowed(undefined, new NumberValue(this.sliceStart + offset + 1)),
                ITEM: new Shadowed(undefined, value)
            },
            { LIST: [ this.name, this.id ] }
        );
        return [ block ];
    }
}