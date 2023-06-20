import { parseAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { CompilerError, ErrorCode } from "../error";
import { FilePositionRange } from "../stringReader";
import { CloseParenthesisToken, OpenParenthesisToken, Token } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { FunctionCallExpression } from "./FunctionCall";
import { KeywordExpression } from "./Keyword";
import { AssignmentExpression } from "./Assignment";
import { StructFieldsExpression } from "./StructFieldsExpression";
import { AccessorExpression } from "./Accessor";

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
                    const parenthesisExpression = new ParenthesisExpression(openParenthesisToken, nextToken, innerExpressions);
                    const last = astCollector.peekLastExpression();
                    if (last instanceof KeywordExpression && openParenthesisToken.parenthesis === "(") {
                        const identifierExpression = astCollector.popLastExpression()! as KeywordExpression;
                        astCollector.appendExpression(new FunctionCallExpression(identifierExpression, parenthesisExpression));
                        break;
                    } else if ((last instanceof KeywordExpression || last instanceof AccessorExpression) && openParenthesisToken.parenthesis === "{") {
                        const identifierExpression = astCollector.popLastExpression()! as KeywordExpression;
                        for (const expression of innerExpressions) {
                            if (!(expression instanceof AssignmentExpression)) {
                                errorCollector.addError(
                                    new CompilerError(ErrorCode.ExpectedFieldAssignment)
                                        .addError(expression.position, "Expected a field assignment")
                                        .addInfo(identifierExpression.position, "You can only assign fields in a struct initialiser")
                                )
                                return;
                            }
                        }
                        astCollector.appendExpression(new StructFieldsExpression(nextToken, identifierExpression, innerExpressions as AssignmentExpression[]));
                        break;
                    }

                    astCollector.appendExpression(parenthesisExpression);
                    break;
                }
            }

            innerTokens.push(nextToken);
        }
    }

    constructor(openParenthesisToken: OpenParenthesisToken, closeParenthesisToken: CloseParenthesisToken, public readonly expressions: Expression[]) {
        super(ExpressionKind.Parenthesis, FilePositionRange.contain(openParenthesisToken.position, closeParenthesisToken.position));
    }
}