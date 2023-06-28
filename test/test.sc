class Vector2 {
    x: number;
    y: number;
}

class Positioning {
    position: Vector2;
    velocity: Vector2;
}

class Person {
    name: string;
    positioning: Positioning;
    age: number;
}

proc killPerson(person: Person) {
    person.positioning.velocity = Vector2{ x = 4; y = 2; };
}