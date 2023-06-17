import { parseAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../errors";
import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken, OpenParenthesisToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { FunctionCallExpression } from "./FunctionCall";
import { KeywordExpression } from "./Keyword";

export class ParenthesisExpression extends Expression {
    static read(openParenthesisToken: OpenParenthesisToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        const parenthesisStack: OpenParenthesisToken[] = [ openParenthesisToken ];
        const innerTokens: Token[] = [];
        while (true) {
            const nextToken = tokenReader.getNextToken();
            if (nextToken === undefined) {
                const error = new CompilerError(ErrorCode.MismatchedParenthesis)
                    .addError(openParenthesisToken.position, "No matching close parenthesis, end of file reached");

                errorCollector.addError(error);
                break;
            }

            if (nextToken instanceof OpenParenthesisToken) {
                parenthesisStack.push(nextToken);
            } else if (nextToken instanceof CloseParenthesisToken) {
                const openingParenthesis = parenthesisStack.pop();
                if (openingParenthesis?.getMatchingEndParenthesis() !== nextToken.parenthesis) {
                    const error = new CompilerError(ErrorCode.MismatchedParenthesis)
                        .addError(nextToken.position, "Mismatched parenthesis");

                    if (openingParenthesis === undefined) {
                        error.addInfo(undefined, "Parenthesis are unbalanced");
                    } else {
                        error.addInfo(openingParenthesis.position, `Opening parenthesis expected '${openingParenthesis.getMatchingEndParenthesis()}' to close it`);
                    }
                    errorCollector.addError(error);
                    break;
                }
                    
                if (parenthesisStack.length === 0) {
                    const innerExpressions = parseAst(new TokenReader(innerTokens), errorCollector).expressions;
                    const parenthesisExpression = new ParenthesisExpression(innerExpressions, openParenthesisToken, nextToken);
                    const last = astCollector.peekLastExpression();
                    if (last instanceof KeywordExpression) {
                        const identifierExpression = astCollector.popLastExpression()! as KeywordExpression;
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