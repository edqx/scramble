import { FilePositionRange } from "../stringReader";
import { OperatorToken } from "../token";
import { Expression, ExpressionKind } from "./Expression";

export class UnaryOperatorExpression extends Expression {
    constructor(operatorToken: OperatorToken, public readonly expression: Expression, public readonly operator: string) {
        super(ExpressionKind.UnaryOperator, FilePositionRange.contain(operatorToken.position, expression.position));
    }
}