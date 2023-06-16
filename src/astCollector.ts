import { Expression } from "./expressions";

export class AstCollector {
    expressions: Expression[];

    constructor() {
        this.expressions = [];
    }

    assertPop() {
        if (this.expressions.length > 0)
            return this.expressions.pop()!;

        throw new Error("Expected expression");
    }

    pop() {
        return this.expressions.pop();
    }

    peekLast(): Expression|undefined {
        return this.expressions[this.expressions.length - 1];
    }

    appendExpression(expression: Expression) {
        this.expressions.push(expression);
    }

    getPrimeExpression(): Expression|undefined {
        return this.expressions[this.expressions.length - 1];
    }
}