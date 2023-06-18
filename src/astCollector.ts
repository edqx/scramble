import { Expression } from "./expression";

export class AstCollector {
    expressions: Expression[];

    constructor() {
        this.expressions = [];
    }

    popLastExpression() {
        return this.expressions.pop();
    }

    peekLastExpression(): Expression|undefined {
        return this.expressions[this.expressions.length - 1];
    }

    appendExpression(expression: Expression) {
        this.expressions.push(expression);
    }

    getPrimeExpression(): Expression|undefined {
        return this.expressions[this.expressions.length - 1];
    }
}