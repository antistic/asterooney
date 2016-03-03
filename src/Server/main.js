var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
    res.send('Server\'s alive');
});

http.listen(3000, function(){
    console.log('alive on :3000');
});

var ID = 58663;

// Objects used

function Vector(myX, myY){
    this.x = myX;
    this.y = myY;

    this.translate = function(vec){
        this.x += vec.x;
        this.y += vec.y;
    };

    this.mult = function(m){
        this.x *= m;
        this.y *= m;
    };
}

function Craft(sock, id, birth){
    this.socket = sock;
    this.birthtime = birth;
    this.nick;
    this.ID = id;
    this.acc = new Vector(0,0);
    this.vel = new Vector(0,0);
    this.pos = new Vector(5000, 6000);
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
            this.acc.x = Math.sin(this.rotation);
            this.acc.y = -Math.cos(this.rotation);
        }
        this.vel.translate(this.acc);
        if(this.breaking){
            this.vel.mult(0.9);
        }
        this.pos.translate(this.vel);
    };

    this.bounceMove = function(){
        this.vel.mult(1.5);
        this.pos.translate(this.vel);
    };

    this.tryFiring = function(){
        if(this.firecooldown === 0){
            this.firecooldown = 15;
            this.firing = true;
        }
    };

    this.getCondensed = function(){
        return new CraftC(this.nick, this.ID, this.pos, this.rotation, this.powered);
    };
}

// packages the important information about
// a craft in an object (Condensed Craft)
function CraftC(nickn, id, poss, rotate, power){
    this.nick = nickn;
    this.ID = id;
    this.pos = poss;
    this.rotation = rotate;
    this.powered = power;
}

function Bullet(craft){
    this.vel = new Vector(Math.sin(craft.rotation) * 17 + craft.vel.x, -Math.cos(craft.rotation) * 17 + craft.vel.y);
    this.pos = new Vector(craft.pos.x, craft.pos.y);
    this.lifeLeft = 160;
    this.radius = 3;   // rad is 3 for client side drawing (y)

    this.move();
    this.move();

    this.move = function(){
        this.pos.translate(this.vel);
        this.lifeLeft--;
    };

    this.isAlive = function(){
        return this.lifeLeft > 0;
    };

    this.getCondensed = function(){
        return new BulletC(this.pos);
    };
}

function BulletC(poss){
    this.pos = poss;
}

function Asteroid(rad){
    this.vel = new Vector(0,0);
    this.radius = rad;
    this.pos = new Vector(5000, 5000);

    this.move = function(){
        this.vel.mult(0.997);
        this.pos.translate(this.vel);
    };

    this.getCondensed = function(){
        return new AsteroidC(this.pos, this.radius);
    };
}

function AsteroidC(poss, rad){
    this.pos = poss;
    this.radius = rad;
}

// Helper methods

// Returns distance between two points (vectors)
function distancesq(p1, p2){
    var x = p1.x - p2.x;
    var y = p1.y - p2.y;
    return x * x + y * y;
}

function isTouching(a, b){
    return distancesq(a.pos, b.pos) < (a.radius + b.radius)*(a.radius + b.radius);
}

// Ticking

var crafts = [];
var asteroids = [];
var bullets = [];

// TODO: initialize these with dimensions of full field
var totalHeight = 10000;
var totalWidth = 10000;

// TODds a free spot on the map and returns the vector
function findStartingPoint(radius){
    // Randomly choose coordinates until you find
    // a pair that is not within a certain radius
    // of anything else
    var x = Math.floor(Math.random()*totalWidth);
    var y = Math.floor(Math.random()*totalHeight);

    while (!validStartingPoint(x, y, radius)) {
        x = Math.floor(Math.random()*totalWidth);
        y = Math.floor(Math.random()*totalHeight);
    }

    return new Vector(x,y);
}

function validStartingPoint(x,y, radius){
    var vec = new Vector(x,y);
    return checkFor(crafts, vec, radius) &&
           checkFor(bullets, vec, radius) &&
           checkFor(asteroids, vec, radius);
}

function checkFor(objects, vec, radius){

    console.log(objects.length);

    for (var i = 0 ; i < objects.length ; i++){
        if (distancesq(vec, objects[i].pos) < radius){
            return false;
        }
    }
   return true;
}

// NOTE: has been split in three for clarity/readability :)
function doTick(){
    moveObjects();
    checkCollisions();
    disposeOfDeadBodies();
}

