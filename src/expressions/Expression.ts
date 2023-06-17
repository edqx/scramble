import { FilePositionRange } from "../stringReader";

export enum ExpressionKind {
    Number,
    String,
    Keyword,
    Operator,
    UnaryOperator,
    Parenthesis,
    FunctionCall,
    IfStatement,
    WhileStatement,
    ProcDeclaration,
    ParameterDeclaration,
    ReturnStatement,
    Assignment,
    Accessor,
    MacroDeclaration,
    TypeGuard
}

export abstract class Expression {
    constructor(public readonly kind: ExpressionKind, public readonly position: FilePositionRange) {}
}