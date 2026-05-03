import * as THREE from 'three';

let ifcApi = null;
let scene = null;
let renderer = null;

let activeDrawingId = null;
// Original materials saved before clipping: mesh → original material(s)
const originalMaterials = new Map();
// Back-face orange meshes added to scene
const capMeshes = new Set();

export function initSectionCut(ifcApiRef, sceneRef, rendererRef) {
  ifcApi = ifcApiRef;
  scene = sceneRef;
  renderer = rendererRef;
}

function cloneMaterialWithClip(mat, plane) {
  const m = mat.clone();
  m.clippingPlanes = [plane];
  m.clipShadows = true;
  return m;
}

function makeCapMaterial(plane) {
  // Back-face only, orange, clipped — fills the cut surface
  return new THREE.MeshBasicMaterial({
    color: 0xFF6600,
    side: THREE.BackSide,
    clippingPlanes: [plane],
    clipShadows: true,
  });
}

export async function clearSectionCut() {
  // Restore original materials
  for (const [mesh, origMat] of originalMaterials) {
    mesh.material = origMat;
  }
  originalMaterials.clear();

  // Remove cap meshes
  for (const m of capMeshes) {
    scene.remove(m);
    m.material.dispose();
    // geometry is shared with original mesh — don't dispose
  }
  capMeshes.clear();

  if (renderer) renderer.localClippingEnabled = false;
  activeDrawingId = null;
}

export function extractDrawings(modelID) {
  if (!ifcApi) return [];

  const drawings = [];
  const IFCANNOTATION = ifcApi.GetTypeCodeFromName('IFCANNOTATION');
  if (!IFCANNOTATION) return drawings;

  const ids = ifcApi.GetLineIDsWithType(modelID, IFCANNOTATION);
  for (let i = 0; i < ids.size(); i++) {
    try {
      const eid = ids.get(i);
      const line = ifcApi.GetLine(modelID, eid, false);
      if (line.ObjectType?.value !== 'DRAWING') continue;

      let targetView = 'PLAN_VIEW';
      try {
        const psetIDs = ifcApi.GetLineIDsWithType(modelID, ifcApi.GetTypeCodeFromName('IFCPROPERTYSET'));
        for (let j = 0; j < psetIDs.size(); j++) {
          const pset = ifcApi.GetLine(modelID, psetIDs.get(j), false);
          if (!pset.Name?.value?.startsWith('EPset_Drawing')) continue;
          const hasProps = pset.HasProperties;
          if (hasProps) {
            for (const prop of hasProps) {
              const pline = ifcApi.GetLine(modelID, prop.value, false);
              if (pline.Name?.value === 'TargetView') {
                targetView = pline.NominalValue?.value ?? 'PLAN_VIEW';
                break;
              }
            }
          }
          break;
        }
      } catch { /* no pset */ }

      let placement = null;
      try {
        const locPlace = line.ObjectPlacement;
        if (locPlace) {
          const axis = ifcApi.GetLine(modelID, locPlace.value, false);
          const ax2 = ifcApi.GetLine(modelID, axis.RelativePlacement.value, false);

          let pos, dirY;
          try { pos = ax2.Location; } catch {}
          try { dirY = ax2.Axis; } catch {}

          let posEntity = null, dirEntity = null;
          if (pos?.value) {
            try { posEntity = ifcApi.GetLine(modelID, pos.value, false); } catch {}
          }
          if (dirY?.value) {
            try { dirEntity = ifcApi.GetLine(modelID, dirY.value, false); } catch {}
          }

          const getCoords = (entity) => {
            if (!entity) return null;
            const arr = entity.Coordinates ?? entity.DirectionRatios ?? null;
            if (!Array.isArray(arr)) return null;
            return arr.map(c => (typeof c === 'object' && c !== null) ? c.value : c);
          };

          const posArr = getCoords(posEntity);
          const dirYArr = getCoords(dirEntity);

          const p = posArr || [0, 0, 0];
          const n = dirYArr || [0, 0, 1];

          // IFC(X,Y,Z) → Three.js(X, Z, -Y), mm → m
          const threeX = p[0] / 1000;
          const threeY = p[2] / 1000;
          const threeZ = -p[1] / 1000;

          const threeNx = n[0];
          const threeNy = n[2];
          const threeNz = -n[1];

          const normal = new THREE.Vector3(threeNx, threeNy, threeNz).normalize();
          const constant = -(normal.x * threeX + normal.y * threeY + normal.z * threeZ);

          if (normal.length() > 0.001) {
            placement = new THREE.Plane(normal, constant);
          } else {
            placement = new THREE.Plane(new THREE.Vector3(0, 0, 1), -threeZ);
          }
        }
      } catch (e) {
        placement = null;
      }

      const name = line.Name?.value ?? line.LongName?.value ?? 'Untitled';

      drawings.push({
        expressID: eid,
        name: String(name),
        targetView: targetView,
        placement: placement
      });
    } catch { continue; }
  }
  return drawings;
}

export async function applySectionCut(drawing, expressIdToMeshesMap) {
  if (activeDrawingId === drawing.expressID) {
    await clearSectionCut();
    return;
  }

  if (activeDrawingId) {
    await clearSectionCut();
  }

  const plane = drawing.placement;
  if (!plane) return;

  renderer.localClippingEnabled = true;

  // For every mesh in the scene: replace its material with a clipped clone,
  // and add a back-face orange twin mesh for the cut cap
  scene.traverse((obj) => {
    if (!obj.isMesh) return;

    // Clone material(s) with clipping plane applied
    if (Array.isArray(obj.material)) {
      originalMaterials.set(obj, obj.material);
      obj.material = obj.material.map(m => cloneMaterialWithClip(m, plane));
    } else if (obj.material) {
      originalMaterials.set(obj, obj.material);
      obj.material = cloneMaterialWithClip(obj.material, plane);
    }

    // Add a back-face orange twin for the cap fill
    const capMat = makeCapMaterial(plane);
    const twin = new THREE.Mesh(obj.geometry, capMat);
    twin.matrix = obj.matrix;
    twin.matrixWorld = obj.matrixWorld;
    twin.matrixAutoUpdate = false;
    scene.add(twin);
    capMeshes.add(twin);
  });

  activeDrawingId = drawing.expressID;
}

export function getActiveDrawingId() {
  return activeDrawingId;
}
