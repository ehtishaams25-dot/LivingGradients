/* =====================================================================
   LIQUID ETHER FLUID SIMULATION
   Extracted and modified for shape-aware layer tracking
   ===================================================================== */
class LiquidEther {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = {
      mouseForce:         20,
      cursorSize:         100,
      isViscous:          false,
      viscous:            30,
      iterationsViscous:  32,
      iterationsPoisson:  32,
      dt:                 0.014,
      BFECC:              true,
      resolution:         0.5,
      isBounce:           false,
      colors:             ['#5227FF','#FF9FFC','#B497CF'],
      autoDemo:           true,
      autoSpeed:          0.5,
      autoIntensity:      2.2,
      takeoverDuration:   0.25,
      autoResumeDelay:    3000,
      autoRampDuration:   0.6,
      ...opts
    };

    this._rafId       = null;
    this._running     = false;
    this._aeActive    = false;  // true while AE is driving
    this._ro          = null;
    this._io          = null;
    this._isVisible   = true;

    this._init();
  }

  /* ── Internal helpers ─────────────────────────── */
  _makePaletteTexture(stops) {
    let arr = (Array.isArray(stops) && stops.length > 0) ? stops : ['#fff','#fff'];
    if (arr.length === 1) arr = [arr[0], arr[0]];
    const data = new Uint8Array(arr.length * 4);
    arr.forEach((hex, i) => {
      const c = new THREE.Color(hex);
      data[i*4+0] = Math.round(c.r*255);
      data[i*4+1] = Math.round(c.g*255);
      data[i*4+2] = Math.round(c.b*255);
      data[i*4+3] = 255;
    });
    const tex = new THREE.DataTexture(data, arr.length, 1, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  _init() {
    const container = this.container;
    const opts      = this.opts;

    /* ── Common (renderer + clock) ── */
    const Common = {
      width:0, height:0, aspect:1,
      time:0, delta:0,
      renderer:null, clock:null, container,
      init() {
        this.pixelRatio = Math.min(window.devicePixelRatio||1, 2);
        this.resize();
        this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        this.renderer.autoClear = false;
        this.renderer.setClearColor(new THREE.Color(0), 0);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
        this.clock = new THREE.Clock();
        this.clock.start();
      },
      resize() {
        if (!this.container) return;
        const r = this.container.getBoundingClientRect();
        this.width  = Math.max(1, Math.floor(r.width));
        this.height = Math.max(1, Math.floor(r.height));
        this.aspect = this.width / this.height;
        if (this.renderer) this.renderer.setSize(this.width, this.height, false);
      },
      update() {
        this.delta = this.clock.getDelta();
        this.time += this.delta;
      }
    };
    Common.init();
    container.prepend(Common.renderer.domElement);
    this._Common = Common;

    /* ── Mouse ── */
    const Mouse = {
      coords:    new THREE.Vector2(),
      coords_old:new THREE.Vector2(),
      diff:      new THREE.Vector2(),
      currentW:  undefined,
      currentH:  undefined,
      mouseMoved:false,
      isHoverInside:  false,
      hasUserControl: false,
      isAutoActive:   false,
      autoIntensity:  opts.autoIntensity,
      takeoverDuration: opts.takeoverDuration,
      takeoverActive: false,
      takeoverStartTime: 0,
      takeoverFrom: new THREE.Vector2(),
      takeoverTo:   new THREE.Vector2(),
      onInteract: null,
      _timer: null,
      _bound_mm:  null,
      _bound_ts:  null,
      _bound_tm:  null,
      _bound_te:  null,
      _bound_dl:  null,

      init(cont) {
        this._container = cont;
        const win = window;
        this._bound_mm = e => this._onMouseMove(e);
        this._bound_ts = e => this._onTouchStart(e);
        this._bound_tm = e => this._onTouchMove(e);
        this._bound_te = () => { this.isHoverInside = false; };
        this._bound_dl = () => { this.isHoverInside = false; };
        win.addEventListener('mousemove', this._bound_mm);
        win.addEventListener('touchstart', this._bound_ts, {passive:true});
        win.addEventListener('touchmove',  this._bound_tm, {passive:true});
        win.addEventListener('touchend',   this._bound_te);
        document.addEventListener('mouseleave', this._bound_dl);
      },
      dispose() {
        window.removeEventListener('mousemove', this._bound_mm);
        window.removeEventListener('touchstart', this._bound_ts);
        window.removeEventListener('touchmove',  this._bound_tm);
        window.removeEventListener('touchend',   this._bound_te);
        document.removeEventListener('mouseleave', this._bound_dl);
      },
      isPointInside(cx, cy) {
        if (!this._container) return false;
        const r = this._container.getBoundingClientRect();
        return cx>=r.left && cx<=r.right && cy>=r.top && cy<=r.bottom;
      },
      setCoords(x, y) {
        const r = this._container.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (this._timer) clearTimeout(this._timer);
        const nx = (x - r.left) / r.width;
        const ny = (y - r.top)  / r.height;
        this.coords.set(nx*2-1, -(ny*2-1));
        this.mouseMoved = true;
        this.currentW = undefined;
        this.currentH = undefined;
        this._timer = setTimeout(() => { this.mouseMoved = false; }, 100);
      },
      setNormalized(nx, ny) {
        this.coords.set(nx, ny);
        this.mouseMoved = true;
        this.currentW = undefined;
        this.currentH = undefined;
      },
      _onMouseMove(e) {
        if (!this.isPointInside(e.clientX, e.clientY)) {
          this.isHoverInside = false; return;
        }
        this.isHoverInside = true;
        if (this.onInteract) this.onInteract();
        if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
          const r = this._container.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width;
          const ny = (e.clientY - r.top)  / r.height;
          this.takeoverFrom.copy(this.coords);
          this.takeoverTo.set(nx*2-1, -(ny*2-1));
          this.takeoverStartTime = performance.now();
          this.takeoverActive = true;
          this.hasUserControl = true;
          this.isAutoActive   = false;
          return;
        }
        this.setCoords(e.clientX, e.clientY);
        this.hasUserControl = true;
      },
      _onTouchStart(e) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        this.isHoverInside = this.isPointInside(t.clientX, t.clientY);
        if (!this.isHoverInside) return;
        if (this.onInteract) this.onInteract();
        this.setCoords(t.clientX, t.clientY);
        this.hasUserControl = true;
      },
      _onTouchMove(e) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        this.isHoverInside = this.isPointInside(t.clientX, t.clientY);
        if (!this.isHoverInside) return;
        this.setCoords(t.clientX, t.clientY);
      },
      update() {
        if (this.takeoverActive) {
          const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
          if (t >= 1) {
            this.takeoverActive = false;
            this.coords.copy(this.takeoverTo);
            this.coords_old.copy(this.coords);
            this.diff.set(0,0);
          } else {
            const k = t*t*(3-2*t);
            this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
          }
        }
        this.diff.subVectors(this.coords, this.coords_old);
        this.coords_old.copy(this.coords);
        if (this.coords_old.x===0 && this.coords_old.y===0) this.diff.set(0,0);
        if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
      }
    };
    Mouse.init(container);
    this._Mouse = Mouse;

    /* ── Auto Driver ── */
    class AutoDriver {
      constructor(mouse, lastInteractionRef, opts) {
        this.mouse  = mouse;
        this.liRef  = lastInteractionRef;
        this.enabled       = opts.enabled;
        this.speed         = opts.speed;
        this.resumeDelay   = opts.resumeDelay  || 3000;
        this.rampDurationMs= (opts.rampDuration||0)*1000;
        this.active = false;
        this.current= new THREE.Vector2(0,0);
        this.target = new THREE.Vector2();
        this.lastTime = performance.now();
        this.activationTime = 0;
        this.margin = 0.2;
        this._dir   = new THREE.Vector2();
        this._pickTarget();
      }
      _pickTarget() {
        this.target.set(
          (Math.random()*2-1)*(1-this.margin),
          (Math.random()*2-1)*(1-this.margin)
        );
      }
      forceStop() {
        this.active = false;
        this.mouse.isAutoActive = false;
      }
      update() {
        if (!this.enabled) return;
        const now  = performance.now();
        const idle = now - this.liRef.value;
        if (idle < this.resumeDelay) { if (this.active) this.forceStop(); return; }
        if (this.mouse.isHoverInside)  { if (this.active) this.forceStop(); return; }
        if (!this.active) {
          this.active = true;
          this.current.copy(this.mouse.coords);
          this.lastTime = now;
          this.activationTime = now;
        }
        this.mouse.isAutoActive = true;
        let dtSec = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dtSec > 0.2) dtSec = 0.016;
        const dir  = this._dir.subVectors(this.target, this.current);
        const dist = dir.length();
        if (dist < 0.01) { this._pickTarget(); return; }
        dir.normalize();
        let ramp = 1;
        if (this.rampDurationMs > 0) {
          const t = Math.min(1, (now - this.activationTime) / this.rampDurationMs);
          ramp = t*t*(3-2*t);
        }
        const move = Math.min(this.speed * dtSec * ramp, dist);
        this.current.addScaledVector(dir, move);
        this.mouse.setNormalized(this.current.x, this.current.y);
      }
    }

    this._lastInteraction = { value: performance.now() };
    Mouse.onInteract = () => {
      this._lastInteraction.value = performance.now();
      if (this._autoDriver) this._autoDriver.forceStop();
    };

    this._autoDriver = new AutoDriver(Mouse, this._lastInteraction, {
      enabled:       opts.autoDemo,
      speed:         opts.autoSpeed,
      resumeDelay:   opts.autoResumeDelay,
      rampDuration:  opts.autoRampDuration
    });

    /* ── Shaders ── */
    const face_vert = `
      attribute vec3 position; uniform vec2 px; uniform vec2 boundarySpace;
      varying vec2 uv; precision highp float;
      void main(){
        vec3 pos=position; vec2 scale=1.0-boundarySpace*2.0;
        pos.xy=pos.xy*scale; uv=vec2(0.5)+(pos.xy)*0.5;
        gl_Position=vec4(pos,1.0);
      }`;
    const line_vert = `
      attribute vec3 position; uniform vec2 px;
      precision highp float; varying vec2 uv;
      void main(){
        vec3 pos=position; uv=0.5+pos.xy*0.5;
        vec2 n=sign(pos.xy); pos.xy=abs(pos.xy)-px*1.0; pos.xy*=n;
        gl_Position=vec4(pos,1.0);
      }`;
    const mouse_vert = `
      precision highp float; attribute vec3 position; attribute vec2 uv;
      uniform vec2 center; uniform vec2 scale; uniform vec2 px; varying vec2 vUv;
      void main(){
        vec2 pos=position.xy*scale*2.0*px+center; vUv=uv;
        gl_Position=vec4(pos,0.0,1.0);
      }`;
    const advection_frag = `
      precision highp float; uniform sampler2D velocity; uniform float dt;
      uniform bool isBFECC; uniform vec2 fboSize; uniform vec2 px; varying vec2 uv;
      void main(){
        vec2 ratio=max(fboSize.x,fboSize.y)/fboSize;
        if(!isBFECC){
          vec2 vel=texture2D(velocity,uv).xy; vec2 uv2=uv-vel*dt*ratio;
          gl_FragColor=vec4(texture2D(velocity,uv2).xy,0,0);
        } else {
          vec2 sn=uv; vec2 vo=texture2D(velocity,uv).xy; vec2 so=sn-vo*dt*ratio;
          vec2 vn1=texture2D(velocity,so).xy; vec2 sn2=so+vn1*dt*ratio;
          vec2 err=sn2-sn; vec2 sn3=sn-err/2.0;
          vec2 v2=texture2D(velocity,sn3).xy; vec2 so2=sn3-v2*dt*ratio;
          gl_FragColor=vec4(texture2D(velocity,so2).xy,0,0);
        }
      }`;
    const color_frag = `
      precision highp float; uniform sampler2D velocity;
      uniform sampler2D palette; uniform vec4 bgColor; varying vec2 uv;
      void main(){
        vec2 vel=texture2D(velocity,uv).xy; float lenv=clamp(length(vel),0.0,1.0);
        vec3 c=texture2D(palette,vec2(lenv,0.5)).rgb;
        gl_FragColor=vec4(mix(bgColor.rgb,c,lenv),mix(bgColor.a,1.0,lenv));
      }`;
    const divergence_frag = `
      precision highp float; uniform sampler2D velocity;
      uniform float dt; uniform vec2 px; varying vec2 uv;
      void main(){
        float x0=texture2D(velocity,uv-vec2(px.x,0)).x;
        float x1=texture2D(velocity,uv+vec2(px.x,0)).x;
        float y0=texture2D(velocity,uv-vec2(0,px.y)).y;
        float y1=texture2D(velocity,uv+vec2(0,px.y)).y;
        gl_FragColor=vec4((x1-x0+y1-y0)/2.0/dt);
      }`;
    const poisson_frag = `
      precision highp float; uniform sampler2D pressure;
      uniform sampler2D divergence; uniform vec2 px; varying vec2 uv;
      void main(){
        float p0=texture2D(pressure,uv+vec2(px.x*2,0)).r;
        float p1=texture2D(pressure,uv-vec2(px.x*2,0)).r;
        float p2=texture2D(pressure,uv+vec2(0,px.y*2)).r;
        float p3=texture2D(pressure,uv-vec2(0,px.y*2)).r;
        float div=texture2D(divergence,uv).r;
        gl_FragColor=vec4((p0+p1+p2+p3)/4.0-div);
      }`;
    const pressure_frag = `
      precision highp float; uniform sampler2D pressure;
      uniform sampler2D velocity; uniform vec2 px; uniform float dt; varying vec2 uv;
      void main(){
        float p0=texture2D(pressure,uv+vec2(px.x,0)).r;
        float p1=texture2D(pressure,uv-vec2(px.x,0)).r;
        float p2=texture2D(pressure,uv+vec2(0,px.y)).r;
        float p3=texture2D(pressure,uv-vec2(0,px.y)).r;
        vec2 v=texture2D(velocity,uv).xy;
        gl_FragColor=vec4(v-vec2(p0-p1,p2-p3)*0.5*dt,0,1);
      }`;
    const viscous_frag = `
      precision highp float; uniform sampler2D velocity;
      uniform sampler2D velocity_new; uniform float v;
      uniform vec2 px; uniform float dt; varying vec2 uv;
      void main(){
        vec2 old=texture2D(velocity,uv).xy;
        vec2 n0=texture2D(velocity_new,uv+vec2(px.x*2,0)).xy;
        vec2 n1=texture2D(velocity_new,uv-vec2(px.x*2,0)).xy;
        vec2 n2=texture2D(velocity_new,uv+vec2(0,px.y*2)).xy;
        vec2 n3=texture2D(velocity_new,uv-vec2(0,px.y*2)).xy;
        vec2 nv=4.0*old+v*dt*(n0+n1+n2+n3);
        gl_FragColor=vec4(nv/(4.0*(1.0+v*dt)),0,0);
      }`;
    const externalForce_frag = `
      precision highp float; uniform vec2 force; uniform vec2 center;
      uniform vec2 scale; uniform vec2 px; varying vec2 vUv;
      void main(){
        vec2 circle=(vUv-0.5)*2.0; float d=1.0-min(length(circle),1.0);
        gl_FragColor=vec4(force*d*d,0,1);
      }`;

    /* ── Shader Pass helper ── */
    class ShaderPass {
      constructor(props) {
        this.props    = props || {};
        this.uniforms = this.props.material?.uniforms;
        this.scene = this.camera = this.material = this.geometry = this.plane = null;
      }
      init() {
        this.scene  = new THREE.Scene();
        this.camera = new THREE.Camera();
        if (this.uniforms) {
          this.material = new THREE.RawShaderMaterial(this.props.material);
          this.geometry = new THREE.PlaneGeometry(2,2);
          this.plane    = new THREE.Mesh(this.geometry, this.material);
          this.scene.add(this.plane);
        }
      }
      update() {
        Common.renderer.setRenderTarget(this.props.output || null);
        Common.renderer.render(this.scene, this.camera);
        Common.renderer.setRenderTarget(null);
      }
    }

    /* ── Advection ── */
    class Advection extends ShaderPass {
      constructor(sp) {
        super({ material:{ vertexShader:face_vert, fragmentShader:advection_frag,
          uniforms:{ boundarySpace:{value:sp.cellScale}, px:{value:sp.cellScale},
            fboSize:{value:sp.fboSize}, velocity:{value:sp.src.texture},
            dt:{value:sp.dt}, isBFECC:{value:true} } }, output:sp.dst });
        this.uniforms = this.props.material.uniforms; this.init(); this._createBoundary();
      }
      _createBoundary() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(
          [-1,-1,0,-1,1,0,-1,1,0,1,1,0,1,1,0,1,-1,0,1,-1,0,-1,-1,0]),3));
        this.line = new THREE.LineSegments(g,
          new THREE.RawShaderMaterial({ vertexShader:line_vert, fragmentShader:advection_frag,
            uniforms:this.uniforms }));
        this.scene.add(this.line);
      }
      update({ dt, isBounce, BFECC }) {
        this.uniforms.dt.value = dt;
        this.line.visible = isBounce;
        this.uniforms.isBFECC.value = BFECC;
        super.update();
      }
    }

    /* ── ExternalForce ── */
    class ExternalForce extends ShaderPass {
      constructor(sp) {
        super({ output:sp.dst }); this._sp = sp;
        super.init();
        const g = new THREE.PlaneGeometry(1,1);
        const m = new THREE.RawShaderMaterial({ vertexShader:mouse_vert,
          fragmentShader:externalForce_frag, blending:THREE.AdditiveBlending,
          depthWrite:false, uniforms:{
            px:{value:sp.cellScale}, force:{value:new THREE.Vector2()},
            center:{value:new THREE.Vector2()},
            scale:{value:new THREE.Vector2(sp.cursor_size,sp.cursor_size)} } });
        this.mouse = new THREE.Mesh(g,m);
        this.scene.add(this.mouse);
      }
      update(props) {
        const u = this.mouse.material.uniforms;
        u.force.value.set((Mouse.diff.x/2)*props.mouse_force,(Mouse.diff.y/2)*props.mouse_force);
        
        // Use w/h if provided by layer, otherwise fallback to cursor_size
        const wPx = (Mouse.currentW !== undefined) ? Mouse.currentW : props.cursor_size;
        const hPx = (Mouse.currentH !== undefined) ? Mouse.currentH : props.cursor_size;
        
        // The scale uniform uses radius
        const rx = wPx / 2;
        const ry = hPx / 2;
        
        const cx = rx * props.cellScale.x;
        const cy = ry * props.cellScale.y;
        
        u.center.value.set(
          Math.min(Math.max(Mouse.coords.x,-1+cx+props.cellScale.x*2),1-cx-props.cellScale.x*2),
          Math.min(Math.max(Mouse.coords.y,-1+cy+props.cellScale.y*2),1-cy-props.cellScale.y*2));
        u.scale.value.set(rx, ry);
        super.update();
      }
    }

    /* ── Viscous ── */
    class Viscous extends ShaderPass {
      constructor(sp) {
        super({ material:{ vertexShader:face_vert, fragmentShader:viscous_frag, uniforms:{
          boundarySpace:{value:sp.boundarySpace}, velocity:{value:sp.src.texture},
          velocity_new:{value:sp.dst_.texture}, v:{value:sp.viscous},
          px:{value:sp.cellScale}, dt:{value:sp.dt} } },
          output:sp.dst, output0:sp.dst_, output1:sp.dst });
        this.init();
      }
      update({ viscous, iterations, dt }) {
        this.uniforms.v.value = viscous;
        let fi, fo;
        for (let i=0;i<iterations;i++) {
          fi = i%2===0 ? this.props.output0 : this.props.output1;
          fo = i%2===0 ? this.props.output1 : this.props.output0;
          this.uniforms.velocity_new.value = fi.texture;
          this.props.output = fo; this.uniforms.dt.value = dt;
          super.update();
        }
        return fo;
      }
    }

    /* ── Divergence ── */
    class Divergence extends ShaderPass {
      constructor(sp) {
        super({ material:{ vertexShader:face_vert, fragmentShader:divergence_frag, uniforms:{
          boundarySpace:{value:sp.boundarySpace}, velocity:{value:sp.src.texture},
          px:{value:sp.cellScale}, dt:{value:sp.dt} } }, output:sp.dst });
        this.init();
      }
      update({ vel }) { this.uniforms.velocity.value = vel.texture; super.update(); }
    }

    /* ── Poisson ── */
    class Poisson extends ShaderPass {
      constructor(sp) {
        super({ material:{ vertexShader:face_vert, fragmentShader:poisson_frag, uniforms:{
          boundarySpace:{value:sp.boundarySpace}, pressure:{value:sp.dst_.texture},
          divergence:{value:sp.src.texture}, px:{value:sp.cellScale} } },
          output:sp.dst, output0:sp.dst_, output1:sp.dst });
        this.init();
      }
      update({ iterations }) {
        let pi, po;
        for (let i=0;i<iterations;i++) {
          pi = i%2===0 ? this.props.output0 : this.props.output1;
          po = i%2===0 ? this.props.output1 : this.props.output0;
          this.uniforms.pressure.value = pi.texture;
          this.props.output = po; super.update();
        }
        return po;
      }
    }

    /* ── Pressure ── */
    class Pressure extends ShaderPass {
      constructor(sp) {
        super({ material:{ vertexShader:face_vert, fragmentShader:pressure_frag, uniforms:{
          boundarySpace:{value:sp.boundarySpace}, pressure:{value:sp.src_p.texture},
          velocity:{value:sp.src_v.texture}, px:{value:sp.cellScale}, dt:{value:sp.dt} } },
          output:sp.dst });
        this.init();
      }
      update({ vel, pressure }) {
        this.uniforms.velocity.value  = vel.texture;
        this.uniforms.pressure.value  = pressure.texture;
        super.update();
      }
    }

    /* ── Simulation ── */
    class Simulation {
      constructor(o) {
        this.options = { iterations_poisson:32, iterations_viscous:32, mouse_force:20,
          resolution:0.5, cursor_size:100, viscous:30, isBounce:false, dt:0.014,
          isViscous:false, BFECC:true, ...o };
        this.fbos = {};
        this.fboSize     = new THREE.Vector2();
        this.cellScale   = new THREE.Vector2();
        this.boundarySpace = new THREE.Vector2();
        this._setup();
      }
      _floatType() {
        return /(iPad|iPhone|iPod)/i.test(navigator.userAgent)
          ? THREE.HalfFloatType : THREE.FloatType;
      }
      _setup() {
        this._calcSize();
        this._createFBOs();
        this._createPasses();
      }
      _calcSize() {
        const w = Math.max(1, Math.round(this.options.resolution * Common.width));
        const h = Math.max(1, Math.round(this.options.resolution * Common.height));
        this.cellScale.set(1/w, 1/h);
        this.fboSize.set(w, h);
      }
      _createFBOs() {
        const type = this._floatType();
        const base = { type, depthBuffer:false, stencilBuffer:false,
          minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter,
          wrapS:THREE.ClampToEdgeWrapping, wrapT:THREE.ClampToEdgeWrapping };
        const keys = ['vel_0','vel_1','vel_viscous0','vel_viscous1','div','pressure_0','pressure_1'];
        keys.forEach(k => { this.fbos[k] = new THREE.WebGLRenderTarget(
          this.fboSize.x, this.fboSize.y, base); });
      }
      _createPasses() {
        const f = this.fbos, cs = this.cellScale, bs = this.boundarySpace, dt = this.options.dt;
        this.advection   = new Advection({ cellScale:cs, fboSize:this.fboSize, dt, src:f.vel_0, dst:f.vel_1 });
        this.extForce    = new ExternalForce({ cellScale:cs, cursor_size:this.options.cursor_size, dst:f.vel_1 });
        this.viscous     = new Viscous({ cellScale:cs, boundarySpace:bs, viscous:this.options.viscous,
          src:f.vel_1, dst:f.vel_viscous1, dst_:f.vel_viscous0, dt });
        this.divergence  = new Divergence({ cellScale:cs, boundarySpace:bs, src:f.vel_viscous0, dst:f.div, dt });
        this.poisson     = new Poisson({ cellScale:cs, boundarySpace:bs, src:f.div,
          dst:f.pressure_1, dst_:f.pressure_0 });
        this.pressure    = new Pressure({ cellScale:cs, boundarySpace:bs, src_p:f.pressure_0,
          src_v:f.vel_viscous0, dst:f.vel_0, dt });
      }
      resize() {
        this._calcSize();
        for (let k in this.fbos) this.fbos[k].setSize(this.fboSize.x, this.fboSize.y);
      }
      update() {
        const o = this.options;
        this.boundarySpace.copy(o.isBounce ? new THREE.Vector2(0,0) : this.cellScale);
        this.advection.update({ dt:o.dt, isBounce:o.isBounce, BFECC:o.BFECC });
        this.extForce.update({ cursor_size:o.cursor_size, mouse_force:o.mouse_force,
          cellScale:this.cellScale });
        let vel = this.fbos.vel_1;
        if (o.isViscous) vel = this.viscous.update({ viscous:o.viscous,
          iterations:o.iterations_viscous, dt:o.dt });
        this.divergence.update({ vel });
        const pressure = this.poisson.update({ iterations:o.iterations_poisson });
        this.pressure.update({ vel, pressure });
      }
    }

    /* ── Palette & Output ── */
    this._paletteTex = this._makePaletteTexture(opts.colors);
    const bgVec4     = new THREE.Vector4(0,0,0,0);

    const scene  = new THREE.Scene();
    const camera = new THREE.Camera();
    const sim    = new Simulation({
      iterations_poisson: opts.iterationsPoisson,
      iterations_viscous: opts.iterationsViscous,
      mouse_force:        opts.mouseForce,
      resolution:         opts.resolution,
      cursor_size:        opts.cursorSize,
      viscous:            opts.viscous,
      isViscous:          opts.isViscous,
      isBounce:           opts.isBounce,
      dt:                 opts.dt,
      BFECC:              opts.BFECC
    });
    this._sim = sim;

    const outputMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2,2),
      new THREE.RawShaderMaterial({
        vertexShader: face_vert,
        fragmentShader: color_frag,
        transparent: true, depthWrite: false,
        uniforms: {
          velocity:    { value: sim.fbos.vel_0.texture },
          boundarySpace:{ value: new THREE.Vector2() },
          palette:     { value: this._paletteTex },
          bgColor:     { value: bgVec4 }
        }
      })
    );
    scene.add(outputMesh);
    this._outputMesh = outputMesh;
    this._scene      = scene;
    this._camera     = camera;
    this._Common     = Common;

    /* ── ResizeObserver ── */
    this._ro = new ResizeObserver(() => {
      cancelAnimationFrame(this._roRaf);
      this._roRaf = requestAnimationFrame(() => { Common.resize(); sim.resize(); });
    });
    this._ro.observe(container);

    /* ── IntersectionObserver (pause when off-screen) ── */
    this._io = new IntersectionObserver(entries => {
      this._isVisible = entries[0].isIntersecting;
      if (this._isVisible && !document.hidden) this.start();
      else this.pause();
    }, { threshold:[0,0.01] });
    this._io.observe(container);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else if (this._isVisible) this.start();
    });
  }

  /* ── Public API ───────────────────────────────── */

  /**
   * Called each frame when AE layer tracking is active.
   * nx, ny are normalised coords (-1..1, Y-up).
   * w, h are bounds size
   */
  setLayerInput(nx, ny, w, h) {
    this._aeActive = true;
    // Suppress auto-driver
    if (this._autoDriver) this._autoDriver.forceStop();
    this._lastInteraction.value = performance.now();
    this._Mouse.coords.set(nx, ny);
    if (w !== undefined) this._Mouse.currentW = w;
    if (h !== undefined) this._Mouse.currentH = h;
    this._Mouse.mouseMoved      = true;
    this._Mouse.isAutoActive    = false;
    this._Mouse.hasUserControl  = true;
  }

  /** Resume auto-demo when layer tracking is off */
  clearLayerInput() {
    this._aeActive = false;
    this._Mouse.hasUserControl = false;
    this._lastInteraction.value = 0; // immediately resume auto
  }

  setColors(stops) {
    if (this._paletteTex) this._paletteTex.dispose();
    this._paletteTex = this._makePaletteTexture(stops);
    this._outputMesh.material.uniforms.palette.value = this._paletteTex;
  }

  setOptions(patch) {
    Object.assign(this.opts, patch);
    const so = this._sim.options;
    if (patch.mouseForce        !== undefined) so.mouse_force          = patch.mouseForce;
    if (patch.cursorSize        !== undefined) so.cursor_size          = patch.cursorSize;
    if (patch.isViscous         !== undefined) so.isViscous            = patch.isViscous;
    if (patch.viscous           !== undefined) so.viscous              = patch.viscous;
    if (patch.iterationsViscous !== undefined) so.iterations_viscous   = patch.iterationsViscous;
    if (patch.iterationsPoisson !== undefined) so.iterations_poisson   = patch.iterationsPoisson;
    if (patch.dt                !== undefined) so.dt                   = patch.dt;
    if (patch.BFECC             !== undefined) so.BFECC                = patch.BFECC;
    if (patch.isBounce          !== undefined) so.isBounce             = patch.isBounce;
    if (patch.resolution        !== undefined) {
      if (patch.resolution !== so.resolution) { so.resolution = patch.resolution; this._sim.resize(); }
    }
    if (this._autoDriver) {
      if (patch.autoDemo      !== undefined) this._autoDriver.enabled         = patch.autoDemo;
      if (patch.autoSpeed     !== undefined) this._autoDriver.speed           = patch.autoSpeed;
      if (patch.autoResumeDelay!== undefined)this._autoDriver.resumeDelay    = patch.autoResumeDelay;
      if (patch.autoRampDuration!==undefined)this._autoDriver.rampDurationMs = patch.autoRampDuration*1000;
    }
    if (this._Mouse) {
      if (patch.autoIntensity    !== undefined) this._Mouse.autoIntensity    = patch.autoIntensity;
      if (patch.takeoverDuration !== undefined) this._Mouse.takeoverDuration = patch.takeoverDuration;
    }
  }

  _loop() {
    if (!this._running) return;
    this._Common.update();
    if (this._autoDriver) this._autoDriver.update();
    this._Mouse.update();
    this._sim.update();
    // Render output pass
    this._Common.renderer.setRenderTarget(null);
    this._Common.renderer.render(this._scene, this._camera);
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  dispose() {
    this.pause();
    try { this._ro?.disconnect(); } catch(e) {}
    try { this._io?.disconnect(); } catch(e) {}
    this._Mouse.dispose();
    if (this._Common.renderer) {
      const c = this._Common.renderer.domElement;
      if (c?.parentNode) c.parentNode.removeChild(c);
      this._Common.renderer.dispose();
      this._Common.renderer.forceContextLoss();
    }
    if (this._paletteTex) this._paletteTex.dispose();
  }
}

// Global liquid ether instance (will be managed by main.js)
window.LiquidEther = LiquidEther;
