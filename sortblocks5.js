//licence: CC0
'use strict';

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

class Game {
	constructor () {
		this.canv = document.getElementById("canv");
		this.ctx = this.canv.getContext("2d");
		this.canv_offset=30;
	}
	
	play(preset){
		this.preset=preset;
		//preset: 0=custom,1-16=levels
		document.getElementById("menu_page").style.display="none";
		document.getElementById("game_page").style.display="block";
		[this.diff,this.size,this.colors,this.white_ratio,this.seed]=get_preset_data(preset);
		this.sizex=this.size;
		this.sizey=this.size;
		this.draging=false;
		this.drag_x=0;
		this.drag_y=0;
		this.click_x=0;
		this.click_y=0;
		this.rng=0;
		this.init_canvas();
		this.g=[];
		//this.won=false; //in reset(), called below
		this.block_size=[];
		const minps= (x1,x2) => (x1<0)? Math.max(x1,-x2): Math.min(x1,x2); //minimum but preserve x1's sign
		
		let start_drag=(event,parentPosition)=>{
			const xPos = event.clientX - parentPosition.x - this.canv_offset;
			const yPos = event.clientY - parentPosition.y - this.canv_offset;
			const mx=Math.floor(xPos/this.box_size);
			const my=Math.floor(yPos/this.box_size);
			const click_x=xPos-(mx*this.box_size+this.box_size/2);
			const click_y=yPos-(my*this.box_size+this.box_size/2);
			if ( this.in_grid(mx,my) && this.g[mx][my] != 0 ){
				this.draging=true;
				this.drag_x=mx;
				this.drag_y=my;
				this.click_x=click_x;
				this.click_y=click_y;
			}
		};
		
		this.canv.addEventListener('touchstart', function(e){
			start_drag(e.targetTouches[0],this.getPosition(e.currentTarget));
			e.preventDefault();
		}, false);
			 
		let drag=(event,parentPosition)=>{
			if (this.draging){
				const xPos = event.clientX - parentPosition.x - this.canv_offset;
				const yPos = event.clientY - parentPosition.y - this.canv_offset;
				const mx=Math.floor((xPos-this.click_x)/this.box_size);
				const my=Math.floor((yPos-this.click_y)/this.box_size);
				
				if ( ( Math.abs(this.drag_x-mx) >= 1 && this.drag_y-my == 0 ) || 
										( Math.abs(this.drag_y-my) >= 1 && this.drag_x-mx == 0 ) ){
					const osx=minps(mx-this.drag_x,1);
					const osy=minps(my-this.drag_y,1);			
					if(this.try_move(this.drag_x,this.drag_y,osx,osy)){
						this.drag_x+=osx;
						this.drag_y+=osy;
					}
				}
			}
		}
			 
		this.canv.addEventListener('touchmove', function(e){
			drag(e.targetTouches[0],this.getPosition(e.currentTarget));
			e.preventDefault();
		}, false);
	 
		this.canv.addEventListener('touchend', function(e){
			this.draging=false;
			e.preventDefault();
		}, false);
	
		this.canv.addEventListener('touchleave', function(e){
			this.draging=false;
			e.preventDefault();
		}, false);
		
		this.canv.addEventListener('touchcancel', function(e){
			this.draging=false;
			e.preventDefault();
		}, false);
		
		this.canv.onmousedown = (event) => {
			start_drag(event,this.getPosition(event.currentTarget));
		};
		
		this.canv.onmousemove = (event) => {	
			drag(event,this.getPosition(event.currentTarget));
		};
		
		this.canv.onmouseup = (event) => {
			this.draging=false;
		};
	
		this.canv.onmouseout = (event) => {
			this.draging=false;
		};
		
		window.addEventListener('resize', this.resize_listener, false);
		this.reset();
	}
	
	reset() {
		this.won=false;
		this.randomize(this.seed);
		this.draw_all();
		this.check_win(0,0);
	}
	