// Move everything
function moveObjects(){
    // Move all crafts
    for(var x = 0; x < crafts.length; x++){
        crafts[x].move();
        if(crafts[x].firing){
            crafts[x].firing = false;
            // add new Bullet
            bullets.push(new Bullet(crafts[x]));
        }
    }

    // Move all bullets
    for(var x = 0; x < bullets.length; x++){
        bullets[x].move();
    }

    // Move all asteroids
    for(var x = 0; x < asteroids.length; x++){
        asteroids[x].move();
    }
}

// Hit everything
function checkCollisions(){

    // Crafts against boundary
    for (var x = 0 ; x < crafts.length ; x++){
        if (crafts[x].pos.x < 0 || crafts[x].pos.x >= totalWidth){
            crafts[x].vel.x *= -1;
            crafts[x].bounceMove();
        }
        else if (crafts[x].pos.y < 0 || crafts[x].pos.y >= totalHeight){
            crafts[x].vel.y *= -1;
            crafts[x].bounceMove();
        }
    }

    // Asteroids against boundary
    for (var x = 0 ; x < asteroids.length ; x++){
        if (asteroids[x].pos.x < 0 || asteroids[x].pos.x >= totalWidth){
            asteroids[x].vel.x *= -1;
            asteroids[x].move();
        }
        else if (asteroids[x].pos.y < 0 || asteroids[x].pos.y >= totalHeight){
            asteroids[x].vel.y *= -1;
            asteroids[x].move();
        }
    }

    // Bullets against boundary
    for (var x = 0 ; x < bullets.length ; x++){
        if (bullets[x].pos.x < 0 || bullets[x].pos.x >= totalWidth){
            bullets[x].vel.x *= -1;
            bullets[x].move();
        }
        else if (bullets[x].pos.y < 0 || bullets[x].pos.y >= totalHeight){
            bullets[x].vel.y *= -1;
            bullets[x].move();
        }
    }

    // Asteroids against crafts
    for(var x = 0; x < crafts.length; x++){
        for(var y = 0; y < asteroids.length; y++){
            if(isTouching(asteroids[y], crafts[x])){
                crafts[x].dead = true;
            }
        }
    }

    // Asteroids against asteroids
    for(var x = 0; x < asteroids.length - 1; x++){
        for(var y = x + 1; y < asteroids.length; y++){
            if(isTouching(asteroids[x], asteroids[y])){
                var a = asteroids[x];
                var b = asteroids[y];
                a.vel.x = (a.vel.x * (a.radiussq - b.radiussq) + (2 * b.radiussq * b.vel.x)) / 2;
                a.vel.y = (a.vel.y * (a.radiussq - b.radiussq) + (2 * b.radiussq * b.vel.y)) / 2;
                b.vel.x = (b.vel.x * (b.radiussq - a.radiussq) + (2 * a.radiussq * a.vel.x)) / 2;
                b.vel.y = (b.vel.y * (b.radiussq - a.radiussq) + (2 * a.radiussq * a.vel.y)) / 2;
                a.move();
                b.move();
            }
        }
    }

    // Bullets against asteroids
    for(var x = 0; x < bullets.length; x++){
        if(!bullets[x].isAlive()) continue;
        for(var y = 0; y < asteroids.length; y++){
            if(isTouching(asteroids[y], bullets[x])){
                asteroids[y].vel.set(bullets[x].vel);
                bullets[x].lifeLeft = 0;
            }
        }
    }

    // Bullets against bullets
    for(var x = 0; x < bullets.length - 1; x++){
        if(!bullets[x].isAlive()) continue;
        for(var y = x + 1; y < bullets.length; y++){
            if(!bullets[y].isAlive()) continue;
            if(isTouching(bullets[x], bullets[y])){
                bullets[x].lifeLeft = 0;
                bullets[y].lifeLeft = 0;
            }
        }
    }

    // Bullets against crafts
    for(var x = 0; x < crafts.length; x++){
        if(crafts[x].dead) continue;
        for(var y = 0; y < bullets.length; y++){
            if(!bullets[y].isAlive()) continue;
            if(isTouching(bullets[y], crafts[x])){
                bullets[y].lifeLeft = 0;
                crafts[x].dead = true;
            }
        }
    }

    // Crafts against crafts
    for(var x = 0; x < crafts.length - 1; x++){
        if(crafts[x].dead) continue;
        for(var y = x + 1; y < crafts.length; y++){
            if(crafts[y].dead) continue;
            if(isTouching(crafts[x], crafts[y])){
                crafts[x].dead = true;
                crafts[y].dead = true;
            }
        }
    }
}


