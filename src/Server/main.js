var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.get("/", function(req, res){
    res.send("Server\'s alive");
});

http.listen(3000, function(){
    console.log("info : ini : start on 3000");
});

function Vector(myX, myY){
    this.x = myX; this.y = myY;
    this.translate = function(vec){
        this.x += vec.x; this.y += vec.y;
        return this;
    };
    this.mult = function(m){
        this.x *= m; this.y *= m;
        return this;
    };
    this.set = function(v){
        this.x = v.x; this.y = v.y;
        return this;
    };
}

function Craft(socket, nick, birthtime){
    this.socket = socket;
    this.birthtime = birthtime;
    this.nick = nick;
    this.vel = new Vector(0, 0);
    this.pos = new Vector(0, 0);
    this.rotation = 0;
    this.radius = 22;
    this.dead = false;
    this.powered = false;
    this.breaking = false;
    this.rotate = 0;
    this.firing = false;
    this.firecooldown = 0;

    this.move = function(){
        if(this.firecooldown > 0) this.firecooldown--;
        this.rotation += this.rotate;
        if(this.powered){
            this.vel.x += Math.sin(this.rotation);
            this.vel.y += -Math.cos(this.rotation);
            var lim = 15;
            if(this.vel.x > lim) this.vel.x = lim;
            if(this.vel.y > lim) this.vel.y = lim;
            if(this.vel.x < -lim) this.vel.x = -lim;
            if(this.vel.y < -lim) this.vel.y = -lim;
        }
        if(this.breaking){
            this.vel.mult(0.9);
        }
        this.pos.translate(this.vel);
    };

    this.tryFiring = function(){
        if(this.firecooldown === 0){
            this.firecooldown = 15;
            this.firing = true;
        }
    };

    this.getCondensed = function(){
        var c = ",";
        return parseInt(this.pos.x, 10) +c+
               parseInt(this.pos.y, 10) +c+
               this.nick +c+
               this.rotation +c+
               (this.powered? 1 : 0);
    };
}

function Bullet(craft){
    var csin = Math.sin(craft.rotation);
    var ccos = -Math.cos(craft.rotation);
    this.vel = new Vector(csin, ccos).mult(25).translate(craft.vel);
    this.pos = new Vector(csin, ccos).mult(25).translate(craft.pos);
    this.lifeLeft = 160;
    this.radius = 3;   // rad is 3 for client side drawing (y)

    this.move = function(){
        this.pos.translate(this.vel);
        this.lifeLeft--;
    };

    this.isAlive = function(){
        return this.lifeLeft > 0;
    };

    this.getCondensed = function(){
        return parseInt(this.pos.x, 10) + "," +
               parseInt(this.pos.y, 10);
    };
}

function Asteroid(rad){
    this.vel = new Vector(0,0);
    this.radius = rad;
    this.pos;

    this.move = function(){
        this.vel.mult(0.99);
        this.pos.translate(this.vel);
    };

    this.getCondensed = function(){
        return parseInt(this.pos.x, 10) + "," + parseInt(this.pos.y, 10) + "," + rad;
    };
}

function intersectsRectangle(a, b){
    var A = {x1: a.pos.x - a.radius, y1: a.pos.y - a.radius,
             x2: a.pos.x + a.radius, y2: a.pos.y + a.radius};
    var B = {x1: b.pos.x - b.radius, y1: b.pos.y - b.radius,
             x2: b.pos.x + b.radius, y2: b.pos.y + b.radius};
    return A.x1 < B.x2 && A.x2 > B.x1 && A.y1 < B.y2 && A.y2 > B.y1;
}

function distancesq(p1, p2){
    var x = p1.x - p2.x;
    var y = p1.y - p2.y;
    return x * x + y * y;
}

function isTouching(a, b){
    return intersectsRectangle(a, b)
            && distancesq(a.pos, b.pos) < (a.radius + b.radius)*(a.radius + b.radius);
}

// Ticking

var crafts = [];
var asteroids = [];
var bullets = [];

// TODO: initialize these with dimensions of full field
var totalHeight = 10000;
var totalWidth = 10000;

