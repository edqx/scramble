import { parseSingleTokenAst } from "../parseAst";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { FilePositionRange } from "../stringReader";
import { AccessorToken, OpenParenthesisToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";

export class AccessorExpression extends Expression {
    static read(accessorToken: AccessorToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            if (nextToken instanceof OpenParenthesisToken) {
                tokenReader.moveBack();
                break;
            }

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > accessorToken.getPrecedence()) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const right = astCollector.popLastExpression()!;
        const left = astCollector.popLastExpression()!;
        console.log(right);
        if (!(right instanceof KeywordExpression)) {
            throw new Error("Expected keyword property");
        }
        astCollector.appendExpression(new AccessorExpression(left, right));
    }

    constructor(public readonly base: Expression, public readonly property: KeywordExpression) {
        super(ExpressionKind.Accessor, FilePositionRange.contain(base.position, property.position));
    }
}