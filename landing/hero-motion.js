(() => {
  const element = document.querySelector('.home-hero');
  const canvas = document.querySelector('#hero-light');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (document.documentElement.dataset.hook !== 'light') return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision mediump float;
    uniform vec2 resolution;
    uniform vec2 pointer;
    uniform float time;
    uniform float entrance;
    uniform float scroll;
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      vec2 p=(gl_FragCoord.xy-.5*resolution)/resolution.y;
      p+=pointer*.025;
      float along=dot(p,vec2(.638,-.77))+scroll*.05;
      float across=dot(p,vec2(.77,.638));
      vec3 color=vec3(0.);
      for(int j=0;j<5;j++){
        float i=float(j);
        float bend=.023*sin(along*2.4+time*.14+i*.65);
        float middle=(i-2.)*.225+bend+pointer.x*.008*(i-2.);
        float width=.099+sin(i*1.7)*.009;
        float z=(across-middle)/width;
        vec2 box=abs(vec2(across-middle,along-(i-2.)*.12))-vec2(width-.065,.74+sin(i*2.)*.13);
        float distance=length(max(box,0.))+min(max(box.x,box.y),0.)-.065;
        float inside=1.-smoothstep(-.002,.002,distance);
        float edge=exp(-abs(z-.965)*90.)+.32*exp(-abs(z+.97)*75.);
        float shoulder=pow(clamp(abs(z),0.,1.),8.)*inside;
        float curve=.5+.5*sin(along*2.3-time*.19+i*.9+pointer.x*.6+pointer.y*.3);
        float reflection=exp(-pow((z-(-.5+curve*.9))/.17,2.))*inside;
        float endFade=smoothstep(-1.4,-.5,along)* (1.-smoothstep(.55,1.5,along));
        float pass=mod(time*.105+i*.63,3.8)-1.9;
        float glint=exp(-pow((along-pass)/.17,2.));
        float spread=smoothstep(0.,.65,entrance-(abs(along)*.2+i*.08));
        float arrival=exp(-pow((along-(entrance*2.8-1.7))/.23,2.))*(1.-smoothstep(.9,1.6,entrance));
        vec3 tint=mix(vec3(.055,.4,.5),vec3(.075,.33,.45),i*.22);
        float broad=exp(-pow((z-.12)/.65,2.));
        vec3 body=tint*(.09+.24*shoulder+.24*reflection+broad*.95)*inside;
        vec3 rim=vec3(.36,.91,1.)*edge*(.08+.3*curve)*inside;
        vec3 prism=vec3(.18,.13,.45)*exp(-abs(z+1.035)*60.)*.22;
        vec3 shine=vec3(.63,.95,1.)*(edge+shoulder*.2)*glint*.8;
        vec3 arrivalLight=vec3(.4,.8,.9)*(edge+reflection*.15)*arrival*.38;
        color+=(body+rim+prism+shine+arrivalLight)*endFade*spread;
      }
      float center=1.-exp(-dot(p*vec2(1.15,1.1),p*vec2(1.15,1.1))*3.1);
      float fade=smoothstep(0.,.19,uv.y)*(1.-smoothstep(.9,1.,uv.y));
      color*=mix(.48,1.,center)*fade;
      gl_FragColor=vec4(vec3(.03137,.03922,.04314)+color,1.);
    }`;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution','pointer','time','entrance','scroll'].map(name => [name, gl.getUniformLocation(program,name)]));
  let visible = true, handle = 0, previous = 0, elapsed = 0, progress = 0;
  let targetX = 0, targetY = 0, x = 0, y = 0, bounds;
  const paused = () => reduced.matches || document.documentElement.dataset.paused === 'true';
  function draw() {
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, x, y);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.entrance, reduced.matches ? 2 : Math.min(2, elapsed));
    gl.uniform1f(uniforms.scroll, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function tick(now) {
    handle = 0;
    if (document.hidden || !visible || paused()) { previous = 0; return; }
    const delta = previous ? Math.min(.05, (now-previous)/1000) : 0;
    previous = now; elapsed += delta;
    const ease = 1-Math.exp(-delta*5);
    x += (targetX-x)*ease; y += (targetY-y)*ease;
    draw(); handle = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(handle); handle=0; previous=0;
    if (visible && !document.hidden && !paused()) handle=requestAnimationFrame(tick);
    else draw();
  }
  function resize() {
    bounds=element.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width=Math.round(bounds.width*scale); canvas.height=Math.round(bounds.height*scale);
    gl.viewport(0,0,canvas.width,canvas.height); draw();
  }
  new ResizeObserver(resize).observe(element);
  new IntersectionObserver(entries => { visible=entries[0].isIntersecting; sync(); }).observe(element);
  element.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || paused()) return;
    targetX=(event.clientX-bounds.left)/bounds.width*2-1;
    targetY=1-(event.clientY-bounds.top)/bounds.height*2;
  }, { passive:true });
  element.addEventListener('pointerleave', () => { targetX=0; targetY=0; });
  addEventListener('scroll', () => { progress=Math.min(1,scrollY/Math.max(1,bounds.height)); }, { passive:true });
  addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-paused']});
  addEventListener('lume:replay-intro', () => { elapsed=0; previous=0; sync(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(handle); document.documentElement.classList.remove('light-ready'); });
  document.documentElement.classList.add('light-ready');
  resize();
  sync();
})();
