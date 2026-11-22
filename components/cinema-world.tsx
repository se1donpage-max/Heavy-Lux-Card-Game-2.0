"use client";

import { useEffect, useRef } from "react";

/**
 * K7 CINEMA / GPU STAGE
 * One small, shared WebGL canvas. Actual 3D geometry, real perspective and
 * directional lighting, without a dependency on Three.js or a per-tab canvas.
 * All interactive UI remains DOM-based and fully usable without WebGL.
 */
type XYZ = readonly [number, number, number];
type SceneName = "chat" | "events" | "roster" | "news" | "stats";
const SCENES: SceneName[] = ["chat", "events", "roster", "news", "stats"];
const VERTEX_SHADER = `
attribute vec3 a_position;
attribute vec3 a_normal;
attribute float a_tone;
uniform mat4 u_projection;
uniform mat4 u_view;
varying vec3 v_normal;
varying float v_tone;
void main() {
  v_normal = a_normal;
  v_tone = a_tone;
  gl_Position = u_projection * u_view * vec4(a_position, 1.0);
}`;
const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 v_normal;
varying float v_tone;
uniform float u_opacity;
void main() {
  vec3 n = normalize(v_normal);
  float directional = abs(dot(n, normalize(vec3(-0.36, 0.78, 0.86))));
  float metal = 0.12 + pow(directional, 2.3) * 0.88;
  float spec = pow(max(dot(n, normalize(vec3(0.3, 0.5, 0.9))), 0.0), 12.0);
  vec3 monochrome = vec3(0.40 + metal * 0.51 + spec * 0.13) * v_tone;
  float alpha = clamp((0.23 + 0.48 * directional + 0.14 * spec) * v_tone * u_opacity, 0.0, 0.82);
  gl_FragColor = vec4(monochrome, alpha);
}`;

type Geometry = { vertices: Float32Array; count: number };

class Model {
  private data: number[] = [];
  private triangle(a: XYZ, b: XYZ, c: XYZ, tone: number) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const normal = [nx / len, ny / len, nz / len];
    for (const point of [a, b, c]) this.data.push(...point, ...normal, tone);
  }
  quad(a: XYZ, b: XYZ, c: XYZ, d: XYZ, tone = 1) {
    this.triangle(a, b, c, tone);
    this.triangle(a, c, d, tone);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, tone = 1, angle = 0) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const pt = (a: number, b: number, c: number): XYZ =>
      [x + a * ca - b * sa, y + a * sa + b * ca, z + c];
    const X = w / 2, Y = h / 2, Z = d / 2;
    const a = pt(-X, -Y, Z), b = pt(X, -Y, Z), c = pt(X, Y, Z), e = pt(-X, Y, Z);
    const f = pt(-X, -Y, -Z), g = pt(X, -Y, -Z), i = pt(X, Y, -Z), j = pt(-X, Y, -Z);
    this.quad(a, b, c, e, tone); this.quad(g, f, j, i, tone * .49);
    this.quad(f, g, b, a, tone * .64); this.quad(e, c, i, j, tone * .72);
    this.quad(b, g, i, c, tone * .84); this.quad(f, a, e, j, tone * .57);
  }
  bar(x1: number, y1: number, x2: number, y2: number, width: number, z = 0, tone = 1) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    this.box((x1 + x2) * .5, (y1 + y2) * .5, z, length, width, width * 1.6,
      tone, Math.atan2(y2 - y1, x2 - x1));
  }
  ring(x: number, y: number, z: number, radius: number, tube: number, tone: number, rotation = 0, segments = 72) {
    const ca = Math.cos(rotation), sa = Math.sin(rotation);
    const rotate = (xx: number, yy: number, zz: number): XYZ => [
      x + xx, y + yy * ca - zz * sa, z + yy * sa + zz * ca,
    ];
    const radial = 7;
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      for (let j = 0; j < radial; j++) {
        const c = j / radial * Math.PI * 2, d = (j + 1) / radial * Math.PI * 2;
        const vertex = (angle: number, phi: number) => rotate(
          (radius + tube * Math.cos(phi)) * Math.cos(angle),
          (radius + tube * Math.cos(phi)) * Math.sin(angle),
          tube * Math.sin(phi));
        this.quad(vertex(a,c), vertex(b,c), vertex(b,d), vertex(a,d), tone);
      }
    }
  }
  done(): Geometry { return { vertices: new Float32Array(this.data), count: this.data.length / 7 }; }
}

function makeScene(name: SceneName): Geometry {
  const m = new Model();
  if (name === "chat") {
    // Communication: open orbiting signal architecture, distinct from stats.
    for (let i = 0; i < 4; i++) m.ring(1.0, .15, -i * .65, 1.0 + i * .41, .017 + i * .004, .8 - i * .09, -.33, 88);
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      m.bar(-3.8 + t * 3.5, -1.35 + Math.sin(t * Math.PI * 2) * .28,
        -3.5 + t * 3.5, -1.11 + Math.sin(t * Math.PI * 2) * .28, .018, -.65, .45);
    }
    m.box(1, .12, 0, .20, .20, .27, 1.3, .7);
  } else if (name === "events") {
    // Arena: giant sloping gates and monolithic blades.
    for (let i = 0; i < 6; i++) {
      const x = -2.7 + i * 1.08;
      m.box(x, .36, -1.0 - (i % 2) * .35, .21, 4.3, .58, .6 + (i % 3) * .23, -.26);
      m.box(x + .39, -1.5, .1, .12, 2.7, .25, .46, -.51);
    }
    m.bar(-3, 1.68, 3.4, 1.68, .13, -.1, .88);
    m.bar(-2.5, -1.66, 2.8, -1.66, .09, -.7, .62);
  } else if (name === "roster") {
    // Formation: genuine extruded K7 built from individual chrome struts.
    m.bar(-2.2, -1.7, -2.2, 2.1, .26, -.5, 1.15);
    m.bar(-2.05, -.05, -.25, 2.10, .23, -.5, .95);
    m.bar(-2.05, .1, -.08, -1.8, .25, -.5, 1.19);
    m.bar(.55, 2.1, 2.8, 2.1, .27, -.65, 1.15);
    m.bar(2.66, 2.05, 1.28, -1.78, .30, -.6, 1.08);
    for (let i = 0; i < 7; i++) m.box(-3.4 + i * 1.14, -2.3, -1.8, .025, .74, .035, .4);
  } else if (name === "news") {
    // Transmission: floating editorial slabs in differing depths.
    for (let i = 0; i < 5; i++) {
      const x = -2.15 + i * 1.14;
      m.box(x, i % 2 ? -.25 : .45, -.9 - (i % 3) * .43,
        .82, 2.25 + (i % 2) * .35, .07, .7 + (i % 2) * .26, -.2 + i * .075);
      m.bar(x - .38, .72 - i * .15, x + .35, .72 - i * .15, .025, .14, .95);
    }
    m.bar(-3.3, -1.5, 3.2, .9, .035, .35, 1.1);
  } else {
    // Precision: directional instrument, toroids, tick marks and data columns.
    for (let i = 0; i < 3; i++) m.ring(1.4, .35, -i * .35, 1.1 + i * .44, .027, .65 + i * .25, .64, 96);
    for (let i = 0; i < 32; i++) {
      const t = i * Math.PI * 2 / 32;
      const r = 2.2;
      m.bar(1.4 + Math.cos(t) * r, .35 + Math.sin(t) * r,
        1.4 + Math.cos(t) * (r + (i % 4 === 0 ? .24 : .09)),
        .35 + Math.sin(t) * (r + (i % 4 === 0 ? .24 : .09)), .025, -1, .85);
    }
    for (let i = 0; i < 9; i++) m.box(-3.3 + i * .35, -1.84 + ((i * 7) % 8) * .12, 0,
      .18, .35 + ((i * 7) % 8) * .24, .14, .5 + i * .065);
  }
  return m.done();
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function perspective(aspect: number): Float32Array {
  const f = 1 / Math.tan((45 * Math.PI / 180) / 2), near = .1, far = 50;
  return new Float32Array([
    f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1,
    0,0,(2*far*near)/(near-far),0,
  ]);
}
function viewMatrix(orbit: number): Float32Array {
  const yaw = -.12 + orbit * .19, pitch = -.12 + orbit * .07;
  const c = Math.cos(yaw), s = Math.sin(yaw), a = Math.cos(pitch), b = Math.sin(pitch);
  return new Float32Array([
    c,0,-s,0, s*b,a,c*b,0, s*a,-b,c*a,0, 0,0,-10.7,1,
  ]);
}

export default function CinemaWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return; // The CSS world remains fully functional.
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program); return;
    }
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    const position = gl.getAttribLocation(program, "a_position");
    const normal = gl.getAttribLocation(program, "a_normal");
    const tone = gl.getAttribLocation(program, "a_tone");
    const proj = gl.getUniformLocation(program, "u_projection");
    const view = gl.getUniformLocation(program, "u_view");
    const opacity = gl.getUniformLocation(program, "u_opacity");
    const resources = SCENES.map(name => {
      const mesh = makeScene(name);
      const buffer = gl.createBuffer();
      if (buffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      }
      return { buffer, count: mesh.count };
    });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(program);
    const sections = SCENES.map(name => document.getElementById(name));
    let frame = 0;
    let disposed = false;
    const memory = (navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? 4;
    const scale = Math.min(window.devicePixelRatio || 1, memory <= 2 ? .7 : .95);
    const resize = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const draw = () => {
      frame = 0;
      if (disposed || document.hidden) return;
      resize();
      const focus = window.innerHeight * .45;
      const distances = sections.map((node, index) => {
        const rect = node?.getBoundingClientRect();
        return { index, distance: rect ? Math.abs(rect.top + rect.height * .5 - focus) : Infinity };
      }).sort((a,b) => a.distance - b.distance);
      const primary = distances[0]?.index ?? 0;
      const secondary = distances[1]?.index ?? primary;
      const separation = Math.max(1, distances[0]?.distance + distances[1]?.distance);
      const mix = reduced.matches ? 0 : Math.min(.48, Math.max(0, .5 -
        (distances[1].distance - distances[0].distance) / separation));
      const scroll = reduced.matches ? 0 : Math.max(-1, Math.min(1,
        (focus - ((sections[primary]?.getBoundingClientRect().top ?? 0) +
          (sections[primary]?.getBoundingClientRect().height ?? 500) * .5)) / window.innerHeight));
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(proj, false, perspective(canvas.width / canvas.height));
      gl.uniformMatrix4fv(view, false, viewMatrix(scroll));
      const render = (index: number, alpha: number) => {
        const mesh = resources[index];
        if (!mesh.buffer || alpha <= 0.005) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
        gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(normal); gl.enableVertexAttribArray(tone);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(tone, 1, gl.FLOAT, false, 28, 24);
        gl.uniform1f(opacity, alpha);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      };
      render(secondary, mix * .65);
      render(primary, 1 - mix * .35);
    };
    const request = () => {
      if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const restore = () => request();
    const contextLost = (event: Event) => {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", restore);
    window.addEventListener("scroll", request, {passive: true});
    window.addEventListener("resize", request, {passive: true});
    document.addEventListener("visibilitychange", request);
    reduced.addEventListener("change", request);
    request();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      document.removeEventListener("visibilitychange", request);
      reduced.removeEventListener("change", request);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", restore);
      for (const mesh of resources) if (mesh.buffer) gl.deleteBuffer(mesh.buffer);
      gl.deleteProgram(program);
    };
  }, []);
  return <canvas ref={canvasRef} className="k7-world-canvas" aria-hidden="true" />;
}
