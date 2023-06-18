import { CompilerError } from "./error";

export class ErrorCollector {
    protected _errors: CompilerError[];

    constructor() {
        this._errors = [];
    }

    addError(error: CompilerError) {
        this._errors.push(error);
    }

    getErrors() {
        return this._errors;
    }
}