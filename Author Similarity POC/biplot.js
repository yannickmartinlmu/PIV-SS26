
const COLORS = ["#7dd3fc", "#f87171", "#6ee7b7", "#fbbf24", "#c4b5fd"];

function createBiplot(svg, center, featureNames, pc1, pc2, rawPositions) {
  const xs = rawPositions.map(p => p.x), ys = rawPositions.map(p => p.y);
  const xF = (940 - 160) / (Math.max(...xs) - Math.min(...xs));
  const yF = (680 - 120) / (Math.max(...ys) - Math.min(...ys));
  const mags = featureNames.map((_, i) => Math.hypot(pc1[i] * xF, pc2[i] * yF));
  const bpS = 160 / Math.max(...mags);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  featureNames.forEach((_, i) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", `bp-ah-${i}`);
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", "0 0, 8 3, 0 6");
    poly.setAttribute("fill", COLORS[i]);
    marker.appendChild(poly);
    defs.appendChild(marker);
  });

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.id = "biplot";
  g.setAttribute("opacity", "0.5");
  g.style.display = "none";

  featureNames.forEach((name, i) => {
    const dx = pc1[i] * xF * bpS;
    const dy = pc2[i] * yF * bpS;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", center.x); line.setAttribute("y1", center.y);
    line.setAttribute("x2", center.x + dx); line.setAttribute("y2", center.y + dy);
    line.setAttribute("stroke", COLORS[i]);
    line.setAttribute("stroke-width", "1.8");
    line.setAttribute("marker-end", `url(#bp-ah-${i})`);
    g.appendChild(line);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", center.x + dx * 1.22);
    text.setAttribute("y", center.y + dy * 1.22);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", COLORS[i]);
    text.setAttribute("font-size", "12");
    text.setAttribute("paint-order", "stroke");
    text.setAttribute("stroke", "#090b14");
    text.setAttribute("stroke-width", "3");
    text.setAttribute("stroke-linejoin", "round");
    text.textContent = name;
    g.appendChild(text);
  });

  svg.insertBefore(g, svg.firstChild);
  svg.insertBefore(defs, g);
  return g;
}
