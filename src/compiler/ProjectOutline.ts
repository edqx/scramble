export class VariableOutline {
    constructor(public readonly id: string, initialValue: number|string) {}
}

export class ProcedureDefinitionOutline {
    
}

export class ProjectOutline {
    definitions: Map<string, ProcedureDefinitionOutline>;
    variables: Map<string, VariableOutline>;

    constructor() {
        this.definitions = new Map;
        this.variables = new Map;
    }
}