// finds a free spot on the map and returns the vector
function findStartingPoint(block, radius){
    // Randomly choose coordinates until you find
    // a pair that is not within a certain radius
    // of anything else
    var x = Math.floor(Math.random()*totalWidth);
    var y = Math.floor(Math.random()*totalHeight);

    var maxTry = 1000;

    while ((!block || maxTry-- > 0) && !validStartingPoint(x, y, radius)) {
        x = Math.floor(Math.random()*totalWidth);
        y = Math.floor(Math.random()*totalHeight);
    }
    if(maxTry === 0) return new Vector(-1, -1);
    else return new Vector(x,y);
}

function validStartingPoint(x,y, radius){
    var vec = new Vector(x,y);
    return checkFor(crafts, vec, radius) &&
           checkFor(bullets, vec, radius) &&
           checkFor(asteroids, vec, radius);
}

function checkFor(objects, vec, radius){
    for (var i = 0 ; i < objects.length ; i++)
        if(distancesq(vec, objects[i].pos) < radius * radius) return false;
    return true;
}

function doTick(){
    moveObjects();
    checkCollisions();
    disposeOfDeadBodies();
}

function moveObjects(){
    var x;
    for(x = 0; x < crafts.length; x++){
        crafts[x].move();
        if(crafts[x].firing){
            crafts[x].firing = false;
            bullets.push(new Bullet(crafts[x]));
        }
    }
    for(x = 0; x < bullets.length; x++) bullets[x].move();
    for(x = 0; x < asteroids.length; x++) asteroids[x].move();
}

function boxObject(vec){
    if(vec.x < 0) vec.x += totalWidth;
    if(vec.y < 0) vec.y += totalHeight;
    if(vec.x >= totalWidth) vec.x -= totalWidth;
    if(vec.y >= totalHeight) vec.y -= totalHeight;
}

// Hit everything
function checkCollisions(){
    var x, y;
    for (x = 0; x < crafts.length; x++) boxObject(crafts[x].pos);
    for (x = 0; x < asteroids.length; x++) boxObject(asteroids[x].pos);
    for (x = 0; x < bullets.length; x++) boxObject(bullets[x].pos);

    // Asteroids against crafts
    for(x = 0; x < crafts.length; x++)
        for(y = 0; y < asteroids.length; y++)
            if(isTouching(asteroids[y], crafts[x]))
                crafts[x].dead = true;

    // Asteroids against asteroids
    for(x = 0; x < asteroids.length - 1; x++){
        for(y = x + 1; y < asteroids.length; y++){
            if(isTouching(asteroids[x], asteroids[y])){
                var a = asteroids[x], b = asteroids[y];
                var xDist = a.pos.x - b.pos.x, yDist = a.pos.y - b.pos.y,
                    xVel = b.vel.x - a.vel.x, yVel = b.vel.y - a.vel.y;
                var dotProduct = xDist * xVel + yDist * yVel;
                if(dotProduct > 0){
                    var collisionScale = dotProduct / (xDist*xDist + yDist*yDist);
                    var xCollision = xDist * collisionScale,
                        yCollision = yDist * collisionScale;
                    var combinedMass = a.radius + b.radius;
                    var collWA = 2 * b.radius / combinedMass,
                        collWB = 2 * a.radius / combinedMass;
                    a.vel.translate(collWA * xCollision, collWA * yCollision);
                    b.vel.translate(-collWB * xCollision, -collWB * yCollision);
                }
            }
        }
    }

    // Bullets against asteroids
    for(x = 0; x < bullets.length; x++){
        if(!bullets[x].isAlive()) continue;
        for(y = 0; y < asteroids.length; y++){
            if(isTouching(asteroids[y], bullets[x])){
                asteroids[y].vel.set(bullets[x].vel);
                bullets[x].lifeLeft = 0;
            }
        }
    }

    // Bullets against bullets
    for(x = 0; x < bullets.length - 1; x++){
        if(!bullets[x].isAlive()) continue;
        for(y = x + 1; y < bullets.length; y++){
            if(!bullets[y].isAlive()) continue;
            if(isTouching(bullets[x], bullets[y])){
                bullets[x].lifeLeft = 0;
                bullets[y].lifeLeft = 0;
            }
        }
    }

    // Bullets against crafts
    for(x = 0; x < crafts.length; x++){
        if(crafts[x].dead) continue;
        for(y = 0; y < bullets.length; y++){
            if(!bullets[y].isAlive()) continue;
            if(isTouching(bullets[y], crafts[x])){
                bullets[y].lifeLeft = 0;
                crafts[x].dead = true;
            }
        }
    }

    // Crafts against crafts
    for(x = 0; x < crafts.length - 1; x++){
        if(crafts[x].dead) continue;
        for(y = x + 1; y < crafts.length; y++){
            if(crafts[y].dead) continue;
            if(isTouching(crafts[x], crafts[y])){
                crafts[x].dead = true;
                crafts[y].dead = true;
            }
        }
    }
}

