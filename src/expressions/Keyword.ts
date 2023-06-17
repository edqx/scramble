import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { KeywordToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class KeywordExpression extends Expression {
    static read(keywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        astCollector.appendExpression(new KeywordExpression(keywordToken));
    }

    keyword: string;

    constructor(keywordToken: KeywordToken) {
        super(ExpressionKind.Keyword, keywordToken.position);

        this.keyword = keywordToken.keyword;
    }
}