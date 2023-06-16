import { FilePositionRange } from "../stringReader";

export enum TokenKind {
    Number,
    String,
    Keyword,
    Operator,
    OpenParenthesis,
    CloseParenthesis
}

export abstract class Token {
    constructor(public readonly kind: TokenKind, public readonly position: FilePositionRange) {}
}