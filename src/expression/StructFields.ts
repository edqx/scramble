import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken } from "../token";
import { AccessorExpression } from "./Accessor";
import { ArrayReferenceExpression } from "./ArrayReference";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class StructFieldsExpression extends Expression {
    constructor(
        closeParenthesisToken: CloseParenthesisToken,
        public readonly reference: KeywordExpression|AccessorExpression|ArrayReferenceExpression,
        public readonly assignments: Expression[]
    ) {
        super(ExpressionKind.StructFields, FilePositionRange.contain(reference.position, closeParenthesisToken.position));
    }
}