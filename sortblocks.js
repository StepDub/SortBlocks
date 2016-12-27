//licence: CC0

var game;

function play(preset){
	//preset: 0=custom,1-16=levels
	document.getElementById("menu").style.display="none";
	document.getElementById("game").style.display="block";
	if (preset==0){
		var size=document.getElementById("size_select").selectedIndex+4;
		var colors=document.getElementById("colors_select").selectedIndex+1;
		var wr=Math.round(document.getElementById("white_input").value)/100;
		var gseed=document.getElementById("seed_input").value;
	}else if (preset>=1){
		var size=  [  4,  5,  6,   7,  8,    5,  5,  4,   4,     5,  6,  6,   6,    7,   7,   8,   5,   5,     6,   5,   5,   5][preset-1];
		var colors=[  1,  2,  3,   4,  5,    3,  4,  3,   4,     4,  2,  3,   5,    3,   4,   5,   3,   3,     5,   6,  12,   8][preset-1];
		var wr=    [0.6,0.5,0.4,0.35,0.3,  0.5,0.5,0.4, 0.3,  0.35,0.4,0.3,0.33,  0.3,0.25,0.25, 0.3, 0.3,   0.2, 0.1, 0.1, 0.1][preset-1];
		var gseed= [  3,  3,  3,   3,  3,    1,  2,  3,9829,     2,  2,  2,4730,    1,   7,   1,7698,4933,  9343,8969,3551,3154][preset-1];
	}
	game=new Game(preset,size,colors,wr,gseed);
	window.addEventListener('resize', resize_listener, false);
}

function play_exit(){
	if (game.preset > 0 && game.won){
		set_won(game.preset);
	}
	window.removeEventListener('resize', resize_listener, false);
	game=null;
	document.getElementById("menu").style.display="block";
	document.getElementById("game").style.display="none";
	show_wins();
}

function resize_listener(e){
	game.draging=false;
	game.init_canvas();
	game.draw_all();
}

function RNG(seed) {
  // LCG using GCC's constants
  this.m = 0x100000000; // 2**32;
  this.a = 1103515245;
  this.c = 12345;

  this.state = seed ? seed : Math.floor(Math.random() * (this.m-1));
}
RNG.prototype.nextInt = function() {
  this.state = (this.a * this.state + this.c) % this.m;
  return this.state;
}
RNG.prototype.nextBoolean = function() {
  return 1>(10*Math.random())%2;
}
RNG.prototype.nextFloat = function() {
  // returns in range [0,1]
  return this.nextInt() / (this.m - 1);
}
RNG.prototype.nextRange = function(start, end) {
  // returns in range [start, end): including start, excluding end
  // can't modulu nextInt because of weak randomness in lower bits
  var rangeSize = end - start;
  var randomUnder1 = this.nextInt() / this.m;
  return start + Math.floor(randomUnder1 * rangeSize);
}
RNG.prototype.choice = function(array) {
  return array[this.nextRange(0, array.length)];
}

function rounded_rect(ctx,x0,y0,x1,y1,r){
	ctx.arc(x0+r,y0+r,r,Math.PI,1.5*Math.PI);
	ctx.lineTo(x1-r,y0);
	ctx.arc(x1-r,y0+r,r,1.5*Math.PI,0);
	ctx.lineTo(x1,y1-r);
	ctx.arc(x1-r,y1-r,r,0,0.5*Math.PI);
	ctx.lineTo(x0+r,y1);
	ctx.arc(x0+r,y1-r,r,0.5*Math.PI,Math.PI);
	ctx.lineTo(x0,y0+r);
}

