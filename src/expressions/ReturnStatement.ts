import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { KeywordToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class ReturnStatementExpression extends Expression {
    static read(returnToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > returnToken.getPrecedence()!) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const expression = astCollector.popLastExpression()!;
        astCollector.appendExpression(new ReturnStatementExpression(returnToken, expression));
    }

    constructor(returnToken: KeywordToken, public readonly expression: Expression|undefined) {
        super(ExpressionKind.ReturnStatement, returnToken.position);
    }
}