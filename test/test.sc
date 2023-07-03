class Vec2 {
    x: number;
    y: number;

    proc add(other: Vec2) {
        return Vec2{ x = this.x + other.x; y = this.y + other.y; };
    }

    proc sub(other: Vec2) {
        return Vec2{ x = this.x - other.x; y = this.y - other.y; };
    }

    proc mul(scalar: number) {
        return Vec2{ x = this.x * scalar; y = this.y * scalar; };
    }

    proc div(scalar: number) {
        return this.mul(1 / scalar);
    }

    proc dot(other: Vec2) {
        return this.x * other.x + this.y * other.y;
    }
}

class Player {
    username: string;
    position: Vec2;
    velocity: Vec2;
    health: number;

    proc moveTick(deltaTime: number) {
        this.position = this.position.add(this.velocity.mul(deltaTime));
    }
}

proc main() {
    var a = Player{ username="aquila"; position=Vec2{ x=4; y=3; }; velocity=Vec2{ x=3; y=2; }; health=100; };
    var b = Player{ username="jadedot"; position=Vec2{ x=9; y=2; }; velocity=Vec2{ x=2; y=4; }; health=90; };

    a.moveTick(0.5);
    b.moveTick(0.5);
}