import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { KeywordToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class ReturnStatementExpression extends Expression {
    static read(returnToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader);
                continue;
            }

            if (tokenPrecedence > returnToken.getPrecedence()!) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const expression = astCollector.assertPop();
        astCollector.appendExpression(new ReturnStatementExpression(expression));
    }

    constructor(public readonly expression: Expression) {
        super(ExpressionKind.ReturnStatement, expression.position);
    }
}