	init_canvas() {
		const s=Math.min(window.innerWidth-60,window.innerHeight-116);
		this.box_size=Math.max( Math.floor( Math.min(s/this.size,100) ),14 );
		this.canv.width=this.size*this.box_size+this.canv_offset*2;
		this.canv.height=this.size*this.box_size+this.canv_offset*2;
		
		this.ctx.translate(0,0);
		this.ctx.beginPath();
		this.ctx.strokeStyle="#e4e4e4";
		this.ctx.lineWidth=15;
		this.rounded_rect(this.ctx,15,15,this.canv.width-15,this.canv.height-15,25);
		this.ctx.stroke();
		this.ctx.translate(this.canv_offset,this.canv_offset);
	}
	
	game_end() {
		window.removeEventListener('resize', this.resize_listener, false);
		document.getElementById("menu_page").style.display="block";
		document.getElementById("game_page").style.display="none";
		this.show_wins();
	}
	
	resize_listener(e) {
		game.draging=false;
		game.init_canvas();
		game.draw_all();
	}
	
	randomize(rseed){
		//all squares random colors
		this.rng=new RNG(rseed);
		for(let ix=0; ix<this.sizex; ix++){
			this.g[ix]=[];
			for(let iy=0; iy<this.sizey; iy++){
				this.g[ix][iy]=Math.floor(this.rng.nextFloat()*this.colors)+1;
			}
		}
		//make some white
		let whitesquares=this.sizex * this.sizey * this.white_ratio;
		whitesquares=Math.round(whitesquares);
		while (whitesquares>0){
			const rx=Math.floor(this.rng.nextFloat()*this.sizex);
			const ry=Math.floor(this.rng.nextFloat()*this.sizey);
			if (this.g[rx][ry]!=0){
				this.g[rx][ry]=0;
				whitesquares--;
			}
		}
		//count each color (required for win check)
		for (let i=0; i<=this.colors; i++){
			 this.block_size[i]={size: 0, got: 0};
		}
		for(let ix=0; ix<this.sizex; ix++){
			for(let iy=0; iy<this.sizey; iy++){
				if (this.g[ix][iy]!=0){
					this.block_size[this.g[ix][iy]].size++;
				}
			}
		}
		//find already compleated colors
		for(let ix=0; ix<this.sizex; ix++){
			for(let iy=0; iy<this.sizey; iy++){
				if (this.g[ix][iy]!=0 && this.block_size[this.g[ix][iy]].got==0){
					this.block_size[this.g[ix][iy]].got=this.find_block(ix,iy).length;
				}
			}
		}
	}
	
	draw_all(){
		for (let ix=0; ix<this.sizex; ix++){
			for(let iy=0; iy<this.sizey; iy++){
				this.draw(ix,iy);
			}
		}
	}
	
	draw(ix,iy){
		const get_color = (x,y) => this.in_grid(x,y) ? this.g[x][y] : 0;
		const r=Math.round(this.box_size/3.9);
		const colors=['#ffffff','#f70b0b','#20ef25','#575eff','#FFEC00','#F716EE','#06eaef','#FFA800','#339051','#AB68FF','#bc7933','#980037','#FF74A7'];
		const col=this.g[ix][iy];
		const top=get_color(ix,iy-1);
		const left=get_color(ix-1,iy);
		const right=get_color(ix+1,iy);
		const bottom=get_color(ix,iy+1);
		const x0=ix*this.box_size;
		const y0=iy*this.box_size;
		const x1=x0+this.box_size;
		const y1=y0+this.box_size;
		
		this.ctx.beginPath();
		this.ctx.fillStyle=colors[col];
		//rounded_rect(this.ctx,x0,y0,x1,y1,r);
		this.ctx.rect(x0,y0,this.box_size,this.box_size);
		this.ctx.fill();
		
		/*if (debug){
			let dex=x0+(this.box_size/2);
			let dey=y0+(this.box_size/2);
			this.ctx.beginPath();
			this.ctx.fillStyle="black";
			//rounded_rect(ctx,x0,y0,x1,y1,r);
			this.ctx.rect(dex-1,dey-1,2,2);
			this.ctx.fill();
		}*/
		
		if (top!=col && left!=col){
			this.ctx.beginPath();
			this.ctx.fillStyle = (top==left && top==get_color(ix-1,iy-1)) ? colors[top] : colors[0];
			this.ctx.moveTo(x0,y0);
			this.ctx.arc(x0+r,y0+r,r,Math.PI,1.5*Math.PI);
			this.ctx.fill();
		}
		if (top!=col && right!=col){
			this.ctx.beginPath();
			this.ctx.fillStyle = (top==right && top==get_color(ix+1,iy-1)) ? colors[top] : colors[0];
			this.ctx.moveTo(x1,y0);
			this.ctx.arc(x1-r,y0+r,r,1.5*Math.PI,0);
			this.ctx.fill();
		}
		if (bottom!=col && right!=col){
			this.ctx.beginPath();
			this.ctx.fillStyle = (bottom==right && bottom==get_color(ix+1,iy+1)) ? colors[bottom] : colors[0];
			this.ctx.moveTo(x1,y1);
			this.ctx.arc(x1-r,y1-r,r,0,0.5*Math.PI);
			this.ctx.fill();
		}
		if (bottom!=col && left!=col){
			this.ctx.beginPath();
			this.ctx.fillStyle = (bottom==left && bottom==get_color(ix-1,iy+1)) ? colors[bottom] : colors[0];
			this.ctx.moveTo(x0,y1);
			this.ctx.arc(x0+r,y1-r,r,0.5*Math.PI,Math.PI);
			this.ctx.fill();
		}
		
	}
		
