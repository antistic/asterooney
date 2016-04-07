var cvs, ctx;
var ship_cvs, shipo_cvs, shipy_cvs;
var ship_ctx;
var flameToggle = true;

var socket = io('http://localhost:3000');
var nick, ID;

// initialise stuff
function init() {
    // make canvas
    cvs = document.getElementById("canvas");
    ctx = cvs.getContext("2d");

    cvs.height = window.innerHeight;
    cvs.width = window.innerWidth;
    drawGrid(800, 800);

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
        drawCircle(sctx, x, y+9, 18, "#F90");
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
// Draw the convas
// Called whenever info arrives from the server
function draw(x, crafts, asteroids, bullets, leaderboard) {
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    var originX = crafts[x].pos.x;
    var originY = crafts[x].pos.y;

    drawGrid(originX, originY);
    drawThings(originX, originY, asteroids, drawAsteroid);
    drawThings(originX, originY, crafts, drawCraft);
    drawThings(originX, originY, bullets, drawBullet);
}

function drawGrid(x, y){
    var gridSize = 160;
    var w = x - canvas.width/2
    var h = y - canvas.height/2;
    var offsetX = w % gridSize;
    var offsetY = h % gridSize;

    // background
    ctx.fillStyle = "black";
    ctx.fillRect(0,0, cvs.width, cvs.height);

    // grid
    ctx.strokeStyle = "#0BB";
    for(var i = 0; i < (cvs.height/gridSize) + 1; i++){
        var pos = i*gridSize + 0.5 - offsetY;
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(cvs.width, pos);
        ctx.stroke();
    }
    for(var i = 0; i < (cvs.width/gridSize) + 1; i++){
        var pos = i*gridSize + 0.5 - offsetX;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, cvs.height);
        ctx.stroke();
    }

    // block out anything outside the grid
    // less than
    ctx.lineWidth = 3;
    if (w < 0) {
        var ww = -w;
        ctx.fillRect(0,0, ww, canvas.height);
        ctx.beginPath();
        ctx.moveTo(ww, 0);
        ctx.lineTo(ww, canvas.height);
        ctx.stroke();
    }
    if (h < 0) {
        h = -h;
        ctx.fillRect(0,0, canvas.width, h);
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(canvas.width, h);
        ctx.stroke();
    }
    // right & bottom of grid
    if (x + canvas.width/2 > 1000){
        var ww = 1000 - x + canvas.width/2;
        ctx.fillRect(ww, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(ww, 0);
        ctx.lineTo(ww, canvas.height);
        ctx.stroke();
    }
    if (y + canvas.height/2 > 1000){
        var hh = 1000 - y + canvas.height/2;
        ctx.fillRect(0, hh, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(canvas.width, hh);
        ctx.stroke();
    }
}

function drawThings(x, y, things, drawMethod){
    for(var i; i < things.length; i++){
        var xPos = (things[i].pos.x - x) + cvs.width/2;
        var yPos = (things[i].pos.y - y) + cvs.height/2;
        drawMethod(xPos, yPos, things[i]);
    }
}

function drawAsteroid(x, y, asteroid){
    ctx.beginPath();
    ctx.arc(x, y, asteroid.radius, 0, 2*Math.PI);
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
    // draw nickname. styles for these are set in draw()
    ctx.fillText(craft.nick, y + ship_ctx.height/2 + 10, x);

    ctx.translate(x, y);
    ship_ctx.rotate(craft.rotation);
    if (craft.powered){
        if (flameToggle){
            ctx.drawImage(shipo_cvs, -24, -27);
        } else {
            ctx.drawImage(shipy_cvs, -24, -27);
        }
        flameToggle = !flameToggle;
    } else {
        ctx.drawImage(ship_cvs, -24, -27);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawBullet(x, y){
    drawCircle(ctx, x-2, y-2, 3, "#0F0");
}
function connectToServer(){
    nick = document.getElementById("nickname").value || "Player";
    console.log("connecting to server, " + nick);
    socket.emit("nick", nick);
}
socket.on('map', function(craftNumber, crafts, asteroids, bullets, leaderboard){
    var crafts_expanded = parse_condensed(crafts);
    var asteroids_expanded = parse_condensed(asteroids);
    var bullets_expanded = parse_condensed(bullets);
    draw(craftNumber, crafts_expanded, asteroids_expanded, bullets_expanded, leaderboard);
});

socket.on('ready', function(IDd){
    ID = IDd;
    document.getElementById("Overlay").classList.add('hidden');

    window.addEventListener("keydown", function(e) {
        sendKey(e, true);
    });
    window.addEventListener("keydown", function(e) {
        sendKey(e, false);
    });

    cvs.focus();

    console.log("started :D");
});
socket.on('snuffed', function(IDd, position){
    if(IDd === ID){
        // load up nick choose again
    }
    // animate some explosion at the pos
});

function sendKey(e, on){
    switch(e.keyCode){
        // space, arrow keys, WASD
        case 32:
        case 37: case 65:
        case 38: case 87:
        case 39: case 68:
        case 40: case 83:
            socket.emit('keys', e.keyCode, on);
            break;
        default:
            break;
    }
}

// runs at start
window.onload = function(){
    init();
};
