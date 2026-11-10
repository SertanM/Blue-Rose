/** Tuval motorunun kullandığı DOM düğümleri. React bunları bir kez çizer, motor `bindDom` ile devralır. */
export interface EditorDom {
  canvas: HTMLDivElement;
  world: HTMLDivElement;
  svgRoot: SVGSVGElement;
  linkLayer: SVGGElement;
}

export const dom = {} as EditorDom;
export const bindDom = (d: EditorDom) => { Object.assign(dom, d); };
