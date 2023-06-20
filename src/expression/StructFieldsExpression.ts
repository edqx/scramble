import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken, OpenParenthesisToken } from "../token";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class StructFieldsExpression extends Expression {
    constructor(
        closeParenthesisToken: CloseParenthesisToken,
        public readonly reference: KeywordExpression|AccessorExpression,
        public readonly assignments: AssignmentExpression[]
    ) {
        super(ExpressionKind.StructFields, FilePositionRange.contain(reference.position, closeParenthesisToken.position));
    }
}