class Vector2 {
    x: number;
    y: number;
}

class Player {
    name: string;
    position: Vector2;
    velocity: Vector2;
    age: number;
}

proc copyFromTo(vec1: Vector2, vec2: Vector2) {
    vec2 = vec1;
}