//====================
function Game(preset,size,colors,white_ratio,seed){
	this.preset=preset;
	this.size=size;
	this.sizex=size;
	this.sizey=size;
	this.colors=colors;
	this.white_ratio=white_ratio;
	this.draging=false;
	this.drag_x=0;
	this.drag_y=0;
	this.click_x=0;
	this.click_y=0;
	this.seed=seed;
	this.canv = document.getElementById("canv");
	this.ctx = this.canv.getContext("2d");
	this.canv_offset=30;
	
	this.init_canvas();
	
	this.g=[];
	this.won=false;
	this.block_size=[];
	
	this.canv.addEventListener('touchstart', function(e){
		var event = e.targetTouches[0];
		var parentPosition = getPosition(e.currentTarget);
		var xPos = event.clientX - parentPosition.x - game.canv_offset;
		var yPos = event.clientY - parentPosition.y - game.canv_offset;
		var mx=Math.floor(xPos/game.box_size);
		var my=Math.floor(yPos/game.box_size);
		var click_x=xPos-(mx*game.box_size+game.box_size/2);
		var click_y=yPos-(my*game.box_size+game.box_size/2);
		if ( game.in_grid(mx,my) && game.g[mx][my] != 0 ){
			game.draging=true;
			game.drag_x=mx;
			game.drag_y=my;
			game.click_x=click_x;
			game.click_y=click_y;
		}
		e.preventDefault();
	}, false)
 
	this.canv.addEventListener('touchmove', function(e){
		function minps(x1,x2){//min preserve x1's sign
			if (x1<0){
				return Math.max(x1,-x2);
			}else{
				return Math.min(x1,x2);
			}
		}
		//e.preventDefault()
		if (game.draging){
			var event = e.targetTouches[0];
			var parentPosition = getPosition(e.currentTarget);
			var xPos = event.clientX - parentPosition.x - game.canv_offset;
			var yPos = event.clientY - parentPosition.y - game.canv_offset;
			var mx=Math.floor((xPos-game.click_x)/game.box_size);
			var my=Math.floor((yPos-game.click_y)/game.box_size);
			
			if ( ( Math.abs(game.drag_x-mx) >= 1 && game.drag_y-my == 0 ) || 
									( Math.abs(game.drag_y-my) >= 1 && game.drag_x-mx == 0 ) ){
				var osx=minps(mx-game.drag_x,1);
				var osy=minps(my-game.drag_y,1);			
				if(game.try_move(game.drag_x,game.drag_y,osx,osy)){
					game.drag_x+=osx;
					game.drag_y+=osy;
				}
			}
		}
		e.preventDefault();
	}, false)
 
	this.canv.addEventListener('touchend', function(e){
		game.draging=false;
		e.preventDefault();
	}, false)

	this.canv.addEventListener('touchleave', function(e){
		game.draging=false;
		e.preventDefault();
	}, false)
	
	this.canv.addEventListener('touchcancel', function(e){
		game.draging=false;
		e.preventDefault();
	}, false)
	
	this.canv.onmousedown = function(event){
		var parentPosition = getPosition(event.currentTarget);
		var xPos = event.clientX - parentPosition.x - game.canv_offset;
		var yPos = event.clientY - parentPosition.y - game.canv_offset;
		var mx=Math.floor(xPos/game.box_size);
		var my=Math.floor(yPos/game.box_size);
		var click_x=xPos-(mx*game.box_size+game.box_size/2);
		var click_y=yPos-(my*game.box_size+game.box_size/2);
		if ( game.in_grid(mx,my) && game.g[mx][my] != 0 ){
			game.draging=true;
			game.drag_x=mx;
			game.drag_y=my;
			game.click_x=click_x;
			game.click_y=click_y;
		}
	};
	
	this.canv.onmousemove = function(event){
		function minps(x1,x2){//min preserve x1's sign
			if (x1<0){
				return Math.max(x1,-x2);
			}else{
				return Math.min(x1,x2);
			}
		}

		if (game.draging){
			var parentPosition = getPosition(event.currentTarget);
			var xPos = event.clientX - parentPosition.x - game.canv_offset;
			var yPos = event.clientY - parentPosition.y - game.canv_offset;
			var mx=Math.floor((xPos-game.click_x)/game.box_size);
			var my=Math.floor((yPos-game.click_y)/game.box_size);
		
			if ( ( Math.abs(game.drag_x-mx) >= 1 && game.drag_y-my == 0 ) || 
									( Math.abs(game.drag_y-my) >= 1 && game.drag_x-mx == 0 ) ){
				var osx=minps(mx-game.drag_x,1);
				var osy=minps(my-game.drag_y,1);			
				if(game.try_move(game.drag_x,game.drag_y,osx,osy)){
					game.drag_x+=osx;
					game.drag_y+=osy;
				}
			}
		}
	};
	
	this.canv.onmouseup = function(event){
		game.draging=false;
	};

	this.canv.onmouseout = function(event){
		game.draging=false;
	};

	this.reset();
}

