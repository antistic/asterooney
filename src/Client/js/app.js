var cvs, ctx;
var ship_cvs, shipo_cvs, shipy_cvs;
var ship_ctx;
var flameToggle = true;

var socket = io("http://localhost:3000");
var nick, ID;

// initialise stuff
function init() {
    // make canvas
    cvs = document.getElementById("canvas");
    ctx = cvs.getContext("2d");

    cvs.height = window.innerHeight;
    cvs.width = window.innerWidth;

    shipo_cvs = prerenderShip("orange");
    shipy_cvs = prerenderShip("yellow");
    ship_cvs = prerenderShip("none");
    ship_ctx = ship_cvs.getContext("2d");

    window.addEventListener("resize", resizeCanvasToWindow, false);
    var submitButton = document.getElementById("submit");
    submitButton.addEventListener("click", onSubmit, false);
    var input = document.getElementById("nickname");
    input.addEventListener("keyup", onEnter, false);

    resizeCanvasToWindow();
    drawGrid(80, 80);
}
function onEnter(e){
    if(e.keyCode == 13){
        document.getElementById("submit").click();
    }
}
function onSubmit(){
    connectToServer();
}
function resizeCanvasToWindow(){
    cvs.height = window.innerHeight;
    cvs.width = window.innerWidth;
}

function prerenderShip(option){
    var scvs = document.createElement("canvas");
    var sctx = scvs.getContext("2d");
    scvs.width = 47;
    scvs.height = 56;

    var x = 24;
    var y = 27;
    // fire
    if (option === "orange") {
        drawCircle(sctx, x, y+9, 18, "#F80");
    }
    if (option === "yellow") {
        drawCircle(sctx, x, y+9, 18, "#FF0");
    }
    // gun
    drawCircle(sctx, x, y-15, 12, "#57F");
    // body
    drawCircle(sctx, x, y, 22, "#D11");
    // window
    drawCircle(sctx, x, y-6, 7, "#800");

    return scvs;
}
function drawGrid(x, y){
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;
    ctx.fillRect(0,0, cvs.width, cvs.height);
    ctx.strokeStyle = "#0BB";
    for(var f = x % 160; f < cvs.width; f += 160){
        ctx.beginPath();
        ctx.moveTo(f, 0);
        ctx.lineTo(f, cvs.height);
        ctx.stroke();
    }
    for(var f = y % 160; f < cvs.height; f += 160){
        ctx.beginPath();
        ctx.moveTo(0, f);
        ctx.lineTo(cvs.width, f);
        ctx.stroke();
    }
}
function draw(craftNumber, crafts, asteroids, bullets, leaderboard) {
    var playerX = crafts[craftNumber][0];
    var playerY = crafts[craftNumber][1];

    drawGrid(playerX, playerY);
    drawThings(playerX, playerY, asteroids, "asteroid");
    drawThings(playerX, playerY, bullets, "bullet");
    ctx.font = "12pt Roboto";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    drawThings(playerX, playerY, crafts, "craft");
}
function drawThings(x, y, things, thingType){
    var drawMethod;
    switch(thingType){
    case "craft":
        drawMethod = drawCraft;
        break;
    case "asteroid":
        drawMethod = drawAsteroid;
        break;
    case "bullet":
        drawMethod = drawBullet;
        break;
    }

    var xPos, yPos;
    for(var i=0; i < things.length; i++){
        for(var f = -10000; f <= 10000; f += 10000){
            for(var g = -10000; g <= 10000; g += 10000){
                xPos = x - things[i][0] + cvs.width/2 + f;
                yPos = y - things[i][1] + cvs.height/2 + g;
                drawMethod(xPos, yPos, things[i]);
            }
        }
    }
}
function drawAsteroid(x, y, asteroid){
    ctx.beginPath();
    ctx.arc(x, y, asteroid[2], 0, 2*Math.PI);
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "aqua";
    ctx.stroke();
}
function drawCircle(contxt, x, y, radius, colour){
    contxt.beginPath();
    contxt.arc(x, y, radius, 0, 2*Math.PI);
    contxt.fillStyle = colour;
    contxt.fill();
}
function drawCraft(x, y, craft){
    var nick = craft[2];
    var rotation = craft[4];
    ctx.fillText(nick, x, y - 40);

    ctx.translate(x, y);
    ctx.rotate(parseFloat(rotation) + 3.1416);
    if (craft[5] === "1"){
        if (flameToggle){
            ctx.drawImage(shipy_cvs, -24, -27);
        } else {
            ctx.drawImage(shipo_cvs, -24, -27);
        }
        flameToggle = !flameToggle;
    } else {
        ctx.drawImage(ship_cvs, -24, -27);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function drawBullet(x, y){
    drawCircle(ctx, x-2, y-2, 3, "#F00");
}

function connectToServer(){
    nick = document.getElementById("nickname").value || "Player";
    console.log("connecting to server, " + nick);
    socket.emit("nick", nick);
}
socket.on("map", function(craftNumber, crafts, asteroids, bullets, leaderboard){
    var crafts_expanded = parse_condensed(crafts);
    var asteroids_expanded = parse_condensed(asteroids);
    var bullets_expanded = parse_condensed(bullets);
    draw(craftNumber, crafts_expanded, asteroids_expanded, bullets_expanded, leaderboard);
});
function parse_condensed(items) {
    var r = items.split(";");
    // remove last element (there is always an extra ';', so an extra element is made on split)
    r.pop();
    for (var i=0; i < r.length; i++) r[i] = r[i].split(",");
    return r;
}
socket.on("ready", function(IDd){
    ID = IDd;

    document.getElementById("Overlay").classList.add("hidden");

    window.addEventListener("keydown", function(e) {
        sendKey(e, true);
    });
    window.addEventListener("keyup", function(e) {
        sendKey(e, false);
    });

    cvs.focus();

    console.log("started :D");
});
socket.on("snuffed", function(IDd, position){
    if(IDd === ID){
        // load up nick choose again
    }
    // animate some explosion at the pos
});

var flags = [false, false, false, false, false];
function sendKey(e, on){
    var fwatch = 0;
    switch(e.keyCode){
    // space, arrow keys, WASD
    case 32:
        fwatch++;
    case 37: case 65:
        fwatch++;
    case 38: case 87:
        fwatch++;
    case 39: case 68:
        fwatch++;
    case 40: case 83:
        break;
    default:
        return;
    }

    if(!on){
        flags[fwatch] = false;
        socket.emit("keys", e.keyCode, on);
    }else if(!flags[fwatch]){
        flags[fwatch] = true;
        socket.emit("keys", e.keyCode, on);
    }
}

// runs at start
window.onload = function(){
    init();
};
