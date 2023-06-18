import { parseSingleTokenAst } from "../ast";
import { AstCollector } from "../astCollector";
import { ErrorCollector } from "../errorCollector";
import { FilePositionRange } from "../stringReader";
import { AccessorToken } from "../token";
import { TokenReader } from "../tokenReader";
import { Expression, ExpressionKind } from "./Expression";

export class AccessorExpression extends Expression {
    static read(accessorToken: AccessorToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

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
        astCollector.appendExpression(new AccessorExpression(left, right));
    }

    constructor(public readonly base: Expression, public readonly property: Expression) {
        super(ExpressionKind.Accessor, FilePositionRange.contain(base.position, property.position));
    }
}