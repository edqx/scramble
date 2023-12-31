import { FilePositionRange } from "../stringReader";

export enum TokenKind {
    Number,
    String,
    Keyword,
    Operator,
    OpenParenthesis,
    CloseParenthesis,
    Newline,
    StatementBreak,
    Accessor,
    TypeIndicator,
    Separator,
    ReturnTypeIndicator
}

export abstract class Token {
    constructor(public readonly kind: TokenKind, public readonly position: FilePositionRange) {}

    abstract getPrecedence(): number|null;
}