	in_grid(x,y){
		 return (x>=0 && y>=0 && x<this.sizex && y<this.sizey)
	}
	
	make2dArray(size){
		let a=[];
		for (let i=0; i<size; i++){
			a[i]=[];
		}
		return a;
	}
	
	try_move(fx,fy,osx,osy){
		const col=this.g[fx][fy];
		let block=this.find_block(fx,fy);
		let movable=true;
		for (let box=0; box<block.length; box++){
			const tox=block[box].x+osx;
			const toy=block[box].y+osy;
			if ( !this.in_grid(tox,toy) || ( this.g[tox][toy]!=col && this.g[tox][toy]!=0 ) ){
				movable=false;
			}
		}
		if (movable){
			let all_done=false;
			while (!all_done){
				all_done=true;
				for (let box=0; box<block.length; box++){
					const tox=block[box].x+osx;
					const toy=block[box].y+osy;
					if (this.g[tox][toy]==0){
						this.g[tox][toy]=col;
						this.g[block[box].x][block[box].y]=0;
						all_done=false;
					}
				}
			}
			
			let griddraw=this.make2dArray(this.sizex);
			const drawonce=(ix,iy)=>{
				if (this.in_grid(ix,iy) && !griddraw[ix][iy]){
					this.draw(ix,iy);
					griddraw[ix][iy]=true;
				}
			}
			for (let box=0; box<block.length; box++){
				let x=block[box].x;//+osx;
				let y=block[box].y;//+osy;
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
			let new_block=this.find_block(fx+osx,fy+osy);
			this.check_win(col,new_block.length);
			if (this.won){
				if (this.preset > 0){
					this.set_won(this.preset);
				}
				this.play_sound("fanfare");
			}else if (new_block.length>block.length){
				this.play_sound("plop");
			}else{
				this.play_sound("3601");
			}
		}
		return movable;
	}
	
	check_win(col,block_size){
		this.block_size[col].got=block_size;
		let won=true;
		for (let c=1; c<=this.colors; c++){
			if ( this.block_size[c].size != this.block_size[c].got ){
				won=false;
			}
		}
		if (won){
			const centre_x=this.sizex*this.box_size/2;
			const centre_y=this.sizey*this.box_size/2;
			this.ctx.beginPath();
			this.ctx.fillStyle="rgba(0,0,0,0.4)";
			this.rounded_rect(this.ctx,centre_x-100,centre_y-100,centre_x+100,centre_y+100,40);
			//this.ctx.rect(x0,y0,this.box_size,this.box_size);
			this.ctx.fill();
			//
			this.ctx.beginPath();
			this.ctx.fillStyle="#20ff20";
			this.ctx.font="200px sans-serif";
			this.ctx.fillText("✔", centre_x-75, centre_y+75);
			this.ctx.fill();
			this.won=true;
		}
	}
	
	play_sound(src) {
		if (sound_on) {
			let audio = new Audio(src+".mp3");
			audio.play();
		}
	}
	
	find_block(x,y){
		const col=this.g[x][y];
		let gridfound=this.make2dArray(this.sizex);
		let found=[];
		this.add_box(found,gridfound,col,x,y);
		return found;
	}
	
	add_box(found,gridfound,col,x,y){
		if ( this.in_grid(x,y) && this.g[x][y]==col && !gridfound[x][y] ){
			gridfound[x][y]=true;
			found.push({x:x, y:y});
			this.add_box(found,gridfound,col,x-1,y);
			this.add_box(found,gridfound,col,x+1,y);
			this.add_box(found,gridfound,col,x,y-1);
			this.add_box(found,gridfound,col,x,y+1);
		}
	}
	
	rounded_rect(ctx,x0,y0,x1,y1,r){
		ctx.arc(x0+r,y0+r,r,Math.PI,1.5*Math.PI);
		ctx.lineTo(x1-r,y0);
		ctx.arc(x1-r,y0+r,r,1.5*Math.PI,0);
		ctx.lineTo(x1,y1-r);
		ctx.arc(x1-r,y1-r,r,0,0.5*Math.PI);
		ctx.lineTo(x0+r,y1);
		ctx.arc(x0+r,y1-r,r,0.5*Math.PI,Math.PI);
		ctx.lineTo(x0,y0+r);
	}

	getPosition(element) {
	    let xPosition = 0;
	    let yPosition = 0;
	      
	    while (element) {
	        xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
	        yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
	        element = element.offsetParent;
	    }
	    return { x: xPosition, y: yPosition };
	}
	
	random_seed(){
		document.getElementById("seed_input").value=Math.floor(Math.random()*10000)+1;
	}
	
	show_wins(){
		for (let i=1; i<=22; i++){
			if (this.get_won(i)){
				document.getElementById("pb"+i).value=i;//+"✔";
				document.getElementById("pb"+i).style.color="#00d000";
			}else{
				document.getElementById("pb"+i).value=i;
			}
		}
	}
	
	get_won(level){
		let done_str=localStorage.sbdone_str;
		let ver_str=localStorage.sbversion;
		if (typeof done_str != "string" || ver_str != "1.1"){
			done_str="";
		}
		localStorage.sbdone_str=done_str;
		localStorage.sbversion="1.1";
		return (done_str.length < level) ? false : done_str.charAt(level-1)=="1";
	}
	
	set_won(level){
		let done_str=localStorage.sbdone_str;
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

}

let sound_on=true;
function toggle_sound(){
	sound_on=!sound_on;
}	

let custom_game_open=false;
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

function get_preset_data(preset){
	if (preset==0){
		let size=document.getElementById("size_select").selectedIndex+4;
		let colors=document.getElementById("colors_select").selectedIndex+1;
		let white_ratio=Math.round(document.getElementById("white_input").value)/100;
		let seed=document.getElementById("seed_input").value;
		return [0,size,colors,white_ratio,seed];
	}else if (preset>=1){
		let levels=[
				//easy
				[1,4,1,0.6,3], //1
				[1,5,4,0.5,2], //2
				[1,5,3,0.5,1], //3
				[1,5,2,0.5,3], //4
				[1,4,4,0.3,9829], //5
				[1,4,3,0.4,3], //6
				//med
				[2,5,4,0.35,2], //7
				[2,6,3,0.4,3], //8
				[2,6,2,0.4,2], //9
				[2,6,3,0.3,2], //10
				[2,6,5,0.33,4730], //11
				//hard
				[3,7,4,0.35,3], //12
				[3,7,3,0.3,1], //13
				[3,7,4,0.25,7], //14
				[3,8,5,0.25,1], //15
				[3,5,3,0.3,7698], //16
				[3,5,3,0.3,4933], //17
				[3,8,5,0.3,3], //18
				//v hard
				[4,6,5,0.2,9343], //19
				[4,5,6,0.2,8969], //20
				[4,5,12,0.2,3551], //21
				[4,5,8,0.2,3154] //22
			];
		return levels[preset-1];
	}
}
