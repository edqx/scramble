import { KeywordToken } from "../token";
import { Expression, ExpressionKind } from "./Expression";

export class KeywordExpression extends Expression {
    static from(keywordToken: KeywordToken) {
        return new KeywordExpression(keywordToken);
    }

    keyword: string;

    constructor(keywordToken: KeywordToken) {
        super(ExpressionKind.Keyword, keywordToken.position);

        this.keyword = keywordToken.keyword;
    }
}