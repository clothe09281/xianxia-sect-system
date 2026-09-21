import {
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

const DEFAULT_MONSTERS = [
  { id: "bandit", name: "山賊", maxHp: 30, xpReward: 12, cpReward: 6, coinReward: 100, imagePath: "/monsters/monster_001.png", order: 1},
  { id: "goblin", name: "地精矮人", maxHp: 45, xpReward: 16, cpReward: 8, coinReward: 100, imagePath: "/monsters/monster_002.png", order: 2},
  { id: "golem", name: "機關傀儡", maxHp: 65, xpReward: 22, cpReward: 10, coinReward: 100, imagePath: "/monsters/monster_003.png", order: 3},
  { id: "cyclops", name: "獨眼巨人", maxHp: 90, xpReward: 30, cpReward: 14, coinReward: 100, imagePath: "/monsters/monster_004.png", order: 4},
  { id: "tengu", name: "天狗", maxHp: 120, xpReward: 40, cpReward: 18, coinReward: 100, imagePath: "/monsters/monster_005.png", order: 5},
];

export async function seedDefaultMonsters(classId) {
  if (!classId) {
    throw new Error("缺少 classId");
  }

  const batch = writeBatch(db);

  DEFAULT_MONSTERS.forEach((monster) => {
    const monsterRef = doc(
      db,
      "classes",
      classId,
      "monsters",
      monster.id
    );

    batch.set(
      monsterRef,
      {
        name: monster.name,
        maxHp: monster.maxHp,
        xpReward: monster.xpReward,
        cpReward: monster.cpReward,
        coinReward: monster.coinReward,
        imagePath: monster.imagePath,
        order: monster.order,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        // 再跑一次也不會產生重複 document
        merge: true,
      }
    );
  });

  await batch.commit();
}