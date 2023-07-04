import { Expression } from "../../expression";
import { Block, BlockInput, BlockRef, NumberValue, Shadowed } from "../../scratch";
import { IdGenerator } from "../IdGenerator";
import { Definition } from "./Definition";
import { PresetDefinition } from "./Preset";

export class ListDefinition extends Definition {
    constructor(
        public readonly name: string,
        public readonly id: string,
        public readonly sliceStart: Definition|number,
        public readonly sliceSize: number,
        public readonly isFullSize: boolean
    ) {
        super(sliceSize);
    }

    toJSON() {
        return [ this.name, [] ];
    }

    sliceAtOffset(sliceStart: Definition|number, sliceSize: number, uniqueIds: IdGenerator) {
        if (typeof this.sliceStart === "number" && typeof sliceStart === "number") {
            return new ListDefinition(this.name, this.id, this.sliceStart + sliceStart, sliceSize, sliceStart === 0 && sliceSize === this.sliceSize && this.isFullSize);
        } else {
            const offsetBlock = new Block(uniqueIds.nextId(), "operator_add", {
                NUM1: new Shadowed(undefined, typeof this.sliceStart === "number" ? new NumberValue(this.sliceStart) : this.sliceStart.generateInputAtOffset(uniqueIds, 0)),
                NUM2: new Shadowed(undefined, typeof sliceStart === "number" ? new NumberValue(sliceStart) : sliceStart.generateInputAtOffset(uniqueIds, 0))
            });
            return new ListDefinition(this.name, this.id, new PresetDefinition(new BlockRef(offsetBlock)), sliceSize, false);
        }
    }

    generateInputs(uniqueIds: IdGenerator) {
        const items = [];
        for (let i = 0; i < this.sliceSize; i++) {
            items.push(this.generateInputAtOffset(uniqueIds, i));
        }
        return items;
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockRef {
        if (typeof this.sliceStart === "number") {
            return new BlockRef(
                new Block(
                    uniqueIds.nextId(),
                    "data_itemoflist",
                    { INDEX: new Shadowed(undefined, new NumberValue(this.sliceStart + offset + 1)) },
                    { LIST: [ this.name, this.id ] }
                )
            );
        } else {
            const offsetBlock = new Block(uniqueIds.nextId(), "operator_add", {
                NUM1: new Shadowed(undefined, this.sliceStart.generateInputAtOffset(uniqueIds, 0)),
                NUM2: new Shadowed(undefined, new NumberValue(offset + 1))
            });
            return new BlockRef(
                new Block(
                    uniqueIds.nextId(),
                    "data_itemoflist",
                    { INDEX: new Shadowed(undefined, new BlockRef(offsetBlock)) },
                    { LIST: [ this.name, this.id ] }
                )
            );
        }
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[], requireValues = true): Block[] {
        if (!this.isFullSize) {
            const blocks = [];
            // for (let i = 0; i < this.size; i++) {
            //     blocks.push(new Block(uniqueIds.nextId(), "data_deleteoflist", {
            //         INDEX: new Shadowed(undefined, new NumberValue(this.sliceStart + 1))
            //     }, { LIST: [ this.name, this.id ] }));
            // }
            for (let i = 0; i < this.size; i++) {
                if (values[i] === undefined) {
                    if (requireValues) throw new Error("Assertion failed; not enough values");
                    break;
                }
                blocks.push(...this.generateSetValueAtOffset(uniqueIds, values[i], i));
            }
            return blocks;
        }

        const blocks = [];
        blocks.push(new Block(uniqueIds.nextId(), "data_deletealloflist", { }, {
            LIST: [ this.name, this.id ]
        }));
        for (let i = 0; i < this.size; i++) {
            if (values[i] === undefined) {
                if (requireValues) throw new Error("Assertion failed; not enough values");
                break;
            }
            const block = new Block(uniqueIds.nextId(), "data_addtolist", {
                ITEM: new Shadowed(undefined, values[i])
            }, { LIST: [ this.name, this.id ] });
            blocks.push(block);
        }
        return blocks;
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        if (typeof this.sliceStart === "number") {
            const block = new Block(uniqueIds.nextId(), "data_replaceitemoflist", {
                INDEX: new Shadowed(undefined, new NumberValue(this.sliceStart + offset + 1)),
                ITEM: new Shadowed(undefined, value)
            }, { LIST: [ this.name, this.id ] });
            return [ block ];
        } else {
            const offsetBlock = new Block(uniqueIds.nextId(), "operator_add", {
                NUM1: new Shadowed(undefined, this.sliceStart.generateInputAtOffset(uniqueIds, 0)),
                NUM2: new Shadowed(undefined, new NumberValue(offset + 1))
            });
            const block = new Block(uniqueIds.nextId(), "data_replaceitemoflist", {
                INDEX: new Shadowed(undefined, new BlockRef(offsetBlock)),
                ITEM: new Shadowed(undefined, value)
            }, { LIST: [ this.name, this.id ] });
            return [ block ];
        }
    }
}