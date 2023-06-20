import { Shadowed } from "../shadow";
import { FieldValue } from "../values";
import { Block } from "./Block";


// https://github.com/scratchfoundation/scratch-blocks/blob/develop/blocks_vertical/control.js
export class ForeverBlock extends Block {
    constructor(public readonly substack: Shadowed) { super("control_forever") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SUBSTACK: this.substack }; }
}

export class RepeatBlock extends Block {
    constructor(public readonly substack: Shadowed, public readonly times: Shadowed) { super("control_repeat") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SUBSTACK: this.substack, TIMES: this.times }; }
}

export class IfBlock extends Block {
    constructor(public readonly substack: Shadowed, public readonly condition: Shadowed) { super("control_if") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SUBSTACK: this.substack, CONDITION: this.condition }; }
}

export class IfElseBlock extends Block {
    constructor(public readonly substack: Shadowed, public readonly substack2: Shadowed, public readonly condition: Shadowed) { super("control_if_else") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SUBSTACK: this.substack, SUBSTACK2: this.condition, CONDITION: this.condition }; }
}

// TODO: StopBlock https://github.com/scratchfoundation/scratch-blocks/blob/582ed3a88160bfe753f9e06ff3fae66191f18a13/blocks_vertical/control.js#L172

export class WaitBlock extends Block {
    constructor(public readonly value: Shadowed) { super("control_wait") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { VALUE: this.value }; }
}

export class WaitUntilBlock extends Block {
    constructor(public readonly value: Shadowed) { super("control_wait_until") }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { VALUE: this.value }; }
}