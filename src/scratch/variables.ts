export class VariableDefinition {
    constructor(public readonly id: string, public readonly name: string, public readonly initialValue: number|string) {}

    toJSON() {
        return [ this.name, this.initialValue ];
    }
}

export class ListDefinition {
    constructor(public readonly id: string, public readonly name: string, public readonly initialItems: string[]) {}

    toJSON() {
        return [ this.name, this.initialItems ];
    }
}

export class BroadcastDefinition {
    constructor(public readonly id: string, public readonly name: string) {}

    toJSON() {
        return this.name;
    }
}