Game.prototype.reset=function(){
	this.randomize(this.seed);
	this.draw_all();
	this.check_win(0,0);	
}

Game.prototype.init_canvas=function(){
	var s=Math.min(window.innerWidth-60,window.innerHeight-116);
	this.box_size=Math.max( Math.floor( Math.min(s/this.size,100) ),14 );
	this.canv.width=this.size*this.box_size+this.canv_offset*2;
	this.canv.height=this.size*this.box_size+this.canv_offset*2;
	
	this.ctx.translate(0,0);
	this.ctx.beginPath();
	this.ctx.strokeStyle="#e4e4e4";
	this.ctx.lineWidth=15;
	rounded_rect(this.ctx,15,15,this.canv.width-15,this.canv.height-15,25);
	this.ctx.stroke();
	this.ctx.translate(this.canv_offset,this.canv_offset);
}

Game.prototype.randomize=function(rseed){
	//all squares random colors
	rng=new RNG(rseed);
	for(var ix=0; ix<this.sizex; ix++){
		this.g[ix]=[];
		for(var iy=0; iy<this.sizey; iy++){
			this.g[ix][iy]=Math.floor(rng.nextFloat()*this.colors)+1;
		}
	}
	//make some white
	var whitesquares=this.sizex * this.sizey * this.white_ratio;
	whitesquares=Math.round(whitesquares);
	while (whitesquares>0){
		var rx=Math.floor(rng.nextFloat()*this.sizex);
		var ry=Math.floor(rng.nextFloat()*this.sizey);
		if (this.g[rx][ry]!=0){
			this.g[rx][ry]=0;
			whitesquares--;
		}
	}
	//count each color (required for win check)
	for (var i=0; i<=this.colors; i++){
		 this.block_size[i]={size: 0, got: 0};
	}
	for(var ix=0; ix<this.sizex; ix++){
		for(var iy=0; iy<this.sizey; iy++){
			if (this.g[ix][iy]!=0){
				this.block_size[this.g[ix][iy]].size++;
			}
		}
	}
	//find already compleated colors
	for(var ix=0; ix<this.sizex; ix++){
		for(var iy=0; iy<this.sizey; iy++){
			if (this.g[ix][iy]!=0 && this.block_size[this.g[ix][iy]].got==0){
				this.block_size[this.g[ix][iy]].got=this.find_block(ix,iy).length;
			}
		}
	}
}

Game.prototype.draw_all=function(){
	for (var ix=0; ix<this.sizex; ix++){
		for(var iy=0; iy<this.sizey; iy++){
			this.draw(ix,iy);
		}
	}
}

