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
import { ArrayReferenceExpression } from "./ArrayReference";

export class VariableDeclarationExpression extends Expression {
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
                new CompilerError(ErrorCode.ExpectedVariableDeclaration)
                    .addError(declarationToken.position.end.offset(1), "Expected variable declaration")
            );
            return;
        }
        if (!(expression instanceof AssignmentExpression)) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedVariableDeclaration)
                    .addError(expression.position, "Expected variable declaration")
            );
            return;
        }
        if (expression.reference instanceof AccessorExpression) {
            errorCollector.addError(
                new CompilerError(ErrorCode.ExpectedVariableDeclaration)
                    .addError(expression.position, "Expected variable declaration")
                    .addInfo(expression.reference.position, "You can't declare a property on an object with a variable declaration")
            );
            return;
        }
        astCollector.appendExpression(
            new VariableDeclarationExpression(
                declarationToken,
                expression,
                (expression.reference as KeywordExpression).keyword,
                expression.type,
                expression.value
            )
        );
    }

    varType: "let"|"var";

    constructor(
        declarationKeyword: KeywordToken,
        assignmentExpression: AssignmentExpression,
        public readonly identifier: string,
        public readonly type: KeywordExpression|ProcDeclarationExpression|ArrayReferenceExpression|undefined,
        public readonly initialValue: Expression
    ) {
        super(ExpressionKind.VariableDeclaration, FilePositionRange.contain(declarationKeyword.position, assignmentExpression.position));

        this.varType = declarationKeyword.keyword as "let"|"var";
    }
}