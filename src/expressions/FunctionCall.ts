import { FilePositionRange } from "../stringReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ParenthesisExpression } from "./Parenthesis";

export class FunctionCallExpression extends Expression {
    static from(identifier: KeywordExpression, args: ParenthesisExpression) {
        return new FunctionCallExpression(identifier, args);
    }

    identifier: string;
    args: Expression[];

    constructor(identifier: KeywordExpression, args: ParenthesisExpression) {
        super(ExpressionKind.Keyword, FilePositionRange.contain(identifier.position, args.position));

        this.identifier = identifier.keyword;
        this.args = args.expressions;
    }
}