Game.prototype.draw=function(ix,iy){
	var r=Math.round(this.box_size/3.9);
	var colors=['#ffffff','#f70b0b','#20ef25','#575eff','#ffff00','#ea16f7','#06eaef','#ff9915','#63d27f','#ba70ff','#bc7933','#a91e50','#f9bfc8'];
	var col=this.g[ix][iy];
	var top=this.get_color(ix,iy-1);
	var left=this.get_color(ix-1,iy);
	var right=this.get_color(ix+1,iy);
	var bottom=this.get_color(ix,iy+1);
	var x0=ix*this.box_size;
	var y0=iy*this.box_size;
	var x1=x0+this.box_size;
	var y1=y0+this.box_size;
	
	this.ctx.beginPath();
	this.ctx.fillStyle=colors[col];
	//rounded_rect(this.ctx,x0,y0,x1,y1,r);
	this.ctx.rect(x0,y0,this.box_size,this.box_size);
	this.ctx.fill();
	
	/*if (debug){
		var dex=x0+(this.box_size/2);
		var dey=y0+(this.box_size/2);
		this.ctx.beginPath();
		this.ctx.fillStyle="black";
		//rounded_rect(ctx,x0,y0,x1,y1,r);
		this.ctx.rect(dex-1,dey-1,2,2);
		this.ctx.fill();
	}*/
	
	if (top!=col && left!=col){
		this.ctx.beginPath();
		if (top==left && top==this.get_color(ix-1,iy-1)){
			this.ctx.fillStyle=colors[top];
		}else{
			this.ctx.fillStyle=colors[0];
		}
		this.ctx.moveTo(x0,y0);
		this.ctx.arc(x0+r,y0+r,r,Math.PI,1.5*Math.PI);
		this.ctx.fill();
	}
	if (top!=col && right!=col){
		this.ctx.beginPath();
		if (top==right && top==this.get_color(ix+1,iy-1)){
			this.ctx.fillStyle=colors[top];
		}else{
			this.ctx.fillStyle=colors[0];
		}
		this.ctx.moveTo(x1,y0);
		this.ctx.arc(x1-r,y0+r,r,1.5*Math.PI,0);
		this.ctx.fill();
	}
	if (bottom!=col && right!=col){
		this.ctx.beginPath();
		if (bottom==right && bottom==this.get_color(ix+1,iy+1)){
			this.ctx.fillStyle=colors[bottom];
		}else{
			this.ctx.fillStyle=colors[0];
		}
		this.ctx.moveTo(x1,y1);
		this.ctx.arc(x1-r,y1-r,r,0,0.5*Math.PI);
		this.ctx.fill();
	}
	if (bottom!=col && left!=col){
		this.ctx.beginPath();
		if (bottom==left && bottom==this.get_color(ix-1,iy+1)){
			this.ctx.fillStyle=colors[bottom];
		}else{
			this.ctx.fillStyle=colors[0];
		}
		this.ctx.moveTo(x0,y1);
		this.ctx.arc(x0+r,y1-r,r,0.5*Math.PI,Math.PI);
		this.ctx.fill();
	}
	
}

Game.prototype.get_color=function(x,y){
	return this.in_grid(x,y) ? this.g[x][y] : 0;
}

Game.prototype.in_grid=function(x,y){
	 return (x>=0 && y>=0 && x<this.sizex && y<this.sizey)
}

Game.prototype.try_move=function(fx,fy,osx,osy){
	var col=this.g[fx][fy];
	var block=this.find_block(fx,fy);
	var movable=true;
	for (var box=0; box<block.length; box++){
		var tox=block[box].x+osx;
		var toy=block[box].y+osy;
		if ( !this.in_grid(tox,toy) || ( this.g[tox][toy]!=col && this.g[tox][toy]!=0 ) ){
			movable=false;
		}
	}
	if (movable){
		var all_done=false;
		while (!all_done){
			all_done=true;
			for (var box=0; box<block.length; box++){
				var tox=block[box].x+osx;
				var toy=block[box].y+osy;
				if (this.g[tox][toy]==0){
					this.g[tox][toy]=col;
					this.g[block[box].x][block[box].y]=0;
					all_done=false;
				}
			}
		}
		var griddraw=[];
		for (var i=0; i<this.sizex; i++){
			griddraw[i]=[];
		}
		var thisthis=this;
		function drawonce(ix,iy){
			if (thisthis.in_grid(ix,iy) && !griddraw[ix][iy]){
				thisthis.draw(ix,iy);
				griddraw[ix][iy]=true;
			}
		}
		for (var box=0; box<block.length; box++){
			var x=block[box].x;//+osx;
			var y=block[box].y;//+osy;
			drawonce(--x,y-1);
			drawonce(x,y);
			drawonce(x++,y+1);
			drawonce(x,y-1);
			drawonce(x,y);
			drawonce(x++,y+1);
			drawonce(x,y-1);
			drawonce(x,y);
			drawonce(x--,y+1);
			x+=osx;
			y+=osy;
			drawonce(--x,y-1);
			drawonce(x,y);
			drawonce(x++,y+1);
			drawonce(x,y-1);
			drawonce(x,y);
			drawonce(x++,y+1);
			drawonce(x,y-1);
			drawonce(x,y);
			drawonce(x,y+1);
		}	
		block=this.find_block(fx+osx,fy+osy);
		this.check_win(col,block.length);
	}
	return movable;
}

