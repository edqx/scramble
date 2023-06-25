import { parseSingleTokenAst } from "../parseAst";
import { AstCollector } from "../astCollector";
import { CompilerError, ErrorCode } from "../error";
import { ErrorCollector } from "../errorCollector";
import { FilePositionRange } from "../stringReader";
import { KeywordToken } from "../token";
import { TokenReader } from "../tokenReader";
import { AccessorExpression } from "./Accessor";
import { AssignmentExpression } from "./Assignment";
import { Expression, ExpressionKind } from "./Expression";
import { KeywordExpression } from "./Keyword";
import { ProcDeclarationExpression } from "./ProcDeclaration";

export class TypeAliasDeclarationExpression extends Expression {
    static read(declarationToken: KeywordToken, astCollector: AstCollector, tokenReader: TokenReader, errorCollector: ErrorCollector) {
        while (true) {
            const nextToken = tokenReader.getNextToken();

            if (nextToken === undefined) break;

            const tokenPrecedence = nextToken.getPrecedence();
            if (tokenPrecedence === null) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
                continue;
            }

            if (tokenPrecedence > declarationToken.getPrecedence()!) {
                parseSingleTokenAst(nextToken, astCollector, tokenReader, errorCollector);
            } else {
                tokenReader.moveBack();
                break;
            }
        }
        const expression = astCollector.popLastExpression()!;
        if (expression === undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedTypeAliasDeclaration)
                    .addError(declarationToken.position.end.offset(1), "Expected type alias declaration")
            );
            return;
        }
        if (!(expression instanceof AssignmentExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedTypeAliasDeclaration)
                    .addError(expression.position, "Expected type alias declaration")
            );
            return;
        }
        if (expression.type !== undefined) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedTypeAliasDeclaration)
                    .addError(expression.position, "Expected type alias declaration")
                    .addInfo(expression.type.position, "Type alias declaration cannot have a type guard; are you trying to declare a variable?")
            );
            return;
        }
        if (expression.reference instanceof AccessorExpression) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedIdentifier)
                    .addError(expression.position, "Expected identifier for type alias declaration")
            );
            return;
        }
        if (!(expression.value instanceof ProcDeclarationExpression) && !(expression.value instanceof KeywordExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.InvalidRightHandSideAssignment)
                    .addError(expression.position, "Type alias can only be a procedure signature or a class reference")
            );
            return;
        }
        astCollector.appendExpression(
            new TypeAliasDeclarationExpression(
                declarationToken,
                expression,
                expression.reference.keyword,
                expression.value
            )
        );
    }

    constructor(
        declarationKeyword: KeywordToken,
        assignmentExpression: AssignmentExpression,
        public readonly name: string,
        public readonly type: ProcDeclarationExpression|KeywordExpression
    ) {
        super(ExpressionKind.VariableDeclaration, FilePositionRange.contain(declarationKeyword.position, assignmentExpression.position));
    }
}