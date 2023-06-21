import { FilePositionRange } from "../stringReader";
import { Expression, ExpressionKind } from "./Expression";
import { ParenthesisExpression } from "./Parenthesis";

export class FunctionCallExpression extends Expression {
    args: Expression[];

    constructor(public readonly reference: Expression, args: ParenthesisExpression) {
        super(ExpressionKind.FunctionCall, FilePositionRange.contain(reference.position, args.position));

        this.args = args.expressions;
    }
}