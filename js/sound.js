// Sounds made on the spot with Web Audio (no sound files): the clang of the hammer, the roar of the bellows,
// the hiss of the quench, the rub of the stone and a short koto-like phrase. Starts on the first touch (phones need it).
let ac=null,on=true,noiseBuf=null,blow=null;

export function setSound(v){on=!!v;if(!on)stopBlow();}
export const soundOn=()=>on;
export function unlock(){
 if(ac||typeof AudioContext==='undefined')return;
 try{ac=new AudioContext();}catch{ac=null;return;}
 noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
const ready=()=>{if(!on||!ac)return false;if(ac.state==='suspended')ac.resume().catch(()=>{});return true;};
function env(node,t,a,peak,decay){const g=ac.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+decay);node.connect(g);g.connect(ac.destination);return g;}
function noise(t,dur,{type='bandpass',freq=1000,q=1,peak=0.3,attack=0.005}={}){
 const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;s.connect(f);
 env(f,t,attack,peak,dur);s.start(t);s.stop(t+attack+dur+0.05);return {s,f};
}

// quality 0..1: a clean strike rings longer and brighter
export function clang(quality=1){
 if(!ready())return;const t=ac.currentTime;
 for(const [f,a] of [[620,0.22],[1488,0.12],[2410,0.08],[3720,0.05]]){const o=ac.createOscillator();o.type='sine';o.frequency.value=f*(0.98+quality*0.04);env(o,t,0.002,a*(0.5+quality*0.5),0.25+0.6*quality);o.start(t);o.stop(t+1);}
 noise(t,0.06,{freq:3000,q:0.7,peak:0.35});
}
export function thud(){if(!ready())return;const t=ac.currentTime;const o=ac.createOscillator();o.type='triangle';o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(60,t+0.15);env(o,t,0.003,0.3,0.18);o.start(t);o.stop(t+0.3);noise(t,0.08,{freq:400,q:0.8,peak:0.2});}

export function startBlow(){
 if(!ready()||blow)return;const t=ac.currentTime;
 const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=500;const g=ac.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.25,t+0.25);
 s.connect(f);f.connect(g);g.connect(ac.destination);s.start(t);blow={s,f,g};
}
export function blowLevel(k){if(blow&&ac)blow.f.frequency.setTargetAtTime(400+900*k,ac.currentTime,0.1);}
export function stopBlow(){if(!blow||!ac){blow=null;return;}const t=ac.currentTime;blow.g.gain.setTargetAtTime(0.0001,t,0.08);blow.s.stop(t+0.5);blow=null;}

export function hiss(strength=1){if(!ready())return;const t=ac.currentTime;noise(t,1.6*strength,{type:'highpass',freq:2500,q:0.5,peak:0.32,attack:0.01});noise(t,0.3,{freq:500,q:1,peak:0.25});}
export function rub(speed){if(!ready())return;const t=ac.currentTime;noise(t,0.07,{freq:900+speed*500,q:1.2,peak:Math.min(0.12,0.04+speed*0.04)});}
export function scratch(){if(!ready())return;const t=ac.currentTime;noise(t,0.18,{freq:4200,q:6,peak:0.2});}
export function tick(){if(!ready())return;const t=ac.currentTime;const o=ac.createOscillator();o.type='triangle';o.frequency.value=880;env(o,t,0.002,0.12,0.08);o.start(t);o.stop(t+0.15);}
// a koto-like pluck phrase in a Japanese scale (miyako-bushi); better swords get a longer phrase
export function phrase(stars){
 if(!ready())return;const notes=[0,1,5,7,8,12,13,17],base=293.66,t0=ac.currentTime+0.05,n=2+stars;
 for(let i=0;i<n;i++){const st=notes[Math.min(notes.length-1,i+(stars>=4?2:0))],t=t0+i*0.16;const o=ac.createOscillator();o.type='triangle';o.frequency.value=base*2**(st/12);env(o,t,0.004,0.18,0.7);o.start(t);o.stop(t+0.9);}
}
