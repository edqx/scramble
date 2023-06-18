import { Value } from "./values";

export enum ShadowState {
    HasShadow,
    HasBlock,
    HasBlockShadow
}

export class BlockRef {
    constructor(public readonly blockId: string) {}
}

export class Shadowed {
    constructor(public readonly base: BlockRef|Value|undefined, public readonly overlay: BlockRef|Value|undefined) {}

    getState() {
        if (this.base !== undefined && this.overlay !== undefined) return ShadowState.HasBlockShadow;
        if (this.base === undefined) return ShadowState.HasBlock;
        if (this.base === undefined) return ShadowState.HasShadow;

        throw new Error("Invalid shadow state");
    }
}