import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { StringToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class StringExpression extends Expression {
    static read(stringToken: StringToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        astCollector.appendExpression(new StringExpression(stringToken));
    }

    text: string;

    constructor(stringToken: StringToken) {
        super(ExpressionKind.String, stringToken.position);

        this.text = stringToken.text;
    }
}