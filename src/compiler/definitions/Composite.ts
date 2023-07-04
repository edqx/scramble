import { ErrorCollector } from "../../errorCollector";
import { Block, BlockInput } from "../../scratch";
import { ExistingTypes } from "../ExistingTypes";
import { IdGenerator } from "../IdGenerator";
import { resolveThisType } from "../resolveSymbolType";
import { ClassInstanceType, Type } from "../types";
import { Definition } from "./Definition";
import { ListDefinition } from "./List";
import { Sprite } from "./Sprite";

export class CompositeDefinition extends Definition {
    constructor(public readonly type: Type, public readonly components: Definition[]) {
        super(type.getSize());
    }
    
    deepTraverseComponents(): Definition[] {
        const deepComponents = [];
        for (const component of this.components) {
            if (component instanceof CompositeDefinition) {
                deepComponents.push(...component.deepTraverseComponents());
            } else {
                deepComponents.push(component);
            }
        }
        return deepComponents;
    }

    assertSingle() {
        if (this.components.length === 0) throw new Error("Assertion failed; no definitions");
        if (this.components.length > 1) throw new Error("Assertion failed; multiple definitions");

        let definition = this.components[0];
        while (definition instanceof CompositeDefinition) {
            definition = definition.assertSingle();
        }
        return definition;
    }

    narrowCompositeToProperty(property: string, existingTypes: ExistingTypes, errorCollector: ErrorCollector, uniqueIds: IdGenerator) {
        if (!(this.type instanceof ClassInstanceType)) throw new Error("Assertion failed; inner type is not a struct");

        const field = this.type.fields.get(property);
        if (field === undefined) return undefined;

        const fieldType = resolveThisType(field.type, existingTypes, errorCollector);

        const components = [];
        const startFieldOffset = field.offset;
        const endFieldOffset = field.offset + fieldType.getSize();
        let i = 0;
        let searchOffset = 0;
        for (; i < this.components.length; i++) {
            const component = this.components[i];
            if (startFieldOffset >= searchOffset && startFieldOffset < searchOffset + component.size) {
                if (endFieldOffset <= searchOffset + component.size) {
                    if (component instanceof CompositeDefinition) {
                        const comp = new CompositeDefinition(fieldType, component.sliceAtOffsetAndSize(startFieldOffset - searchOffset, fieldType.getSize(), uniqueIds));
                        return comp;
                    } else if (component instanceof ListDefinition) {
                        return new CompositeDefinition(fieldType, [ component.sliceAtOffset(startFieldOffset - searchOffset, fieldType.getSize(), uniqueIds) ]);
                    }
                    return new CompositeDefinition(fieldType, [ component ]);
                }

                if (component instanceof ListDefinition) {
                    if (typeof component.sliceStart !== "number") throw new Error("Assertion failed; what?");
                    components.push(component.sliceAtOffset(searchOffset, component.sliceStart - startFieldOffset + searchOffset, uniqueIds));
                } else if (component instanceof CompositeDefinition) {
                    components.push(...component.sliceAtOffsetAndSize(searchOffset, component.size - searchOffset + startFieldOffset, uniqueIds));
                } else {
                    components.push(component);
                }

                break;
            }
            searchOffset += component.size;
        }
        for (; i < this.components.length; i++) {
            const component = this.components[i];
            if (endFieldOffset <= searchOffset + component.size) {
                if (component instanceof ListDefinition) {
                    components.push(component.sliceAtOffset(0, component.size - searchOffset + endFieldOffset, uniqueIds));
                } else if (component instanceof CompositeDefinition) {
                    components.push(...component.sliceAtOffsetAndSize(0, component.size - searchOffset + endFieldOffset, uniqueIds));
                } else {
                    components.push(component);
                }

                break;
            } else {
                components.push(component);
            }
            searchOffset += component.size;
        }
        return new CompositeDefinition(fieldType, components);
    }

    createRedefinition(uniqueIds: IdGenerator, name: string, sprite: Sprite) {
        if (this.size > 1) {
            return new CompositeDefinition(this.type, [ sprite.createList(uniqueIds.nextId(), name, this.size) ]);
        }

        return new CompositeDefinition(this.type, [ sprite.createVariable(uniqueIds.nextId(), name) ]);
    }

    generateInputs(uniqueIds: IdGenerator) {
        const items = [];
        for (const component of this.components) {
            items.push(...component.generateInputs(uniqueIds));
        }
        return items;
    }

    generateInputAtOffset(uniqueIds: IdGenerator, offset: number): BlockInput {
        let searchOffset = 0;
        for (const component of this.components) {
            if (offset >= searchOffset && offset < searchOffset + component.size) {
                return component.generateInputAtOffset(uniqueIds, offset - searchOffset);
            }

            searchOffset += component.size;
        }
        throw new Error("Assertion failed; Offset beyond size of composite");
    }

    generateIntantiation(uniqueIds: IdGenerator, values: BlockInput[]): Block[] {
        const blocks = [];
        for (const component of this.components) {
            blocks.push(...component.generateIntantiation(uniqueIds, values));
            values = values.slice(component.size);
        }
        return blocks;
    }

    generateSetValueAtOffset(uniqueIds: IdGenerator, value: BlockInput, offset: number): Block[] {
        let searchOffset = 0;
        for (const component of this.components) {
            if (offset >= searchOffset && offset < searchOffset + component.size) {
                return component.generateSetValueAtOffset(uniqueIds, value, offset - searchOffset);
            }

            searchOffset += component.size;
        }
        throw new Error("Assertion failed; Offset beyond size of composite");
    }
    
    sliceAtOffsetAndSize(offset: number, size: number, uniqueIds: IdGenerator): Definition[] {
        const components = [];
        const endOffset = offset + size;
        let i = 0;
        let searchOffset = 0;
        for (; i < this.components.length; i++) {
            const component = this.components[i];
            if (offset >= searchOffset && offset < searchOffset + component.size) {
                if (endOffset <= searchOffset + component.size) {
                    if (component instanceof CompositeDefinition)
                        return component.sliceAtOffsetAndSize(offset - searchOffset, size, uniqueIds);
                    if (component instanceof ListDefinition)
                        return [ component.sliceAtOffset(offset - searchOffset, size, uniqueIds) ];
                    return [ component ];
                }

                if (component instanceof ListDefinition) {
                    if (typeof component.sliceStart !== "number") throw new Error("Assertion failed; what?");
                    components.push(component.sliceAtOffset(offset - searchOffset, component.sliceStart - offset + searchOffset, uniqueIds));
                } else if (component instanceof CompositeDefinition) {
                    components.push(new CompositeDefinition(component.type, component.components));
                } else {
                    components.push(component);
                }

                i++;
                searchOffset += component.size;
                break;
            }
            searchOffset += component.size;
        }
        for (; i < this.components.length; i++) {
            const component = this.components[i];
            if (endOffset <= searchOffset + component.size) {
                if (component instanceof ListDefinition) {
                    components.push(component.sliceAtOffset(searchOffset, component.sliceSize - endOffset + searchOffset, uniqueIds));
                } else {
                    components.push(component);
                }

                break;
            } else {
                components.push(component);
            }
            searchOffset += component.size;
        }
        return components;
    }
}