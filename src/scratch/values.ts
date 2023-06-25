export enum ValueType {
    Number = 4,
    PosNumber,
    PosInt,
    Color = 9,
    String,
    Broadcast,
    Variable,
    List
}

export abstract class Value {
    constructor(public readonly type: ValueType) {}

    abstract toJSON(): any[];
}

export class NumberValue extends Value {
    constructor(public readonly val: number) { super(ValueType.Number); }

    toJSON(): any[] { return [ this.val ]; }
}

export class PosNumberValue extends Value {
    constructor(public readonly val: number) { super(ValueType.PosNumber); }

    toJSON(): any[] { return [ this.val ]; }
}

export class PosIntegerValue extends Value {
    constructor(public readonly val: number) { super(ValueType.PosInt); }

    toJSON(): any[] { return [ this.val ]; }
}

export class ColorValue extends Value {
    constructor(public readonly hexColor: string) { super(ValueType.Color); }

    toJSON(): any[] { return [ "#" + this.hexColor ]; }
}

export class StringValue extends Value {
    constructor(public readonly str: string) { super(ValueType.String); }

    toJSON(): any[] { return [ this.str ]; }
}

export class BroadcastValue extends Value {
    constructor(public readonly broadcastName: string, public readonly broadcastId: string) { super(ValueType.Broadcast); }

    toJSON(): any[] { return [ this.broadcastName, this.broadcastId ]; }
}

export class VariableValue extends Value {
    constructor(
        public readonly variableName: string,
        public readonly variableId: string,
        public readonly x = 0,
        public readonly y = 0
    ) {
        super(ValueType.Variable);
    }

    toJSON(): any[] { return [ this.variableName, this.variableId, this.x, this.y ]; }
}

export class ListValue extends Value {
    constructor(
        public readonly listName: string,
        public readonly listId: string,
        public readonly x = 0,
        public readonly y = 0
    ) {
        super(ValueType.List);
    }

    toJSON(): any[] { return [ this.listName, this.listId, this.x, this.y ]; }
}

export abstract class FieldValue {
    constructor() {}

    abstract toJSON(): any;
}

export class DirectValue extends FieldValue {
    constructor(public readonly value: string) { super(); }

    toJSON() { return [ this.value, null ]; }
}

export class ReferenceValue extends FieldValue {
    constructor(public readonly name: string, public readonly id: string) { super(); }

    toJSON() { return [ this.name, this.id ]; }
}