// Original Lume cloth renderer. Flag artwork: flag-icons v7.3.2, MIT.
const vertexSource = `attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D flag;
uniform float time;
uniform float strength;
uniform float panoramic;
float heightAt(vec2 p){return sin(p.x*10.5-time*1.6+p.y*1.8)+.3*sin(p.x*21.+p.y*4.-time*2.1)+.12*sin(p.y*13.+p.x*5.+time);}
void main(){
 vec2 p=vec2(uv.x,1.-uv.y);
 float h=heightAt(p);
 float dx=(heightAt(p+vec2(.003,0.))-h)/.003;
 float dy=(heightAt(p+vec2(0.,.003))-h)/.003;
 vec2 sampleUv=p+vec2(sin(p.x*7.-time)*.009,h*.024)*strength;
 float crop=mix(1.,.68,panoramic);
 sampleUv.y=(sampleUv.y-.5)*crop+.5;
 sampleUv=clamp(sampleUv,vec2(.001),vec2(.999));
 vec3 color=texture2D(flag,sampleUv).rgb;
 vec3 normal=normalize(vec3(-dx*.055*strength,-dy*.075*strength,1.));
 vec3 light=normalize(vec3(-.6,-.5,1.));
 float diffuse=.68+.32*max(dot(normal,light),0.);
 float silk=pow(max(dot(reflect(-light,normal),vec3(0.,0.,1.)),0.),14.)*.075;
 float vignette=1.-.075*pow(abs(p.x-.5)*2.,2.);
 color=color*diffuse*vignette+silk;
 gl_FragColor=vec4(color,1.);
}`;

export class FlagCloth {
  constructor(canvas, { strength = 1, speed = 1, panoramic = true, animated = true, renderWidth = null, renderHeight = null, cacheCountries = 1 } = {}) {
    this.canvas = canvas; this.strength = strength; this.speed = speed; this.panoramic = panoramic;
    this.renderWidth = renderWidth; this.renderHeight = renderHeight;
    this.countryTextures = new Map(); this.cacheCountries = cacheCountries;
    this.time = 1.5; this.paused = false; this.ready = false; this.revision = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
    if (this.gl) this.setup();
    else this.context = canvas.getContext('2d');
    if (animated) { this.resize = new ResizeObserver(() => this.draw()); this.resize.observe(canvas); }
    this.tick = timestamp => {
      const delta = Math.min((timestamp - (this.last || timestamp)) / 1000, .05); this.last = timestamp;
      if (!this.paused && !this.reduced.matches && !document.hidden) { this.time += delta * this.speed; this.draw(); }
      this.animation = requestAnimationFrame(this.tick);
    };
    if (animated) this.animation = requestAnimationFrame(this.tick);
  }
  setup() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    this.program = gl.createProgram(); gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Não foi possível preparar a animação.');
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.program, 'position'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.uniforms = Object.fromEntries(['time','strength','panoramic'].map(name => [name, gl.getUniformLocation(this.program, name)]));
  }
  setCountry(code) {
    const revision = ++this.revision;
    const cached = this.countryTextures.get(code);
    if (cached) {
      this.countryTextures.delete(code); this.countryTextures.set(code, cached);
      this.texture = cached.texture; this.image = cached.image;
      this.gl?.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.ready = true; this.draw(); return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.width = 2048; image.height = 1536;
      image.onload = () => {
        if (revision !== this.revision) return resolve(false);
        // Rasterize SVGs explicitly for consistent detail in both rendering paths.
        const surface = document.createElement('canvas'); surface.width = 2048; surface.height = 1024;
        const context = surface.getContext('2d');
        if (!context) { reject(new Error('Não foi possível preparar a bandeira.')); return; }
        context.drawImage(image, 0, 0, surface.width, surface.height);
        this.image = surface;
        if (this.gl) {
          if (this.countryTextures.size) {
            this.texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
          }
          const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.texture);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surface);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        }
        this.countryTextures.set(code, { texture: this.texture, image: this.gl ? null : surface });
        while (this.countryTextures.size > this.cacheCountries) {
          const oldest = this.countryTextures.keys().next().value;
          const entry = this.countryTextures.get(oldest);
          if (this.gl) this.gl.deleteTexture(entry.texture);
          this.countryTextures.delete(oldest);
        }
        this.ready = true; this.draw(); resolve(true);
      };
      image.onerror = () => reject(new Error('Não foi possível carregar essa bandeira.'));
      image.src = new URL(`./flags/${code}.svg`, import.meta.url).href;
    });
  }
  draw() {
    if (!this.ready) return;
    const ratio = Math.min(3, Math.max(2, devicePixelRatio || 1));
    const width = this.renderWidth || Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = this.renderHeight || Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    if (this.gl) {
      const gl = this.gl; gl.viewport(0, 0, width, height); gl.useProgram(this.program);
      gl.uniform1f(this.uniforms.time, this.time); gl.uniform1f(this.uniforms.strength, this.strength); gl.uniform1f(this.uniforms.panoramic, this.panoramic ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES,0,6);
    } else if (this.context) {
      const ctx = this.context; const image = this.image;
      ctx.fillStyle = '#0b1118'; ctx.fillRect(0,0,width,height);
      for (let x=0;x<width;x+=2) {
        const phase=x/width*10.5-this.time*1.6;
        const shift=Math.sin(phase)*height*.025*this.strength;
        ctx.drawImage(image,x/width*image.width,0,Math.max(1,2/width*image.width),image.height,x,-height*.07+shift,3,height*1.14);
        ctx.fillStyle=`rgba(0,0,0,${(.13+.13*Math.sin(phase))*this.strength})`;ctx.fillRect(x,0,2,height);
      }
    }
  }
  dispose() {
    cancelAnimationFrame(this.animation); this.resize?.disconnect(); this.revision++;
    if (this.gl) { if (!this.countryTextures.size) this.gl.deleteTexture(this.texture); for (const entry of this.countryTextures.values()) this.gl.deleteTexture(entry.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
  }
}

// A single offscreen renderer gives every card the same material as the live preview.
const thumbnailCache = new Map();
let thumbnailRenderer;
let thumbnailQueue = Promise.resolve();
export function renderFlagThumbnail(code) {
  if (thumbnailCache.has(code)) {
    const cached = thumbnailCache.get(code);
    thumbnailCache.delete(code); thumbnailCache.set(code, cached);
    return cached;
  }
  const result = thumbnailQueue.then(async () => {
    thumbnailRenderer ??= new FlagCloth(document.createElement('canvas'), { animated: false, renderWidth: 768, renderHeight: 192 });
    await thumbnailRenderer.setCountry(code);
    return thumbnailRenderer.canvas.toDataURL('image/png');
  });
  thumbnailQueue = result.catch(() => {});
  thumbnailCache.set(code, result);
  if (thumbnailCache.size > 48) thumbnailCache.delete(thumbnailCache.keys().next().value);
  result.catch(() => thumbnailCache.delete(code));
  return result;
}
window.addEventListener('pagehide', () => thumbnailRenderer?.dispose(), { once: true });
// Shared runtime for React and the standalone preview, loaded as a public module.
window.lumeFlagRenderer = { FlagCloth, renderFlagThumbnail };
