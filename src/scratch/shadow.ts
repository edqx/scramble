import { Value } from "./values";

export enum ShadowState {
    HasShadow = 1,
    HasBlock,
    HasBlockShadow
}

export class BlockRef {
    constructor(public readonly blockId: string) {}

    toJSON() {
        return this.blockId;
    }
}

export class Shadowed {
    constructor(public readonly base: BlockRef|Value|undefined, public readonly overlay: BlockRef|Value|undefined) {}

    getState() {
        if (this.base !== undefined && this.overlay !== undefined) return ShadowState.HasBlockShadow;
        if (this.base === undefined) return ShadowState.HasShadow;
        if (this.overlay === undefined) return ShadowState.HasBlock;

        throw new Error("Invalid shadow state");
    }

    toJSON() {
        if (this.base !== undefined && this.overlay !== undefined) return [ ShadowState.HasBlockShadow, this.base, this.overlay ];
        if (this.base === undefined) return [ ShadowState.HasShadow, this.overlay!.toJSON() ];
        if (this.overlay === undefined) return [ ShadowState.HasBlock, this.base.toJSON() ];

        throw new Error("Invalid shadow state");
    }
}