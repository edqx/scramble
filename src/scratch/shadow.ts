import { Block } from "./block";
import { Value } from "./values";

export enum ShadowState {
    HasShadow = 1,
    HasBlock,
    HasBlockShadow
}

export class BlockRef {
    constructor(public readonly block: Block) {}

    toJSON() {
        return this.block.id;
    }
}

export type BlockInput = BlockRef|Value;

export class Shadowed {
    constructor(public readonly base: BlockInput|undefined, public readonly overlay: BlockInput|undefined) {}

    getState() {
        if (this.base !== undefined && this.overlay !== undefined) return ShadowState.HasBlockShadow;
        if (this.base === undefined) return ShadowState.HasShadow;
        if (this.overlay === undefined) return ShadowState.HasBlock;

        throw new Error("Invalid shadow state");
    }

    toJSON() {
        if (this.base !== undefined && this.overlay !== undefined) return [ ShadowState.HasBlockShadow, this.overlay, this.base ];
        if (this.base === undefined) return [ ShadowState.HasShadow, this.overlay!.toJSON() ];
        if (this.overlay === undefined) return [ ShadowState.HasBlock, this.base.toJSON() ];

        throw new Error("Invalid shadow state");
    }
}