Game.prototype.check_win=function(col,block_size){
	this.block_size[col].got=block_size;
	var won=true;
	for (var c=1; c<=this.colors; c++){
		if ( this.block_size[c].size != this.block_size[c].got ){
			won=false;
		}
	}
	if (won){
		centre_x=this.sizex*this.box_size/2;
		centre_y=this.sizey*this.box_size/2;
		this.ctx.beginPath();
		this.ctx.fillStyle="rgba(0,0,0,0.4)";
		rounded_rect(this.ctx,centre_x-100,centre_y-100,centre_x+100,centre_y+100,40);
		//this.ctx.rect(x0,y0,this.box_size,this.box_size);
		this.ctx.fill();
		//
		this.ctx.beginPath();
		this.ctx.fillStyle="#20ff20";
		this.ctx.font="200px sans-serif";
		this.ctx.fillText("✔", centre_x-75, centre_y+75);
		this.ctx.fill();
		//document.getElementById("tick").style.display="block";
		this.won=true;
	}
}

Game.prototype.find_block=function(x,y){
	var col=this.g[x][y];
	var gridfound=[];
	for (var i=0; i<this.sizex; i++){
		gridfound[i]=[];
	}
	var found=[];
	this.add_box(found,gridfound,col,x,y);
	return found;
}

Game.prototype.add_box=function(found,gridfound,col,x,y){
	if ( this.in_grid(x,y) && this.g[x][y]==col && !gridfound[x][y] ){
		gridfound[x][y]=true;
		found.push({x:x, y:y});
		this.add_box(found,gridfound,col,x-1,y);
		this.add_box(found,gridfound,col,x+1,y);
		this.add_box(found,gridfound,col,x,y-1);
		this.add_box(found,gridfound,col,x,y+1);
	}
}
//----------
function getPosition(element) {
    var xPosition = 0;
    var yPosition = 0;
      
    while (element) {
        xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
        yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
        element = element.offsetParent;
    }
    return { x: xPosition, y: yPosition };
}

more_levels_open=false;
function more_levels(){
	if (more_levels_open){
		document.getElementById("more_levels_div").style.display="none";
		document.getElementById("mltree").innerHTML="▶More levels";
		more_levels_open=false;
	}else{
		document.getElementById("more_levels_div").style.display="block";
		document.getElementById("mltree").innerHTML="▼More levels";
		more_levels_open=true;
	}
}

custom_game_open=false;
function custom_game(){
	if (custom_game_open){
		document.getElementById("custom_game_div").style.display="none";
		document.getElementById("cgtree").innerHTML="▶Custom game";
		custom_game_open=false;
	}else{
		document.getElementById("custom_game_div").style.display="block";
		document.getElementById("cgtree").innerHTML="▼Custom game";
		custom_game_open=true;
	}
}	

function random_seed(){
	document.getElementById("seed_input").value=Math.floor(Math.random()*10000)+1;
}

function show_wins(){
	for (var i=1; i<=22; i++){
		if (get_won(i)){
			document.getElementById("pb"+i).value=i;//+"✔";
			document.getElementById("pb"+i).style.color="#00d000";
		}else{
			document.getElementById("pb"+i).value=i;
		}
	}
}

function get_won(level){
	var done_str=localStorage.sbdone_str;
	var ver_str=localStorage.sbversion;
	if (typeof done_str != "string" || ver_str != "1.1"){
		done_str="";
	}
	localStorage.sbdone_str=done_str;
	localStorage.sbversion="1.1";
	if (done_str.length < level){
		return false;
	}else{
		return done_str.charAt(level-1)=="1";
	}
}

function set_won(level){
	var done_str=localStorage.sbdone_str;
	if (typeof done_str != "string"){
		done_str="";
	}
	while (done_str.length < level){
		done_str+="0";
	}
	done_str = done_str.substr(0, level-1) + "1" + done_str.substr(level);
	localStorage.sbdone_str=done_str;
	localStorage.sbversion="1.1";
}

