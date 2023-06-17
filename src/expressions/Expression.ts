import { FilePositionRange } from "../stringReader";

export enum ExpressionKind {
    Number,
    String,
    Keyword,
    Operator,
    Parenthesis,
    FunctionCall,
    IfStatement,
    WhileStatement,
    ProcDeclaration,
    ReturnStatement
}

export abstract class Expression {
    constructor(public readonly kind: ExpressionKind, public readonly position: FilePositionRange) {}
}