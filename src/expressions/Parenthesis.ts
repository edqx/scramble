import { parseAst } from "../ast";
import { AstCollector } from "../astCollector";
import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken, OpenParenthesisToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { FunctionCallExpression } from "./FunctionCall";
import { KeywordExpression } from "./Keyword";

export class ParenthesisExpression extends Expression {
    static read(openParenthesisToken: OpenParenthesisToken, astCollector: AstCollector, tokenReader: TokenReader) {
        const parenthesisStack: OpenParenthesisToken[] = [ openParenthesisToken ];
        const innerTokens: Token[] = [];
        while (true) {
            const nextToken = tokenReader.getNextToken();
            if (nextToken === undefined) throw new Error("Unexpected EOF");

            if (nextToken instanceof OpenParenthesisToken) {
                parenthesisStack.push(nextToken);
            } else if (nextToken instanceof CloseParenthesisToken) {
                if (parenthesisStack.pop()?.getMatchingEndParenthesis() !== nextToken.parenthesis)
                    throw new Error("Unmatched parenthesis");
                    
                if (parenthesisStack.length === 0) {
                    const innerExpressions = parseAst(new TokenReader(innerTokens)).expressions;
                    const parenthesisExpression = new ParenthesisExpression(innerExpressions, openParenthesisToken, nextToken);
                    const last = astCollector.peekLast();
                    if (last instanceof KeywordExpression) {
                        const identifierExpression = astCollector.assertPop() as KeywordExpression;
                        astCollector.appendExpression(new FunctionCallExpression(identifierExpression, parenthesisExpression));
                        break;
                    }

                    astCollector.appendExpression(parenthesisExpression);
                    break;
                }
            }

            innerTokens.push(nextToken);
        }
    }

    constructor(public readonly expressions: Expression[], openParenthesisToken: OpenParenthesisToken, closeParenthesisToken: CloseParenthesisToken) {
        super(ExpressionKind.Parenthesis, FilePositionRange.contain(openParenthesisToken.position, closeParenthesisToken.position));
    }
}