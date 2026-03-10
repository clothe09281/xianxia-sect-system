export const PETS_MASTER = {
  pet_001: {
    id: "pet_001",
    name: "青靈幼狐",
    icon: "/merchandise/pet_001.png",

    // 基礎屬性
    baseHp: 100,
    baseAtk: 10,
    baseSpd: 5,

    // 每升 1 級成長
    growHp: 12,
    growAtk: 3,
    growSpd: 1,

    // 每升 1 星額外加成
    starBonusHp: 30,
    starBonusAtk: 6,
    starBonusSpd: 1,

    passive: "妖丹掉落 +10%",
    skillName: "靈狐護佑",
    skillDesc: "回答正確時，額外獲得少量妖丹。",
  },

  pet_002: {
    id: "pet_002",
    name: "天眼神鷹",
    icon: "/merchandise/pet_002.png",

    baseHp: 80,
    baseAtk: 12,
    baseSpd: 7,

    growHp: 8,
    growAtk: 4,
    growSpd: 2,

    starBonusHp: 24,
    starBonusAtk: 8,
    starBonusSpd: 2,

    passive: "戰力加成 +5%",
    skillName: "天眼巡獵",
    skillDesc: "歷練時額外提高少量傷害表現。",
  },

  pet_003: {
    id: "pet_003",
    name: "太虛白澤",
    icon: "/merchandise/pet_003.png",

    baseHp: 120,
    baseAtk: 8,
    baseSpd: 4,

    growHp: 15,
    growAtk: 2,
    growSpd: 1,

    starBonusHp: 36,
    starBonusAtk: 4,
    starBonusSpd: 1,

    passive: "回血效果 +10%",
    skillName: "白澤靈息",
    skillDesc: "回血或恢復類效果提高。",
  },
};

// 升星需求
// 1→2 星：10
// 2→3 星：20
// 3→4 星：30
// 4→5 星：40
export function getStarNeed(star) {
  const safeStar = Math.max(1, Math.min(5, Number(star || 1)));
  if (safeStar >= 5) return 0;
  return safeStar * 10;
}

// 計算靈寵目前屬性
export function calcPetStats(master, level = 1, star = 1) {
  const safeLevel = Math.max(1, Math.min(10, Number(level || 1)));
  const safeStar = Math.max(1, Math.min(5, Number(star || 1)));

  return {
    hp:
      Number(master.baseHp || 0) +
      (safeLevel - 1) * Number(master.growHp || 0) +
      (safeStar - 1) * Number(master.starBonusHp || 0),

    atk:
      Number(master.baseAtk || 0) +
      (safeLevel - 1) * Number(master.growAtk || 0) +
      (safeStar - 1) * Number(master.starBonusAtk || 0),

    spd:
      Number(master.baseSpd || 0) +
      (safeLevel - 1) * Number(master.growSpd || 0) +
      (safeStar - 1) * Number(master.starBonusSpd || 0),
  };
}

// 計算靈寵戰力（可在詳情 / 主頁顯示）
export function calcPetPower(pet) {
  if (!pet) return 0;

  return Math.floor(
    Number(pet.level || 1) * 10 +
      Number(pet.star || 1) * 20 +
      Number(pet.atk || 0) +
      Number(pet.hp || 0) / 10 +
      Number(pet.spd || 0) * 5
  );
}

// 建立新靈寵資料
export function createPetDoc(master) {
  const initStats = calcPetStats(master, 1, 1);

  return {
    petId: master.id,
    name: master.name,
    icon: master.icon,

    level: 1,
    exp: 0,
    star: 1,

    hp: initStats.hp,
    atk: initStats.atk,
    spd: initStats.spd,

    owned: true,
    equipped: false,

    passive: master.passive || "",
    skillName: master.skillName || "",
    skillDesc: master.skillDesc || "",
  };
}