function disposeOfDeadBodies(){
    var r = bullets.length;
    var l = 0;
    for(r = bullets.length - 1; r >= 0; r--){
        if(!bullets[r].isAlive()) continue;
        while(bullets[l].isAlive() && l !== r) l++;
        if(l === r) break;
        else bullets[l] = bullets[r];
    }
    bullets = bullets.slice(0, r + 1);

    r = crafts.length;
    l = 0;
    for(r = crafts.length - 1; r >= 0; r--){
        if(crafts[r].dead) continue;
        while(!crafts[l].dead && l !== r) l++;
        if(l === r) break;
        else crafts[l] = crafts[r];
    }

    for(var x = 0; x < crafts.length; x++)
        for(var y = r + 1; y < crafts.length; y++)
            crafts[x].socket.emit("snuffed", crafts[x].ID === crafts[y].ID,
                    crafts[x].pos, crafts[y].pos);

    crafts = crafts.slice(0, r + 1);
    if(crafts.length === 0) stopSim();
}

var simulator;
var running = false;

function startSim(){
    running = true;
    console.log("info : sim : start");
    simulator = setInterval(function(){
        doTick();
        sendShit();
    }, 33);
}

function stopSim(){
    running = false;
    clearInterval(simulator);
    console.log("info : sim : stop"); // for the trees mate
}

// When a client joins
io.on("connection", function(socket){
    console.log("info : soc : connect");
    var craft;

    socket.on("nick", function(nick){
        craft = new Craft(socket, nick, Date.now());
        console.log("info : soc : " + nick + " joined");
        craft.pos = findStartingPoint(false, 100);
        crafts.push(craft);
        if(!running) startSim();
        io.emit("ready", craft.ID);
    });

    socket.on("keys", function(key, on){
        switch(key){
        case 37: case 65: // left / A
            craft.rotate = (on) ? -0.2 : 0;
            break;
        case 38: case 87: // up / W
            craft.powered = on;
            break;
        case 39: case 68: // right / D
            craft.rotate = (on) ? 0.2 : 0;
            break;
        case 40: case 83: // down / S
            craft.breaking = on;
            break;
        case 32:    // spacebar
            if(on) craft.tryFiring();
        }
    });
});

function sendShit(){
    var craftsC = "", asteroidsC  = "", bulletsC = "", leaderboard = "";
    var x;
    for(x = 0; x < crafts.length; x++) craftsC += crafts[x].getCondensed() + ";";
    for(x = 0; x < asteroids.length; x++) asteroidsC += asteroids[x].getCondensed() + ";";
    for(x = 0; x < bullets.length; x++) bulletsC += bullets[x].getCondensed() + ";";
    crafts.sort(function(a, b){ return a.birth - b.birth; });
    for(x = 0; x < 10 && x < crafts.length; x++) leaderboard += crafts[x].nick + ";";
    for(x = 0; x < crafts.length; x++)
        crafts[x].socket.emit("map", x, craftsC, asteroidsC, bulletsC, leaderboard);
}

initialSetUp();
function initialSetUp(){
    var numAsteroids = 100;
    for (var i = 0 ; i < numAsteroids ; i++){
        var newast = new Asteroid(Math.floor(Math.random() * 50) + 50);
        newast.pos = findStartingPoint(true, 120);
        if(newast.pos.x != -1) asteroids.push(newast);
    }
}
