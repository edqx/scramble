import { Shadowed } from "../shadow";
import { FieldValue } from "../values";

export abstract class Block {
    constructor(public readonly opcode: string) {}

    abstract getFields(): Record<string, FieldValue>;
    abstract getInputs(): Record<string, Shadowed>;
}

export class MoveStepsBlock extends Block {
    constructor(public readonly steps: Shadowed) { super("motion_movesteps"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { STEPS: this.steps }; }
}

export class TurnRightBlock extends Block {
    constructor(public readonly degrees: Shadowed) { super("motion_turnright"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { DEGREES: this.degrees }; }
}

export class TurnLeftBlock extends Block {
    constructor(public readonly degrees: Shadowed) { super("motion_turnleft"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { DEGREES: this.degrees }; }
}

export class PointInDirectionBlock extends Block {
    constructor(public readonly degrees: Shadowed) { super("motion_pointindirection"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { DEGREES: this.degrees }; }
}

export class PointTowardsMenuBlock extends Block {
    constructor(public readonly towards: FieldValue ) { super("motion_pointtowards_menu"); }

    getFields(): Record<string, FieldValue> { return { TOWARDS: this.towards }; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class PointTowardsBlock extends Block {
    constructor(public readonly towards: Shadowed) { super("motion_pointtowards"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { TOWARDS: this.towards }; }
}

export class GotoMenuBlock extends Block {
    constructor(public readonly to: FieldValue ) { super("motion_goto_menu"); }

    getFields(): Record<string, FieldValue> { return { TO: this.to }; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class GotoBlock extends Block {
    constructor(public readonly to: Shadowed) { super("motion_goto"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { TO: this.to }; }
}

export class GotoXYBlock extends Block {
    constructor(public readonly x: Shadowed, public readonly y: Shadowed) { super("motion_gotoxy"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { X: this.x, Y: this.y }; }
}

export class GotoSecsToXYBlock extends Block {
    constructor(public readonly secs: Shadowed, public readonly x: Shadowed, public readonly y: Shadowed) { super("motion_glidesecstoxy"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SECS: this.secs, X: this.x, Y: this.y }; }
}

export class GlideToMenuBlock extends Block {
    constructor(public readonly to: FieldValue) { super("motion_glideto_menu"); }

    getFields(): Record<string, FieldValue> { return { TO: this.to }; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class GlideToBlock extends Block {
    constructor(public readonly secs: Shadowed, public readonly to: Shadowed) { super("motion_glideto"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { SECS: this.secs, TO: this.to }; }
}

export class ChangeXByBlock extends Block {
    constructor(public readonly x: Shadowed) { super("motion_changexby"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { X: this.x }; }
}

export class SetXBlock extends Block {
    constructor(public readonly x: Shadowed) { super("motion_setx"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { X: this.x }; }
}

export class ChangeYByBlock extends Block {
    constructor(public readonly y: Shadowed) { super("motion_sety"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { Y: this.y }; }
}

export class SetYBlock extends Block {
    constructor(public readonly y: Shadowed) { super("motion_sety"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return { Y: this.y }; }
}

export class IfOnEdgeBounceBlock extends Block {
    constructor() { super("motion_ifonedgebounce"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class SetRotationStyleBlock extends Block {
    constructor(public readonly style: FieldValue) { super("motion_setrotationstyle"); }

    getFields(): Record<string, FieldValue> { return { STYLE: this.style }; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class XPositionBlock extends Block {
    constructor() { super("motion_xposition"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class YPositionBlock extends Block {
    constructor() { super("motion_yposition"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return {}; }
}

export class DirectionBlock extends Block {
    constructor() { super("motion_direction"); }

    getFields(): Record<string, FieldValue> { return {}; }
    getInputs(): Record<string, Shadowed> { return {}; }
}