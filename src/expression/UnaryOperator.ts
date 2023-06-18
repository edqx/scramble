import { Expression, ExpressionKind } from "./Expression";

export class UnaryOperatorExpression extends Expression {
    constructor(public readonly expression: Expression, public readonly operator: string) {
        super(ExpressionKind.UnaryOperator, expression.position);
    }
}