type NumberPipelineFunction = proc(a: number, b: number) -> number;

class FunctionPipeline {
    p1: NumberPipelineFunction;
    p2: NumberPipelineFunction;
    p3: NumberPipelineFunction;
}

proc sumPipeline(a: number, b: number, pipeline: FunctionPipeline) {
    pipeline.p1 = (pipeline.p2 = (pipeline.p3 = mul));

    return pipeline.p1(a, b) + pipeline.p2(a, b) + pipeline.p3(a, b);
}

proc add(a: number, b: number) {
    return a + b;
}
proc mul(a: number, b: number) {
    return a * b;
}
proc div(a: number, b: number) {
    return a / b;
}

proc main() {
    var res = sumPipeline(4, 5, FunctionPipeline{ p1 = add; p2 = mul; p3 = div; });
}

