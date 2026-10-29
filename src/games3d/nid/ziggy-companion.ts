import * as THREE from 'three';
import { makeZiggy } from '../kit/models';
import { makeScarf as makeZiggyScarf } from '../ziggy/model';
import type { MouthShape } from '../ziggy/face';
import type { ZiggyCue } from '../ziggy/types';
import { makeFlowerCrown, type CompanionRig, type RigReaction } from './companions3d';

/**
 * The real Ziggy — the felt plush — living in the garden, behind the same rig
 * interface as the companions. The garden moves him around (walks, hops,
 * squash, the bath, the nest) through `root` and `body`; his own rig does the
 * rest: arms, legs, blinking, the glowing heart, antennas on springs. The
 * garden turns a stand-in head toward the pointer and Ziggy looks there.
 */

/** Ziggy at the size of the companions (head top about 1.7 at scale 1). */
const K = 0.85;
/** Heights in Ziggy's model (see ziggy/model.ts). */
const HEAD_Y = 1.555;
const MOUTH_Y = 1.34;

const CUES: Record<RigReaction, ZiggyCue> = { joy: 'giggle', bigJoy: 'cheer', love: 'love' };

export function makeZiggyCompanion({ lowPower, reduceMotion }: { lowPower: boolean; reduceMotion: boolean }): CompanionRig {
  const actor = makeZiggy({ lowPower });
  const { model, rig } = actor.userData;
  actor.scale.setScalar(K);
  if (reduceMotion) rig.energy = 0.35;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(actor);

  // Stand-ins for the shared code: it turns the head and squeezes the eyes;
  // Ziggy's rig reads the head's turn and blinks on its own.
  const head = new THREE.Group();
  head.position.y = HEAD_Y * K;
  body.add(head);
  const eyes = [new THREE.Object3D(), new THREE.Object3D()];

  // Munching and yawning open the mouth; otherwise his own face.
  let mouth: MouthShape | null = null;
  rig.lipSync = () => mouth;

  const neck = new THREE.Object3D();
  neck.userData.r = 0.3;

  const hitbox = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hitbox.position.y = 1.0;
  hitbox.userData.hitbox = true;
  root.add(hitbox);

  return {
    id: 'ziggy',
    root,
    body,
    head,
    eyes,
    setMouth(open) {
      mouth = open > 0.45 ? 'open' : open > 0.15 ? 'o' : null;
    },
    wiggles: [],
    neck,
    crown: model.hatAnchor,
    aquatic: false,
    mouthY: MOUTH_Y * K,
    hitbox,
    carryAt: model.carry,
    tick(dt, s) {
      rig.walk = s.walking ? 0.8 : 0;
      rig.carrying = s.carrying;
      // Asleep: he sits down in his nest.
      rig.seated = s.sleeping;
      rig.idle = s.sleeping ? 'sleep' : s.party ? 'dance' : 'calm';
      rig.mood = s.sleeping ? 'sleepy' : s.party ? 'excited' : 'happy';
      rig.lookAt(head.rotation.y / 0.42, -head.rotation.x / 0.22);
      rig.update(dt);
    },
    react(kind) {
      rig.cue(CUES[kind]);
    },
    dress(stage) {
      const added: THREE.Object3D[] = [];
      if (stage >= 1) {
        const scarf = makeZiggyScarf(lowPower);
        model.body.add(scarf);
        added.push(scarf);
      }
      if (stage === 2) {
        const flowers = makeFlowerCrown();
        flowers.scale.setScalar(0.8);
        model.hatAnchor.add(flowers);
        added.push(flowers);
      }
      // His own golden crown (the model keeps and disposes it).
      model.setAccessory(stage >= 3 ? 'crown' : 'none');
      return added;
    },
  };
}
