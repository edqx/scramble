import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken } from "../token";
import { AccessorExpression } from "./Accessor";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class ArrayReferenceExpression extends Expression {
    constructor(
        closeParenthesisToken: CloseParenthesisToken,
        public readonly reference: KeywordExpression|AccessorExpression|ArrayReferenceExpression,
        public readonly capacity: Expression|undefined
    ) {
        super(ExpressionKind.ArrayReference, FilePositionRange.contain(reference.position, closeParenthesisToken.position));
    }
}