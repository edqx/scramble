import { AstCollector } from "../astCollector";
import { KeywordToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class KeywordExpression extends Expression {
    static read(keywordToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        astCollector.appendExpression(new KeywordExpression(keywordToken));
    }

    keyword: string;

    constructor(keywordToken: KeywordToken) {
        super(ExpressionKind.Keyword, keywordToken.position);

        this.keyword = keywordToken.keyword;
    }
}