function disposeOfDeadBodies(){
    // any bullets might be dead so check them all
    // move any dead ones to the back
    // A[0..l) are alive and A[r+1..n) are dead
    var r = bullets.length;
    var l = 0;
    for(r = bullets.length - 1; r >= 0; r--){

        if(!bullets[r].isAlive()) continue;
        while(bullets[l].isAlive() && l !== r) l++;

        if(l === r){
            break;
        }else{
            bullets[l] = bullets[r];
        }
    }
    // get rid of dead ones
    bullets = bullets.slice(0, r + 1);

    // any crafts might be dead so check them all
    // move any dead ones to the back
    // A[0..l) are alive and A[r+1..n) are dead
    r = crafts.length;
    l = 0;
    for(r = crafts.length - 1; r >= 0; r--){

        if(crafts[r].dead) continue;
        while(!crafts[l].dead && l !== r) l++;

        if(l === r){
            break;
        }else{
            crafts[l] = crafts[r];
        }
    }
    // get rid of dead ones

    for(var x = 0; x < crafts.length; x++){
        for(var y = r + 1; y < crafts.length; y++){
            crafts[x].socket.emit('snuffed', crafts[y].ID, crafts[y].pos);
        }
    }

    crafts = crafts.slice(0, r + 1);
}

// network and simulator stuff
var simulator;
var running = false;

function startSim(){
    running = true;
    console.log('running sim');
    simulator = setInterval(function(){
        doTick();
        sendShit();
    }, 30);
}

function stopSim(){
    running = false;
    clearInterval(simulator);
    console.log('low power mode');
    // for the trees mate
}

// When a client joins
io.sockets.on('connection', function(socket){

    console.log("got a connection");
    craft = new Craft(socket, ID++);

    socket.on('nick', function(nick){
        craft.nick = nick;
        craft.birth = Date.now();
        console.log("Welcome " + nick + " ;)");
        craft.pos = findStartingPoint(100);
        //findStartingPoint(craft);
        crafts.push(craft);
        if(!running) startSim();
        io.emit('ready', craft.ID);
    });

    socket.on('keys', function(key, on){
        switch(key){
            case 37: case 65: // left / A
                craft.rotate += (on) ? -0.08 : 0.08;
                //0.08 is multiplier set so far
                break;
            case 38: case 87: // up / W
                craft.powered = on;
                break;
            case 39: case 38: // right / D
                craft.rotate += (on) ? 0.08 : -0.08;
                break;
            case 40: case 83: // down / S
                craft.breaking = on;
                break;
            case 32:    // spacebar
                if(on) craft.tryFiring();
        }
    });

    socket.on('disconnect', function(){
       /*
       console.log(craft.ID + " has disappeared...");
       // TODO
       // remove craft from list
       var c;
       for(var x = 0; x < crafts.length; x++){
           if(crafts[x].ID === craft.ID){
               crafts[x] = crafts[crafts.length - 1];
               crafts.pop();
               if(crafts.length === 0) stopSim();
               return;
           }
       }
       throw "missing craft";*/
    });

});

function sendShit(){

    // leaderboard is array of strings
    // leaderboard[0] = 1st place
    var craftsC = [];
    var asteroidsC  = [];
    var bulletsC = [];
    var leaderboard = [];

    for(var x = 0; x < crafts.length; x++){
        craftsC.push(crafts[x].getCondensed());
    }
    for(var x = 0; x < asteroids.length; x++){
        asteroidsC.push(asteroids[x].getCondensed());
    }
    for(var x = 0; x < bullets.length; x++){
        bulletsC.push(bullets[x].getCondensed());
    }

    crafts.sort(function(a, b){
       return a.birth - b.birth;
    });

    for(var x = 0; x < 10 && x < crafts.length; x++){
        leaderboard.push(crafts[x].nick);
    }

    for(var x = 0; x < crafts.length; x++){
        var socket = crafts[x].socket;
        socket.emit('map', crafts[x], craftsC, asteroidsC, bulletsC, leaderboard);
    }
}

// Set up the map with asteroids
function initialSetUp(){
    var numAsteroids = 20;
    for (var i = 0 ; i < numAsteroids ; i++){
        var newast = new Asteroid(Math.floor(Math.random() * 50) + 50);
        newast.pos = findStartingPoint(400);
        asteroids.push(newast);
    }
}

// make that actually happen
initialSetUp();
